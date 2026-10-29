/**
 * Suggested Report text (src/lib/care/report-draft.ts): accurate drafting,
 * missing results, no claims the records don't support, and private notes
 * never used. Edits, refreshes, and outdated suggestions are covered against
 * the real database in suggestions.test.mjs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const M = await jiti.import(ROOT + 'src/lib/care/report-model.ts')
const { draftReportText, draftSource } = await jiti.import(ROOT + 'src/lib/care/report-draft.ts')

const home = 'https://s.example.com/'
const team = 'https://s.example.com/team'
const pass = (check_key, url = home, viewport = 'desktop') => ({ check_key, status: 'passed', url, viewport, issue_code: 'ok' })
const allPassing = [pass('page_load'), pass('https'), pass('images'), pass('overflow', home, 'mobile'), pass('internal_links', home, null), pass('page_load', team), pass('https', team), pass('images', team), pass('overflow', team, 'mobile')]
const base = {
  reportId: 'r', cycleId: 'c', version: 1, client: { name: 'A', business: 'B' }, recipient: { name: 'A', email: 'a@example.com' }, site: { label: 'S', url: home },
  period: { start: 'x', end: 'y', label: 'November 2026', range: 'November 1 to December 1, 2026' }, reviewDate: 'Mon, November 2, 2026', scanStatus: 'succeeded',
  plan: { id: 'business', name: 'Business Care', includedMinutes: 30, monthlyPrice: 129 }, work: null,
  pages: [{ label: 'Home', url: home }, { label: 'Team', url: team }], destinations: [], findings: allPassing,
  earlierFindings: [], manual: [], notes: [], content: {},
}
const draft = (over = {}) => {
  const input = { ...base, ...over }
  const s = M.buildReport(input)
  return draftReportText(s, input.manual.map((m) => ({ label: m.label, status: m.status })))
}

test('all clear: says so, asks nothing, and lists the checks actually performed', () => {
  const d = draft({ manual: [{ item_id: 'visual', label: 'Desktop appearance looks right', status: 'passed' }] })
  assert.equal(d.summary, 'Everything agreed for this month was checked and passed. Nothing is needed from you this month.')
  assert.match(d.investigated, /^Automated checks opened 2 agreed pages on desktop and phone/)
  assert.match(d.investigated, /Checked by hand: desktop appearance looks right\.$/)
  assert.equal(d.client_notes, '')
  assert.equal(d.fixes, '')
  assert.equal(d.outstanding, '')
})

test('an issue waiting for approval: named, with the next action, and no claim that anything was fixed', () => {
  const findings = [...allPassing.filter((f) => !(f.check_key === 'overflow' && f.url === team)), { check_key: 'overflow', issue_code: 'overflow', status: 'failed', url: team, viewport: 'mobile', evidence: { overflow_px: 212 } }]
  const notes = [{ group_key: 'overflow:overflow', resolution: 'approval', client_note: 'the team section rebuild (estimate below)' }]
  const d = draft({ findings, notes })
  assert.match(d.summary, /^This month’s review found 1 issue\./)
  assert.match(d.summary, /Page doesn’t fit the screen \(Team\) needs your approval before any work begins\./)
  assert.match(d.summary, /Please review the work waiting for your approval below\./)
  assert.doesNotMatch(JSON.stringify(d), /fixed|verified/i)
  assert.match(d.client_notes, /^To approve the team section rebuild \(estimate below\), reply to this email/)
  assert.ok(d.summary.split('. ').length <= 4, 'two or three sentences')
})

test('missing results: a check that didn’t complete and unrecorded hand checks are never reported as passed', () => {
  const d = draft({ findings: [], scanStatus: 'failed', manual: [{ item_id: 'form', label: 'Contact form sends a test message', status: null }, { item_id: 'phone', label: 'Phone layout looks right', status: 'not_checked', reason: 'Client asked to skip' }] })
  assert.match(d.summary, /^The automated check didn’t complete this month/)
  assert.doesNotMatch(d.summary, /passed/)
  assert.equal(d.investigated, '', 'nothing was performed, so nothing is listed')
  assert.doesNotMatch(JSON.stringify(d), /Checked by hand/)
})

test('a fix is only called verified when a verification is recorded', () => {
  const failed = { check_key: 'overflow', issue_code: 'overflow', status: 'failed', url: team, viewport: 'mobile' }
  const findings = [...allPassing.filter((f) => !(f.check_key === 'overflow' && f.url === team)), failed]
  const unverified = draft({ findings, notes: [{ group_key: 'overflow:overflow', resolution: 'fixed', client_note: '' }] })
  assert.doesNotMatch(unverified.summary, /fixed and verified/)
  const verified = draft({ findings, notes: [{ group_key: 'overflow:overflow', resolution: 'fixed', verification_note: 'Rechecked on a phone after the change' }] })
  assert.match(verified.summary, /1 item was fixed and verified\./)
})

test('private notes never become client text', () => {
  const findings = [...allPassing.filter((f) => !(f.check_key === 'overflow' && f.url === team)), { check_key: 'overflow', issue_code: 'overflow', status: 'failed', url: team, viewport: 'mobile' }]
  const notes = [{ group_key: 'overflow:overflow', resolution: 'investigating', client_note: '', internal_note: 'PRIVATE-ISSUE-NOTE' }]
  const manual = [{ item_id: 'visual', label: 'Desktop appearance looks right', status: 'passed', note: 'Fine', internal_note: 'PRIVATE-MANUAL-NOTE' }]
  const input = { ...base, findings, notes, manual, content: { summary: 'x' }, internal_notes: 'PRIVATE-REPORT-NOTE' }
  const s = M.buildReport(input)
  const d = draftReportText(s, manual.map((m) => ({ label: m.label, status: m.status })))
  assert.doesNotMatch(JSON.stringify(d), /PRIVATE/)
  assert.doesNotMatch(draftSource(s, manual), /PRIVATE/)
})

test('the source fingerprint changes when findings, hand checks, work, or estimates change', () => {
  const s1 = M.buildReport(base)
  const s2 = M.buildReport({ ...base, findings: [...allPassing.slice(1), { check_key: 'page_load', status: 'failed', url: home, viewport: 'desktop', issue_code: 'page_error' }] })
  assert.notEqual(draftSource(s1, []), draftSource(s2, []))
  assert.notEqual(draftSource(s1, []), draftSource(s1, [{ label: 'Desktop appearance looks right', status: 'passed' }]))
})
