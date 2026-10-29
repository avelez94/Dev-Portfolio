/**
 * Website Care report and plan time logic without a database: calculations,
 * the plan block, estimates, the report snapshot, the client email, and the
 * public samples.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const ROOT = new URL('../..', import.meta.url).pathname
const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const W = await jiti.import(ROOT + 'src/lib/care/work.ts')
const M = await jiti.import(ROOT + 'src/lib/care/report-model.ts')
const { clientReport } = await jiti.import(ROOT + 'src/lib/care/emails.ts')
const { CARE_SAMPLES } = await jiti.import(ROOT + 'src/content/care-samples.ts')
const { reportPdf } = await jiti.import(ROOT + 'src/lib/care/report-pdf.ts')

const rule = (work_minutes, testing_minutes, testing_mode = 'batch') => ({ work_minutes, testing_minutes, testing_mode })

test('quantity × work minutes plus testing: the two image example applies 13', () => {
  assert.deepEqual(W.lineTotals(rule(5, 3), 2), { work: 10, testing: 3, total: 13 })
  assert.equal(W.describeCalc(rule(5, 3), 2), '2 × 5 work + 3 testing (once for the batch) = 13')
})

test('batch testing counts once, per unit testing for each unit, shared testing zero', () => {
  assert.equal(W.lineTotals(rule(5, 3, 'batch'), 4).testing, 3)
  assert.equal(W.lineTotals(rule(2, 1, 'per_unit'), 4).testing, 4)
  assert.equal(W.lineTotals(rule(5, 3), 4, true).testing, 0)
  assert.equal(W.lineTotals(rule(5, 3), 0).total, 0)
})

const line = (over = {}) => ({ key: 'k', source: 'preset', preset: { id: 'p1', confirmed_at: '2026-11-01' }, name: 'Image', client_description: 'Replaced an image.', private_note: '', quantity: 2, work_minutes: 5, testing_minutes: 3, testing_mode: 'batch', testing_shared: false, excluded_reason: '', ...over })

test('Quick add summary: totals, balance, and the problems that block recording', () => {
  const s = W.draftSummary([line(), line({ key: 'x', source: 'custom', preset: undefined, name: 'Fix', client_description: 'Fixed a defect.', work_minutes: 20, testing_minutes: 0, quantity: 1, excluded_reason: 'defect_correction' })], { included: 30, applied: 0, reserved: 0, available: 30 })
  assert.equal(s.counted, 13)
  assert.equal(s.notCounted, 20)
  assert.equal(s.after, 17)
  assert.deepEqual(s.problems, [])
  assert.match(W.draftSummary([line({ preset: { id: 'p1', confirmed_at: null } })], null).problems.join(' '), /Confirm the proposed minutes/)
  assert.match(W.draftSummary([line(), line({ key: 'y' })], null).problems.join(' '), /listed twice/)
  assert.match(W.draftSummary([line({ quantity: 10 })], { included: 30, applied: 0, reserved: 0, available: 30 }).problems.join(' '), /needs 53 standard minutes but only 30/)
})

test('estimates need scope, deliverables, minutes, and a priced explanation for additional work', () => {
  const e = { title: 'Rebuild', scope: 'Rebuild the team section.', deliverables: 'A responsive section.', standard_minutes: 90, included_minutes: 25, additional_price_cents: null, price_explanation: '' }
  assert.match(W.estimateProblems(e, 25, true).join(' '), /needs a price/)
  assert.deepEqual(W.estimateProblems({ ...e, additional_price_cents: 11000, price_explanation: 'Fixed quote' }, 25, true), [])
  assert.match(W.estimateProblems({ ...e, additional_price_cents: 1, price_explanation: 'Fixed quote', included_minutes: 30 }, 25, true).join(' '), /Only 25 included minutes/)
  assert.match(W.estimateProblems({ ...e, additional_price_cents: 1, price_explanation: 'Fixed quote' }, 30, false).join(' '), /no included time/)
})

const base = {
  reportId: 'r', cycleId: 'c', version: 1, client: { name: 'A', business: 'B' }, recipient: { name: 'A', email: 'a@example.com' }, site: { label: 'S', url: 'https://s.example.com' },
  period: { start: 'x', end: 'y', label: 'November 2026', range: 'November 1 to December 1, 2026' }, reviewDate: 'Mon, November 2, 2026', scanStatus: 'succeeded',
  pages: [{ label: 'Home', url: 'https://s.example.com/' }], destinations: [], findings: [{ check_key: 'page_load', status: 'passed', url: 'https://s.example.com/' }],
  earlierFindings: [], manual: [], notes: [], content: { summary: 'All checks done this month.' },
}
const business = { id: 'business', name: 'Business Care', includedMinutes: 30, monthlyPrice: 119 }
const ledger = (o = {}) => ({ included: 30, applied: 0, reserved: 0, available: 30, confirmed: true, entries: [], estimates: [], ...o })

test('plan block: agreed price, standard minutes applied, reserved, and available as of the report date', () => {
  const s = M.buildReport({ ...base, plan: business, work: ledger({ applied: 5, reserved: 25, available: 0 }) })
  assert.deepEqual(M.planFacts(s.plan_box), [['Plan', 'Business Care'], ['Monthly plan price', '$119'], ['Billing period', 'November 1 to December 1, 2026'], ['Included time', '30 minutes, flexible']])
  assert.deepEqual(s.plan_box.rows, [['Plan time used', '5 standard minutes'], ['Reserved', '25 minutes for approved work'], ['Available', '0 minutes as of November 2']])
  assert.match(s.plan_box.rules.join(' '), /standard minutes .* not with a stopwatch/)
})

test('incomplete records never claim the full allowance remains', () => {
  const s = M.buildReport({ ...base, plan: business, work: ledger({ confirmed: false }) })
  assert.deepEqual(s.plan_box.rows.at(-1), ['Available', 'Not confirmed yet'])
  assert.match(s.plan_box.status, /aren’t complete/)
  assert.deepEqual(M.buildReport({ ...base, plan: business, work: null }).plan_box.rows, [['Plan time used', 'Not recorded']])
})

test('Essential Care: no minutes, work quoted separately', () => {
  const s = M.buildReport({ ...base, plan: { id: 'essential', name: 'Essential Care', includedMinutes: 0, monthlyPrice: 49 }, work: ledger({ included: 0, available: 0 }) })
  assert.deepEqual(s.plan_box.rows, [])
  assert.equal(s.plan_box.included_label, 'None. Work is quoted separately.')
  assert.match(s.plan_box.rules.join(' '), /quoted separately and starts only after you approve/)
})

test('report snapshot: recorded work in the client’s words, excluded work labeled, approvals with price and calculation', () => {
  const entries = [
    { client_description: 'Replaced an image you supplied.', name: 'Image', quantity: 2, total_minutes: 13, applied_minutes: 13, additional_minutes: 0, excluded_reason: null, private_note: 'SECRET' },
    { client_description: 'Fixed a contact form defect from launch.', name: 'Fix', quantity: 1, total_minutes: 20, applied_minutes: 0, additional_minutes: 0, excluded_reason: 'defect_correction' },
  ]
  const estimates = [{ id: 'e', title: 'Team section rebuild', scope: 'Rebuild it.', deliverables: 'A section.', schedule: '', standard_minutes: 90, included_minutes: 25, additional_minutes: 65, additional_price_cents: 11000, price_explanation: 'A fixed quote.', status: 'draft', reserved_minutes: 0 }]
  const s = M.buildReport({ ...base, plan: business, work: ledger({ applied: 13, available: 17, entries, estimates }) })
  assert.deepEqual(s.work_done.map((w) => w.minutes), ['13 minutes of plan time', '20 minutes, covered defect correction, not counted'])
  assert.equal(s.work_done[0].what, 'Replaced an image you supplied. (quantity 2)')
  assert.equal(s.approvals[0].price_label, '$110')
  assert.equal(s.approvals[0].additional_minutes, 65)
  assert.deepEqual(M.nextStepLines(s), ['Approval needed for the estimate for team section rebuild (details below). Nothing starts until you approve.'])
  assert.equal(JSON.stringify(s).includes('SECRET'), false, 'private notes never reach the snapshot')
  const mail = clientReport({ subject: 'x', message: 'm', snap: s })
  for (const t of ['Plan time used: 13 standard minutes', 'WAITING FOR YOUR APPROVAL', 'Additional price: $110. A fixed quote.', 'YOUR NEXT STEP', 'not a per minute charge']) assert.ok(mail.text.includes(t), t)
  assert.ok(mail.text.indexOf('YOUR NEXT STEP') < mail.text.indexOf('THIS MONTH’S CHECKS'), 'the next step comes before the checklist')
  assert.equal((mail.html + mail.text).includes('SECRET'), false)
})

test('prices typed in report text are refused; incomplete draft estimates block readiness', () => {
  const i = { ...base, plan: business, work: ledger({ estimates: [{ id: 'e', title: 'Rebuild', scope: 'x', deliverables: '', schedule: '', standard_minutes: 90, included_minutes: 25, additional_minutes: 65, additional_price_cents: null, price_explanation: '', status: 'draft', reserved_minutes: 0 }] }), content: { summary: 'Done. Extra work would be $200.' } }
  const p = M.modelProblems(i, M.buildReport(i)).join(' ')
  assert.match(p, /A price appears in the report text/)
  assert.match(p, /Estimate “Rebuild”: .*deliverables/)
  assert.match(p, /Estimate “Rebuild”: .*needs a price/)
})

test('public sample: the 90 minute rebuild uses the remaining 25 included minutes, leaving 65 additional', async () => {
  const s = CARE_SAMPLES.find((x) => x.slug === 'needs-attention').snapshot
  assert.deepEqual(s.plan_box.rows, [['Plan time used', '5 standard minutes'], ['Available', '25 minutes as of October 2']])
  const a = s.approvals[0]
  assert.deepEqual([a.standard_minutes, a.included_minutes, a.additional_minutes], [90, 25, 65])
  assert.equal(M.nextStepLines(s).length, 1, 'the issue and its estimate ask for approval once')
  for (const x of CARE_SAMPLES) {
    const mail = clientReport({ subject: 'x', message: 'm', snap: x.snapshot })
    const visible = (mail.text + JSON.stringify(x.snapshot)).replace(/https?:\/\/\S+/g, '').replace(/"[a-z_]+":/g, '')
    assert.doesNotMatch(visible, /[–—]| - /, 'no dashes in client text: ' + x.slug)
    assert.ok((await reportPdf(x.snapshot)).length > 1000)
  }
})

test('reports approved before the ledger still render as approved (snapshots are never rewritten)', async () => {
  const s = structuredClone(CARE_SAMPLES[0].snapshot)
  s.plan_box = { name: 'Business Care', price: 129, price_label: '$129', period_label: 'October 1 to November 1, 2026', included_minutes: 30, included_label: '30 minutes for updates or troubleshooting', used: 10, remaining: 20, usage_label: '10 minutes used, 20 minutes remaining', rules: ['Unused time doesn’t roll over to the next period.'] }
  delete s.work_done; delete s.approvals; delete s.approved_work
  const mail = clientReport({ subject: 'x', message: 'm', snap: s })
  assert.ok(mail.text.includes('Time this period: 10 minutes used, 20 minutes remaining'))
  assert.ok((await reportPdf(s)).length > 1000)
})

test('the report email carries the complete approved report, and the attached PDF says the same things', async () => {
  const { execFileSync } = await import('node:child_process')
  const { writeFileSync, mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const s = structuredClone(CARE_SAMPLES.find((x) => x.slug === 'needs-attention').snapshot)
  Object.assign(s, { summary: 'Summary sentence ALPHA.', notes: 'Client note BRAVO.', work: { fixes: 'Other work CHARLIE.', investigated: 'Looked into DELTA.', outstanding: 'Still open ECHO.' } })
  s.next_step = { ...s.next_step, more: 'Next month FOXTROT.' }
  const mail = clientReport({ subject: 'Your website health report', message: 'Personal message GOLF.', snap: s })
  const dir = mkdtempSync(tmpdir() + '/care-pdf-')
  writeFileSync(dir + '/r.pdf', await reportPdf(s))
  const flat = (t) => t.replace(/\s+/g, ' ')
  const pdf = flat(execFileSync('pdftotext', [dir + '/r.pdf', '-']).toString())
  const text = flat(mail.text)
  const parts = [
    s.headline, 'Summary sentence ALPHA.', 'Looked into DELTA.', 'Still open ECHO.', 'Other work CHARLIE.', 'Next month FOXTROT.', 'Client note BRAVO.',
    ...s.attention.map((a) => a.title), ...s.checklist.map((r) => r.label), ...s.not_verified.map((n) => n.label), ...(s.approvals || []).map((a) => a.title),
    ...(s.work_done || []).map((w) => w.what),
  ]
  for (const p of parts) {
    assert.ok(text.includes(flat(p)), `email has: ${p}`)
    assert.ok(pdf.includes(flat(p)), `PDF has: ${p}`)
  }
  assert.ok(text.includes(flat(s.disclaimer)))
  // Your message comes first, and the email says the PDF is attached with its version.
  assert.ok(text.indexOf('Personal message GOLF.') < text.indexOf(s.headline))
  assert.match(text, new RegExp(`A PDF copy of this report \\(version ${s.version}\\) is attached`))
})
