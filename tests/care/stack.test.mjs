/**
 * Website Care plan time, end to end on local services only: the real
 * Next.js routes and server code, the pending migrations on a throwaway
 * PostgreSQL, and the browser screens (task catalog, Quick add work,
 * allowance, estimates, terms review). See local-stack.mjs.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { available, sql, one, q } from './pg.mjs'
import { startStack, stopStack, api, APP, ADMIN_TOKEN } from './local-stack.mjs'

const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run these tests)'
const { chromium } = createRequire(import.meta.url)('playwright')
let ids, browser

before(async () => {
  if (skip) return
  ids = await startStack()
  browser = await chromium.launch()
}, { timeout: 240000 })
after(async () => { if (!skip) { await browser?.close(); await stopStack() } })

const preset = (key) => one(`select * from care_task_presets where key = ${q(key)}`)
const allowance = () => one(`select * from care_period_allowance(${q(ids.cycle)})`)
async function page(width = 1366) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  await ctx.addCookies([{ name: 'admin_token', value: ADMIN_TOKEN, url: APP }])
  const p = await ctx.newPage()
  await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(s) }))
  p.on('dialog', (d) => d.accept())
  return p
}

test('the care API refuses requests without the admin cookie', { skip }, async () => {
  const r = await fetch(`${APP}/api/care/admin/presets`)
  assert.equal(r.status, 401)
})

test('task catalog: proposed minutes are marked and confirming one is recorded', { skip }, async () => {
  const p = await page()
  await p.goto(`${APP}/admin/care?view=catalog`)
  await p.getByRole('heading', { name: 'Task catalog' }).waitFor()
  const card = p.locator('.care-sub', { hasText: 'Replace a supplied image' })
  await card.getByText('Proposed, not confirmed').waitFor()
  await card.getByText(/Example: 2 × 5 work \+ 3 testing \(once for the batch\) = 13/).waitFor()
  await card.getByRole('button', { name: 'Confirm minutes' }).click()
  await card.getByText('Confirmed', { exact: true }).waitFor()
  assert.ok(preset('image-replace').confirmed_at)
  await p.context().close()
})

test('editing a preset’s minutes in the catalog makes it proposed again', { skip }, async () => {
  const before = preset('link-change')
  sql(`update care_task_presets set confirmed_at = now() where key = 'link-change'`)
  const r = await api(`presets/${before.id}`, { method: 'PUT', json: { work_minutes: 3 } })
  assert.equal(r.status, 200)
  assert.equal(r.data.preset.confirmed_at, null)
  assert.equal(r.data.preset.version, before.version + 1)
  await api(`presets/${before.id}`, { method: 'PUT', json: { work_minutes: before.work_minutes } })
})

test('Quick add: choosing tasks deducts nothing; recording after confirmation applies the shown total', { skip }, async () => {
  const p = await page()
  await p.goto(`${APP}/admin/care?site=${ids.site}`)
  await p.getByRole('button', { name: 'Quick add work' }).click()
  await p.getByRole('group', { name: 'Choose tasks' }).getByText('Replace a supplied image').click()
  await p.getByRole('button', { name: 'One more' }).click()
  const sum = p.locator('.care-sum').first()
  await sum.getByRole('row', { name: /Task minutes 10/ }).waitFor()
  await sum.getByRole('row', { name: /Testing minutes 3/ }).waitFor()
  await sum.getByRole('row', { name: /Standard minutes to apply 13/ }).waitFor()
  await sum.getByRole('row', { name: /Available after recording 17/ }).waitFor()
  assert.equal(allowance().applied, 0, 'choosing a task deducts nothing')
  const record = p.getByRole('button', { name: 'Record completed work' })
  assert.equal(await record.isDisabled(), true, 'needs the completion confirmation')
  await p.getByText('The work and its testing are complete.', { exact: true }).click()
  await record.click()
  await p.getByRole('heading', { name: 'Recorded work' }).waitFor()
  assert.deepEqual(allowance(), { included: 30, applied: 13, reserved: 0, available: 17 })
  await p.locator('.care-allow').getByText('17').waitFor()
  await p.context().close()
})

test('Quick add refuses work beyond the available minutes', { skip }, async () => {
  const r = await api(`cycles/${ids.cycle}/work`, { method: 'POST', json: { batch_key: 'over-allowance-1', confirmed: true, lines: [{ source: 'custom', name: 'New page', client_description: 'Built a new page.', quantity: 1, work_minutes: 45 }] } })
  assert.equal(r.status, 409)
  assert.match(r.data.error, /needs 45 standard minutes but only 17 are available/)
})

test('larger request: estimate, client approval reserves, completion converts, invoice equals the approved price', { skip }, async () => {
  const p = await page()
  await p.goto(`${APP}/admin/care?cycle=${ids.cycle}`)
  await p.getByText('Plan time and work').click()
  await p.getByRole('button', { name: 'New estimate' }).click()
  await p.getByLabel('Title').fill('Team section rebuild')
  await p.getByLabel('Scope').fill('Rebuild the team section so photos resize on phones.')
  await p.getByLabel('Expected deliverables').fill('A responsive team section.')
  await p.getByLabel('Total standard minutes, including testing').fill('82')
  await p.getByLabel('Included minutes proposed').fill('17')
  await p.getByText('65 minutes of additional work beyond the included time.').waitFor()
  await p.getByLabel('Additional price ($)').fill('110')
  await p.getByLabel('How the price was calculated').fill('A fixed quote for the work beyond your included time.')
  await p.getByRole('button', { name: 'Save as draft' }).click()
  const card = p.locator('.care-sub', { hasText: 'Team section rebuild' })
  await card.getByText('draft', { exact: true }).waitFor()
  assert.equal(allowance().reserved, 0, 'a draft reserves nothing')
  await card.getByRole('button', { name: 'Record client approval' }).click()
  await card.getByLabel('How the client approved').fill('Email reply, Oct 30')
  await card.getByRole('button', { name: 'Record client approval' }).click()
  await card.getByText('approved', { exact: true }).waitFor()
  assert.deepEqual(allowance(), { included: 30, applied: 13, reserved: 17, available: 0 })
  await p.context().close()

  const est = one(`select * from care_estimates where title = 'Team section rebuild'`)
  const rec = await api(`cycles/${ids.cycle}/work`, { method: 'POST', json: { batch_key: 'estimate-work-1', confirmed: true, estimate_id: est.id, complete_estimate: true, lines: [{ source: 'custom', name: 'Rebuild team section', client_description: 'Rebuilt the team section so photos resize on phones.', quantity: 1, work_minutes: 82 }] } })
  assert.equal(rec.status, 200, JSON.stringify(rec.data))
  assert.equal(rec.data.entries[0].from_reservation, 17)
  assert.equal(rec.data.entries[0].additional_minutes, 65)
  assert.deepEqual(allowance(), { included: 30, applied: 30, reserved: 0, available: 0 })
  const inv = await api(`estimates/${est.id}/invoice`, { method: 'POST', json: { invoice_number: 'INV-CARE-1' } })
  assert.equal(inv.status, 200)
  const row = one(`select * from invoices where id = ${q(inv.data.invoice_id)}`)
  assert.equal(Number(row.total_fee), 110)
  assert.equal(row.status, 'pending')
})

test('the review report lists recorded work and the plan time block without retyping', { skip }, async () => {
  sql(`update care_cycles set work_log_confirmed_at = now() where id = ${q(ids.cycle)}`)
  const r = await api(`cycles/${ids.cycle}`)
  const s = r.data.snapshot
  assert.deepEqual(s.plan_box.rows.map((x) => x[0]), ['Plan time used', 'Available'])
  assert.equal(s.plan_box.rows[0][1], '30 standard minutes')
  assert.match(s.plan_box.rows[1][1], /^0 minutes as of /)
  assert.ok(s.work_done.some((w) => /Replaced an image you supplied\. \(quantity 2\)/.test(w.what)))
  assert.ok(s.work_done.some((w) => w.minutes === '17 minutes of plan time, 65 minutes as approved additional work'))
  assert.equal(JSON.stringify(s).includes('Private'), false)
})

test('undo restores minutes and keeps the entry in the history', { skip }, async () => {
  const e = one(`select id from care_work_entries where cycle_id = ${q(ids.cycle)} and estimate_id is null and voided_at is null limit 1`)
  const r = await api('work/void', { method: 'POST', json: { entries: [e.id], reason: 'Recorded twice by mistake' } })
  assert.equal(r.status, 200)
  assert.equal(allowance().applied, 17)
  assert.ok(one(`select voided_at from care_work_entries where id = ${q(e.id)}`).voided_at)
})

test('a client on older terms is flagged, and Quick add stays off until reviewed', { skip }, async () => {
  const old = one(`select id from care_sites where label = 'Harbor Street Bakery'`).id
  const cyc = one(`insert into care_cycles (site_id, source, period_start, period_end, plan, review_due_at, included_minutes) values (${q(old)}, 'manual', now() - interval '2 days', now() + interval '28 days', 'premium', now() + interval '5 days', 90) returning id`).id
  const ov = await api('overview')
  assert.ok(ov.data.workFlags.termsReview.some((s) => s.id === old))
  const blocked = await api(`cycles/${cyc}/work`, { method: 'POST', json: { batch_key: 'old-terms-1', confirmed: true, lines: [{ source: 'custom', name: 'Update', client_description: 'Made an update.', quantity: 1, work_minutes: 5 }] } })
  assert.equal(blocked.status, 409)
  assert.match(blocked.data.error, /predates the flexible plan time terms/)
  const p = await page(390)
  await p.goto(`${APP}/admin/care?site=${old}`)
  await p.getByText('Review this client’s care agreement first.').waitFor()
  assert.equal(await p.getByRole('button', { name: 'Quick add work' }).isDisabled(), true)
  await p.getByLabel('How the client accepted the current terms').fill('Signed updated agreement, Nov 4')
  await p.getByRole('button', { name: 'Mark agreement reviewed' }).click()
  await p.locator('button:enabled', { hasText: 'Quick add work' }).waitFor()
  await p.getByText('Review this client’s care agreement first.').waitFor({ state: 'detached' })
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(over <= 1, `phone width overflows by ${over}px`)
  await p.context().close()
})

/* ---------------------------- suggested Report text ---------------------------- */

const report = () => one(`select * from care_reports where cycle_id = ${q(ids.cycle)}`)

test('suggested text fills untouched fields and proposes, never overwrites, edited ones', { skip }, async () => {
  sql(`update care_reports set suggestions = '{}', content = '{"summary":"My own summary for this month."}', status = 'draft' where cycle_id = ${q(ids.cycle)}`)
  const r = await api(`cycles/${ids.cycle}/suggest`, { method: 'POST', json: {} })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  const rep = report()
  assert.equal(rep.content.summary, 'My own summary for this month.', 'your edited summary is kept')
  assert.ok(rep.suggestions.pending.summary, 'a replacement is proposed instead')
  assert.match(rep.content.investigated, /^Automated checks opened/, 'an empty field is filled')
  assert.equal(rep.status, 'draft', 'nothing is approved or sent')

  // Edit a generated field, refresh again: the edit stays.
  await api(`cycles/${ids.cycle}/report`, { method: 'PUT', json: { content: { ...rep.content, investigated: 'I checked everything by hand.' }, base_version: rep.version } })
  await api(`cycles/${ids.cycle}/suggest`, { method: 'POST', json: {} })
  assert.equal(report().content.investigated, 'I checked everything by hand.')
  assert.match(report().suggestions.pending.investigated, /^Automated checks opened/)
})

test('accepting one proposal changes only that field; Keep mine drops it', { skip }, async () => {
  const before = report()
  await api(`cycles/${ids.cycle}/suggest/accept`, { method: 'POST', json: { field: 'summary' } })
  const after = report()
  assert.equal(after.content.summary, before.suggestions.pending.summary)
  assert.equal(after.content.investigated, 'I checked everything by hand.')
  await api(`cycles/${ids.cycle}/suggest/dismiss`, { method: 'POST', json: { field: 'investigated' } })
  assert.equal(report().suggestions.pending.investigated, undefined)
  assert.equal(report().content.investigated, 'I checked everything by hand.')
})

test('suggestions are flagged outdated when hand checks, findings, work, or estimates change', { skip }, async () => {
  let c = await api(`cycles/${ids.cycle}`)
  assert.equal(c.data.suggestions.outdated, false)
  await api(`cycles/${ids.cycle}/manual/visual`, { method: 'PUT', json: { status: 'failed', note: 'Header overlaps on a laptop.' } })
  c = await api(`cycles/${ids.cycle}`)
  assert.equal(c.data.suggestions.outdated, true)
  await api(`cycles/${ids.cycle}/manual/visual`, { method: 'PUT', json: { status: 'passed', note: 'Checked on a laptop.' } })
})

test('private notes never appear in suggested text', { skip }, async () => {
  sql(`update care_reports set internal_notes = 'PRIVATE-REPORT-NOTE' where cycle_id = ${q(ids.cycle)}`)
  sql(`update care_issue_notes set internal_note = 'PRIVATE-ISSUE-NOTE' where cycle_id = ${q(ids.cycle)}`)
  sql(`update care_manual_results set internal_note = 'PRIVATE-MANUAL-NOTE' where cycle_id = ${q(ids.cycle)}`)
  sql(`update care_work_entries set private_note = 'PRIVATE-WORK-NOTE' where cycle_id = ${q(ids.cycle)}`)
  sql(`update care_reports set content = '{}', suggestions = '{}' where cycle_id = ${q(ids.cycle)}`)
  await api(`cycles/${ids.cycle}/suggest`, { method: 'POST', json: {} })
  const rep = report()
  assert.doesNotMatch(JSON.stringify(rep.content) + JSON.stringify(rep.suggestions), /PRIVATE/)
})

test('updating suggestions on an approved report returns it to draft for approval again', { skip }, async () => {
  sql(`update care_reports set status = 'approved', content = '{}', suggestions = '{}' where cycle_id = ${q(ids.cycle)}`)
  const v = report().version
  await api(`cycles/${ids.cycle}/suggest`, { method: 'POST', json: {} })
  const rep = report()
  assert.equal(rep.status, 'draft')
  assert.equal(rep.version, v + 1, 'a new version, so the approved one stays distinct')
})
