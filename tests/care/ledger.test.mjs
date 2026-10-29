/**
 * Website Care work ledger, tested against a real (throwaway) PostgreSQL
 * with the pending migrations applied. Covers the allocation rules that must
 * hold even when requests arrive at the same time.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { available, startDb, stopDb, sql, rows, one, call, concurrently, q, j } from './pg.mjs'

const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run the database tests)'
const TERMS = 'care-terms-test'

before(async () => { if (!skip) await startDb() }, { timeout: 60000 })
after(() => { if (!skip) stopDb() })

const preset = (key) => one(`select * from care_task_presets where key = ${q(key)}`)
const confirm = (key) => sql(`update care_task_presets set confirmed_at = now(), confirmed_by = 'test' where key = ${q(key)}`)

/** A website on a plan with one billing period (ending in the future unless told otherwise). */
function setup({ included = 30, terms = TERMS, startDays = -5, endDays = 25 } = {}) {
  const client = one(`insert into clients (name) values ('Test client') returning id`).id
  const site = one(`insert into care_sites (client_id, label, site_url, plan, care_terms_version) values (${q(client)}, 'Site', 'https://example.com', 'business', ${q(terms)}) returning id`).id
  const cycle = addCycle(site, { included, startDays, endDays })
  return { client, site, cycle }
}
function addCycle(site, { included = 30, startDays = -5, endDays = 25 } = {}) {
  return one(`insert into care_cycles (site_id, source, period_start, period_end, plan, review_due_at, included_minutes)
    values (${q(site)}, 'manual', now() + interval '${startDays} days', now() + interval '${endDays} days', 'business', now() + interval '${endDays} days', ${included}) returning id`).id
}
const allowance = (cycle) => one(`select * from care_period_allowance(${q(cycle)})`)
const presetLine = (key, quantity = 1, extra = {}) => ({ source: 'preset', preset_id: preset(key).id, quantity, ...extra })
function record(cycle, lines, opts = {}) {
  const o = { batch: randomUUID(), confirmed: true, terms: TERMS, estimate: null, complete: false, corrects: null, reason: null, on: null, ...opts }
  return call(`care_record_work(${q(cycle)}, ${q(o.batch)}, ${j(lines)}, 'tester', ${o.confirmed}, ${q(o.terms)}, ${o.on ? q(o.on) + '::date' : 'current_date'}, ${q(o.estimate)}, ${o.complete}, ${o.corrects ? `array[${o.corrects.map(q).join(',')}]::uuid[]` : 'null'}, ${q(o.reason)})`)
}
const fails = (fn, code) => assert.throws(fn, (e) => e.message.includes(code), `expected ${code}`)
function estimate(site, cycle, { standard = 90, included = 25, price = 11000, explanation = 'Fixed quote for the extra work', revisionOf = null } = {}) {
  return one(`insert into care_estimates (site_id, cycle_id, revision_of, title, scope, deliverables, standard_minutes, included_minutes, additional_price_cents, price_explanation)
    values (${q(site)}, ${q(cycle)}, ${q(revisionOf)}, 'Rebuild the team section', 'Rebuild the team section so photos resize on phones.', 'A responsive team section, tested on phone and desktop.', ${standard}, ${included}, ${price === null ? 'null' : price}, ${q(explanation)}) returning id`).id
}
const approve = (id, note = 'Client approved by email on Oct 30') => call(`care_approve_estimate(${q(id)}, ${q(note)}, 'tester')`)

test('the starter catalog is proposed: unconfirmed presets cannot deduct plan time', { skip }, () => {
  const all = rows(`select key, confirmed_at from care_task_presets order by key`)
  assert.ok(all.length >= 6)
  assert.ok(all.every((p) => p.confirmed_at === null))
  const { cycle } = setup()
  fails(() => record(cycle, [presetLine('image-replace', 2)]), 'CARE_PRESET_UNCONFIRMED')
  assert.equal(allowance(cycle).applied, 0)
})

test('quantity calculation: two supplied images at 5 minutes plus 3 minutes of batch testing applies 13', { skip }, () => {
  confirm('image-replace')
  const { cycle } = setup()
  const r = record(cycle, [presetLine('image-replace', 2)])
  const e = r.entries[0]
  assert.equal(e.work_total, 10)
  assert.equal(e.testing_total, 3)
  assert.equal(e.total_minutes, 13)
  assert.equal(e.applied_minutes, 13)
  assert.deepEqual(allowance(cycle), { included: 30, applied: 13, reserved: 0, available: 17 })
})

test('batch testing counts once, per unit testing counts for each unit, shared testing counts zero', { skip }, () => {
  confirm('image-replace'); confirm('link-change'); confirm('price-update')
  const { cycle } = setup({ included: 90 })
  const r = record(cycle, [presetLine('image-replace', 3), presetLine('link-change', 3), presetLine('price-update', 2, { testing_shared: true })])
  const [img, link, price] = r.entries
  assert.equal(img.testing_total, 3, 'batch: once for three images')
  assert.equal(img.total_minutes, 18)
  assert.equal(link.testing_total, 3, 'per unit: one minute for each of three links')
  assert.equal(link.total_minutes, 9)
  assert.equal(price.testing_total, 0, 'tested together with the other tasks')
  assert.equal(price.total_minutes, 6)
  assert.equal(allowance(cycle).applied, 33)
})

test('the same preset twice in one record is refused, so its testing is never counted twice', { skip }, () => {
  confirm('image-replace')
  const { cycle } = setup()
  fails(() => record(cycle, [presetLine('image-replace', 1), presetLine('image-replace', 1)]), 'CARE_DUPLICATE_LINE')
  assert.equal(allowance(cycle).applied, 0)
})

test('editing a preset clears its confirmation and never changes earlier entries', { skip }, () => {
  confirm('text-replace')
  const { cycle } = setup()
  const before = record(cycle, [presetLine('text-replace', 1)]).entries[0]
  const v1 = preset('text-replace').version
  sql(`update care_task_presets set work_minutes = 9 where key = 'text-replace'`)
  const after = preset('text-replace')
  assert.equal(after.version, v1 + 1)
  assert.equal(after.confirmed_at, null, 'needs confirming again')
  sql(`update care_task_presets set client_description = 'Updated text you sent.' where key = 'text-replace'`)
  assert.equal(preset('text-replace').version, v1 + 1, 'wording changes do not need reconfirmation')
  const stored = one(`select * from care_work_entries where id = ${q(before.id)}`)
  assert.equal(stored.work_minutes, 5)
  assert.equal(stored.total_minutes, 8)
  assert.equal(stored.preset_version, v1)
  fails(() => record(cycle, [presetLine('text-replace', 1)]), 'CARE_PRESET_UNCONFIRMED')
  confirm('text-replace')
  assert.equal(record(cycle, [presetLine('text-replace', 1)]).entries[0].total_minutes, 12)
})

test('a request for completed work must be confirmed; ticking a task alone deducts nothing', { skip }, () => {
  confirm('image-replace')
  const { cycle } = setup()
  fails(() => record(cycle, [presetLine('image-replace', 1)], { confirmed: false }), 'CARE_NOT_CONFIRMED')
  assert.equal(allowance(cycle).applied, 0)
})

test('saving the same work twice (double click or retry) records it once', { skip }, () => {
  confirm('image-replace')
  const { cycle } = setup()
  const batch = randomUUID()
  const a = record(cycle, [presetLine('image-replace', 1)], { batch })
  const b = record(cycle, [presetLine('image-replace', 1)], { batch })
  assert.equal(a.duplicate, false)
  assert.equal(b.duplicate, true)
  assert.equal(b.entries[0].id, a.entries[0].id)
  assert.equal(allowance(cycle).applied, 8)
})

test('simultaneous saves of the same work record it once', { skip }, async () => {
  confirm('image-replace')
  const { cycle } = setup()
  const batch = randomUUID()
  const stmt = `select care_record_work(${q(cycle)}, ${q(batch)}, ${j([presetLine('image-replace', 1)])}, 'tester', true, ${q(TERMS)});`
  const results = await concurrently(Array(6).fill(stmt))
  assert.ok(results.every((r) => r.ok), results.map((r) => r.err).join('\n'))
  assert.equal(one(`select count(*)::int n from care_work_entries where batch_key = ${q(batch)}`).n, 1)
  assert.equal(allowance(cycle).applied, 8)
})

test('simultaneous allocations can never overdraw the allowance', { skip }, async () => {
  const { cycle } = setup({ included: 30 })
  const custom = { source: 'custom', name: 'Add a gallery', client_description: 'Added a photo gallery.', quantity: 1, work_minutes: 20, testing_minutes: 0 }
  const stmts = Array.from({ length: 5 }, () => `select care_record_work(${q(cycle)}, ${q(randomUUID())}, ${j([custom])}, 'tester', true, ${q(TERMS)});`)
  const results = await concurrently(stmts)
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.ok(results.filter((r) => !r.ok).every((r) => r.err.includes('CARE_OVER_ALLOWANCE')))
  assert.deepEqual(allowance(cycle), { included: 30, applied: 20, reserved: 0, available: 10 })
})

test('work beyond the available minutes is refused and needs an approved estimate', { skip }, () => {
  const { cycle } = setup({ included: 30 })
  fails(() => record(cycle, [{ source: 'custom', name: 'New page', client_description: 'Built a new services page.', quantity: 1, work_minutes: 45 }]), 'CARE_OVER_ALLOWANCE')
  assert.equal(allowance(cycle).applied, 0)
})

test('excluded work is recorded and shown but deducts nothing, even with no time left', { skip }, () => {
  const { cycle } = setup({ included: 0 })
  const r = record(cycle, [
    { source: 'custom', name: 'Fix a launch defect', client_description: 'Fixed a contact form defect from launch.', quantity: 1, work_minutes: 20, excluded_reason: 'defect_correction' },
    { source: 'preset', preset_id: preset('document-replace').id, quantity: 1, excluded_reason: 'monthly_check' },
  ])
  assert.equal(r.entries[0].applied_minutes, 0)
  assert.equal(r.entries[0].total_minutes, 20)
  assert.equal(r.entries[1].applied_minutes, 0)
  assert.deepEqual(allowance(cycle), { included: 0, applied: 0, reserved: 0, available: 0 })
})

test('undo restores minutes and keeps the history', { skip }, () => {
  confirm('image-replace')
  const { cycle } = setup()
  const e = record(cycle, [presetLine('image-replace', 2)]).entries[0]
  fails(() => call(`care_void_work(array[${q(e.id)}]::uuid[], '', 'tester')`), 'reason')
  const v = call(`care_void_work(array[${q(e.id)}]::uuid[], 'Recorded on the wrong website', 'tester')`)
  assert.equal(v.allowance.available, 30)
  const kept = one(`select * from care_work_entries where id = ${q(e.id)}`)
  assert.ok(kept.voided_at)
  assert.equal(kept.void_reason, 'Recorded on the wrong website')
  fails(() => call(`care_void_work(array[${q(e.id)}]::uuid[], 'again', 'tester')`), 'already undone')
})

test('a correction replaces an entry in one step and the balance reflects only the new entry', { skip }, () => {
  confirm('image-replace')
  const { cycle } = setup()
  const e = record(cycle, [presetLine('image-replace', 3)]).entries[0]
  assert.equal(allowance(cycle).applied, 18)
  const r = record(cycle, [presetLine('image-replace', 2)], { corrects: [e.id], reason: 'It was two images, not three' })
  assert.equal(r.allowance.applied, 13)
  const old = one(`select * from care_work_entries where id = ${q(e.id)}`)
  assert.match(old.void_reason, /^Corrected: It was two images/)
  assert.equal(old.corrected_by_batch, r.entries[0].batch_key)
})

test('larger work: a draft estimate reserves nothing; approval reserves the included minutes', { skip }, () => {
  confirm('link-change')
  const { site, cycle } = setup({ included: 30 })
  record(cycle, [{ source: 'custom', name: 'Fix a broken link', client_description: 'Fixed a broken link.', quantity: 1, work_minutes: 5 }])
  const est = estimate(site, cycle, { standard: 90, included: 25 })
  assert.equal(one(`select additional_minutes from care_estimates where id = ${q(est)}`).additional_minutes, 65)
  assert.deepEqual(allowance(cycle), { included: 30, applied: 5, reserved: 0, available: 25 }, 'draft reserves nothing')
  const a = approve(est)
  assert.equal(a.reserved, 25)
  assert.deepEqual(allowance(cycle), { included: 30, applied: 5, reserved: 25, available: 0 })
  fails(() => record(cycle, [presetLine('link-change', 1)]), 'CARE_OVER_ALLOWANCE')
})

test('completing approved work converts the reservation without counting it twice and releases the rest', { skip }, () => {
  const { site, cycle } = setup({ included: 30 })
  const est = estimate(site, cycle, { standard: 90, included: 25 })
  approve(est)
  const custom = (m) => ({ source: 'custom', name: 'Rebuild team section', client_description: 'Rebuilt the team section so photos resize on phones.', quantity: 1, work_minutes: m })
  const part = record(cycle, [custom(10)], { estimate: est })
  assert.equal(part.entries[0].from_reservation, 10)
  assert.deepEqual(allowance(cycle), { included: 30, applied: 10, reserved: 15, available: 5 })
  const done = record(cycle, [custom(70)], { estimate: est, complete: true })
  assert.equal(done.entries[0].from_reservation, 15)
  assert.equal(done.entries[0].additional_minutes, 55)
  assert.deepEqual(allowance(cycle), { included: 30, applied: 25, reserved: 0, available: 5 })
  const e = one(`select status, reserved_minutes from care_estimates where id = ${q(est)}`)
  assert.equal(e.status, 'completed')
  assert.equal(e.reserved_minutes, 25)
})

test('finishing early releases the unused reservation back to the period', { skip }, () => {
  const { site, cycle } = setup({ included: 30 })
  const est = estimate(site, cycle, { standard: 25, included: 25, price: null, explanation: '' })
  approve(est)
  record(cycle, [{ source: 'custom', name: 'Small layout fix', client_description: 'Adjusted the layout.', quantity: 1, work_minutes: 15 }], { estimate: est, complete: true })
  assert.deepEqual(allowance(cycle), { included: 30, applied: 15, reserved: 0, available: 15 })
})

test('cancelling approved work releases its reservation; recorded work stays', { skip }, () => {
  const { site, cycle } = setup({ included: 30 })
  const est = estimate(site, cycle, { standard: 60, included: 30 })
  approve(est)
  record(cycle, [{ source: 'custom', name: 'Start the rebuild', client_description: 'Started the rebuild.', quantity: 1, work_minutes: 10 }], { estimate: est })
  call(`care_close_estimate(${q(est)}, 'cancelled', 'Client paused the project', 'tester')`)
  assert.deepEqual(allowance(cycle), { included: 30, applied: 10, reserved: 0, available: 20 })
})

test('scope growth needs a revised estimate; approving it supersedes the old one without double reserving', { skip }, () => {
  const { site, cycle } = setup({ included: 30 })
  const est = estimate(site, cycle, { standard: 60, included: 30 })
  approve(est)
  const custom = (m) => ({ source: 'custom', name: 'Rebuild', client_description: 'Rebuilt the section.', quantity: 1, work_minutes: m })
  record(cycle, [custom(40)], { estimate: est })
  fails(() => record(cycle, [custom(30)], { estimate: est }), 'CARE_SCOPE_EXCEEDED')
  const rev = estimate(site, cycle, { standard: 120, included: 30, revisionOf: est })
  const a = approve(rev, 'Client approved the revised estimate by email')
  assert.equal(a.reserved, 0, 'the 30 included minutes were already used by the first version')
  assert.equal(one(`select status from care_estimates where id = ${q(est)}`).status, 'superseded')
  assert.deepEqual(allowance(cycle), { included: 30, applied: 30, reserved: 0, available: 0 })
  const r = record(cycle, [custom(60)], { estimate: rev, complete: true })
  assert.equal(r.entries[0].additional_minutes, 60)
  fails(() => record(cycle, [custom(30)], { estimate: rev }), 'CARE_ESTIMATE_STATE')
})

test('approval needs a note, scope, deliverables, and a priced explanation for additional work', { skip }, () => {
  const { site, cycle } = setup({ included: 30 })
  const est = estimate(site, cycle, { standard: 90, included: 25, price: null, explanation: '' })
  fails(() => approve(est), 'additional work needs a price')
  sql(`update care_estimates set additional_price_cents = 11000, price_explanation = 'Fixed quote' where id = ${q(est)}`)
  fails(() => approve(est, 'ok'), 'how the client approved')
  assert.equal(approve(est).reserved, 25)
  fails(() => approve(est), 'CARE_ESTIMATE_STATE')
})

test('approval cannot reserve more than is available', { skip }, () => {
  const { site, cycle } = setup({ included: 30 })
  record(cycle, [{ source: 'custom', name: 'Updates', client_description: 'Made small updates.', quantity: 1, work_minutes: 20 }])
  fails(() => approve(estimate(site, cycle, { standard: 90, included: 25 })), 'CARE_OVER_ALLOWANCE')
})

test('billing period renewal: unused time and reservations never carry into the next period', { skip }, () => {
  const { site } = setup({ included: 30, startDays: -40, endDays: -10 })
  const old = one(`select id from care_cycles where site_id = ${q(site)}`).id
  record(old, [{ source: 'custom', name: 'Updates', client_description: 'Made small updates.', quantity: 1, work_minutes: 5 }], { on: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) })
  const next = addCycle(site, { included: 30, startDays: -10, endDays: 20 })
  assert.deepEqual(allowance(next), { included: 30, applied: 0, reserved: 0, available: 30 }, 'fresh allowance, nothing rolled over')
  const est = estimate(site, old, { standard: 40, included: 20 })
  fails(() => approve(est), 'CARE_PERIOD_ENDED')
  fails(() => record(next, [{ source: 'custom', name: 'Late', client_description: 'Work done last period.', quantity: 1, work_minutes: 5 }], { on: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) }), 'CARE_WRONG_PERIOD')
})

test('work against an estimate from another period is refused instead of using that period’s time', { skip }, () => {
  const { site, cycle } = setup({ included: 30 })
  const est = estimate(site, cycle, { standard: 40, included: 20 })
  approve(est)
  const other = addCycle(site, { startDays: 25, endDays: 55 })
  fails(() => record(other, [{ source: 'custom', name: 'Rebuild', client_description: 'Rebuilt it.', quantity: 1, work_minutes: 10 }], { estimate: est, on: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }), 'CARE_ESTIMATE_PERIOD')
})

test('a client whose agreement predates the flexible time terms is held for review', { skip }, () => {
  const { cycle } = setup({ terms: null })
  fails(() => record(cycle, [{ source: 'custom', name: 'Update', client_description: 'Made an update.', quantity: 1, work_minutes: 5 }]), 'CARE_TERMS_REVIEW')
})

test('invoice amount for additional work equals the approved price, once, with nothing charged', { skip }, () => {
  const { site, cycle, client } = setup({ included: 30 })
  const draft = estimate(site, cycle, { standard: 90, included: 25, price: 11000 })
  fails(() => call(`to_jsonb(care_invoice_estimate(${q(draft)}, ${q(client)}, 'INV-1', null, 'tester'))`), 'CARE_ESTIMATE_STATE')
  approve(draft)
  const inv1 = call(`to_jsonb(care_invoice_estimate(${q(draft)}, ${q(client)}, 'INV-1', null, 'tester'))`)
  const inv2 = call(`to_jsonb(care_invoice_estimate(${q(draft)}, ${q(client)}, 'INV-2', null, 'tester'))`)
  assert.equal(inv1, inv2, 'a second request returns the same invoice')
  const inv = one(`select * from invoices where id = ${q(inv1)}`)
  assert.equal(Number(inv.total_fee), 110)
  assert.equal(inv.status, 'pending')
  assert.equal(inv.invoice_type, 'fixed_fee')
  assert.equal(one(`select count(*)::int n from invoices where client_id = ${q(client)}`).n, 1)
  const free = estimate(site, cycle, { standard: 5, included: 5, price: null, explanation: '' })
  fails(() => call(`to_jsonb(care_invoice_estimate(${q(free)}, ${q(client)}, 'INV-3', null, 'tester'))`), 'CARE_ESTIMATE_STATE')
})

test('the browser roles cannot read or run any of this', { skip }, () => {
  fails(() => sql(`set role anon; select * from care_work_entries;`), 'permission denied')
  fails(() => sql(`set role authenticated; select care_period_allowance(gen_random_uuid());`), 'permission denied')
})
