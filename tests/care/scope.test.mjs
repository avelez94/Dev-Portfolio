/**
 * Suggested enrollment scope and the manual checks a scope requires, plus the
 * payment to scan pipeline shown in the admin. Pure functions only.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const { requiredChecks, missingRequired, suggestScope } = await jiti.import(ROOT + 'src/lib/care/scope.ts')
const { pipeline } = await jiti.import(ROOT + 'src/lib/care/pipeline.ts')

test('every scope requires the desktop and phone checks; destinations and scope notes add their own', () => {
  assert.deepEqual(requiredChecks({}).map((r) => r.id), ['visual-desktop', 'visual-mobile'])
  const ids = requiredChecks({ destinations: [{ kind: 'booking', url: 'https://b.example.com/', label: 'Book' }, { kind: 'checkout', url: 'https://s.example.com/', label: 'Shop' }], features: 'Contact form and plugin updates' }).map((r) => r.id)
  assert.deepEqual(ids, ['visual-desktop', 'visual-mobile', 'booking', 'contact-form', 'payments', 'updates-backups'])
})

test('missing required checks are matched by id, so a reworded required check still counts', () => {
  const list = [{ id: 'visual-desktop', label: 'Laptop layout', category: 'Look' }, { id: 'visual-mobile', label: 'Phone layout', category: 'Look' }]
  assert.deepEqual(missingRequired({ manual_checklist: list }), [])
  const miss = missingRequired({ manual_checklist: list, destinations: [{ kind: 'booking', url: 'https://b.example.com/', label: 'Book' }] })
  assert.equal(miss.length, 1)
  assert.equal(miss[0].id, 'booking')
  assert.match(miss[0].reason, /doesn’t prove booking works/)
})

test('suggestions add the home page and required checks once, mark what is required, and skip what is already there', () => {
  const s = suggestScope({ site_url: 'https://garden.example.com/gallery', destinations: [{ kind: 'contact', url: 'https://garden.example.com/contact', label: 'Contact' }] })
  assert.deepEqual(s.pages.map((p) => p.url), ['https://garden.example.com/'])
  assert.deepEqual(s.checklist.filter((c) => c.required).map((c) => c.id), ['visual-desktop', 'visual-mobile', 'contact-form'])
  assert.ok(s.checklist.some((c) => c.id === 'content-details' && !c.required))
  const again = suggestScope({ site_url: 'https://garden.example.com/', pages: [{ url: 'https://garden.example.com/', label: 'Home' }] })
  assert.equal(again.pages.length, 0)
})

test('pipeline: payment received, then queued with the dispatch state, running, and the result; holds show why', () => {
  const cycle = { source: 'stripe', paid_at: '2026-11-01T10:00:00Z', created_at: '2026-11-01T10:00:00Z', amount_paid: 12900, currency: 'usd' }
  const held = pipeline({ ...cycle, hold_reason: 'setup_changed', hold_flagged_at: '2026-11-01T10:00:01Z' }, [])
  assert.deepEqual(held.map((s) => [s.label, s.state]), [['Payment received', 'done'], ['On hold: setup changed, confirm it again', 'problem'], ['Running', 'waiting'], ['Completed', 'waiting']])
  const run = { trigger: 'scheduled', created_at: '2026-11-01T10:00:01Z', status: 'queued', dispatch_status: 'failed', dispatch_attempts: 2 }
  assert.equal(pipeline(cycle, [run])[1].state, 'problem')
  assert.match(pipeline(cycle, [run])[1].detail, /retrying \(attempt 2\)/)
  const done = pipeline(cycle, [{ ...run, status: 'succeeded', dispatch_status: 'dispatched', started_at: '2026-11-01T10:01:00Z', finished_at: '2026-11-01T10:03:00Z' }])
  assert.deepEqual(done.map((s) => s.state), ['done', 'done', 'done', 'done'])
  assert.equal(pipeline(cycle, [{ ...run, status: 'failed', error: 'Timed out', finished_at: 'x' }])[3].label, 'Failed')
})
