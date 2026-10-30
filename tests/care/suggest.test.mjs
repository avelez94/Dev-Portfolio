/**
 * Field suggestions across Website Care: they describe only what you already
 * chose, never claim verified work without evidence, and mark hand check
 * claims as needing your confirmation. Pure functions only.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const S = await jiti.import(ROOT + 'src/lib/care/field-suggest.ts')

const g = { title: 'Text runs off the screen', pages: ['Home', 'Team'], devices: ['mobile'], what: 'The team grid is wider than a phone.' }
const all = []
const keep = (x) => { if (x) all.push(x); return x }

test('client notes follow the decision you chose and suggest nothing without one', () => {
  assert.equal(S.issueClientNote(g, null), null)
  assert.match(keep(S.issueClientNote(g, 'approval')).text, /estimate below/)
  assert.match(keep(S.issueClientNote(g, 'fixed')).text, /^Fixed “Text runs off the screen” on Home, Team$/)
  assert.ok(['approval', 'client_input', 'investigating', 'fixed'].every((r) => S.issueClientNote(g, r).needs_confirmation === false))
})

test('a verification note claims a fix was checked only from an automated recheck or with your confirmation', () => {
  assert.equal(S.verificationNote(g, 'approval', { clearedOnRecheck: true }), null, 'nothing to verify before a fix')
  const auto = keep(S.verificationNote(g, 'fixed', { clearedOnRecheck: true, recheckedOn: 'Nov 3, 2026' }))
  assert.equal(auto.needs_confirmation, false)
  assert.match(auto.text, /Rechecked automatically on Nov 3, 2026: no longer found/)
  const hand = keep(S.verificationNote(g, 'fixed', { clearedOnRecheck: false }))
  assert.equal(hand.needs_confirmation, true)
  assert.match(hand.text, /^Checked by hand after the fix on phones/)
})

test('manual suggestions: passed and failed notes need confirmation; skipped reasons claim nothing', () => {
  assert.deepEqual(S.manualSuggestion({ label: 'Booking works', status: null }), {})
  assert.equal(keep(S.manualSuggestion({ label: 'Booking works', status: 'passed' }).note).needs_confirmation, true)
  assert.equal(keep(S.manualSuggestion({ label: 'Booking works', status: 'failed' }).note).needs_confirmation, true)
  const skip = keep(S.manualSuggestion({ label: 'Booking works', status: 'not_checked' }).reason)
  assert.equal(skip.needs_confirmation, false)
  assert.doesNotMatch(skip.text, /checked by hand:/i)
  keep(S.manualSuggestion({ label: 'Booking works', status: 'could_not_check' }).reason)
})

test('needsConfirmation matches only the exact suggested hand check text; your own words pass', () => {
  const hand = S.verificationNote(g, 'fixed', { clearedOnRecheck: false })
  assert.equal(S.needsConfirmation(hand.text, [hand]), true)
  assert.equal(S.needsConfirmation(`  ${hand.text} `, [hand]), true)
  assert.equal(S.needsConfirmation('I resized the grid and looked on my phone.', [hand]), false)
  assert.equal(S.needsConfirmation('', [hand]), false)
  const auto = S.verificationNote(g, 'fixed', { clearedOnRecheck: true })
  assert.equal(S.needsConfirmation(auto.text, [auto]), false)
})

test('work descriptions and estimates describe only what you entered; no prices, dates or approval are invented', () => {
  assert.equal(S.workDescription({ name: '', quantity: 1 }), null)
  const w = keep(S.workDescription({ preset_description: 'Plugin update.', quantity: 3 }, { estimateTitle: 'Speed fixes' }))
  assert.equal(w.text, 'Plugin update (3), for the approved “Speed fixes”.')
  const e = S.estimateFromIssue(g)
  for (const k of ['title', 'scope', 'deliverables', 'schedule']) keep(e[k])
  assert.equal(e.title.text, 'Fix: Text runs off the screen')
  assert.match(e.scope.text, /What the check found: The team grid/)
  assert.doesNotMatch(Object.values(e).map((x) => x.text).join(' '), /\$|\d+ minutes|approved on|\b(Mon|Tue|Wed|Thu|Fri)\w*day\b/)
  assert.match(e.schedule.text, /after you approve/)
})

test('no suggestion uses dashes in client facing text', () => {
  assert.ok(all.length >= 12)
  for (const x of all) assert.doesNotMatch(x.text, /[–—]|\s-\s/, x.text)
})
