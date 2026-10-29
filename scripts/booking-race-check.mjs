#!/usr/bin/env node
/**
 * Preview only: checks that the database refuses double bookings.
 *
 *   node scripts/booking-race-check.mjs https://<preview-url> you+race@yourdomain.com
 *
 * Creates N test leads through the public questionnaire API (all using the email
 * you pass, plus a +tag), then sends N booking requests for the same time at the
 * same moment. Expect exactly one success. Afterwards, cancel the test booking and
 * delete the test leads and Zoom meeting.
 *
 * Refuses to run against the production domain.
 */
const [base, email] = process.argv.slice(2)
// The questionnaire allows 5 submissions per IP every 10 minutes.
const N = Math.min(Number(process.env.N || 5), 5)
if (!base || !email) {
  console.error('Usage: node scripts/booking-race-check.mjs <preview-url> <your-test-email>')
  process.exit(1)
}
if (/(^|\.)alantevelez\.com$/i.test(new URL(base).hostname)) {
  console.error('Refusing to run against the production domain.')
  process.exit(1)
}
const [user, domain] = email.split('@')
const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))

const leads = []
for (let i = 0; i < N; i++) {
  const r = await post('/api/intake/submit', { source: 'questionnaire', name: `Race Test ${i + 1}`, email: `${user}+race${i + 1}@${domain}`, type: 'Not sure yet', description: 'Automated double booking check. Please ignore.', heard: 'Other', elapsed_ms: 9000 })
  if (r.status !== 200 || !r.body.id) throw new Error(`Could not create test lead ${i + 1}: ${r.status} ${JSON.stringify(r.body)}`)
  leads.push(r.body.id)
}
const d0 = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)
const d1 = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10)
const { slots } = await fetch(`${base}/api/availability?start=${d0}&end=${d1}`).then((r) => r.json())
if (!slots?.length) throw new Error('No open times to test with')
const slot = slots[slots.length - 1]
console.log(`Racing ${N} requests for ${slot}`)
const results = await Promise.all(leads.map((intakeId) => post('/api/bookings', { intakeId, scheduledAt: slot })))
const codes = results.map((r) => r.status).sort()
console.log('Responses:', codes.join(', '))
const ok = codes.filter((c) => c === 200).length === 1 && codes.filter((c) => c === 409).length === N - 1
console.log(ok ? 'PASS: exactly one booking' : 'FAIL: expected one 200 and the rest 409')
console.log('Clean up: cancel the booking at', slot, 'and delete leads', leads.join(', '))
process.exit(ok ? 0 : 1)
