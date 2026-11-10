/**
 * Website Care released before Stripe is connected: agreements are sent and
 * signed and their PDFs stored, while checkout, subscriptions and billing
 * management are refused server side with a clear message. Nothing is ever
 * marked paid, no paid period is created and no check starts without a
 * verified payment. The public site and admin keep working.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { available, one, rows, q } from './pg.mjs'
import { startStack, stopStack, api, APP } from './local-stack.mjs'
import { startFakeResend } from './fake-services.mjs'

const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run these tests)'
let ids, resend
before(async () => {
  if (skip) return
  resend = await startFakeResend(55983)
  ids = await startStack({
    env: {
      STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '',
      RESEND_API_KEY: 're_local', RESEND_BASE_URL: 'http://127.0.0.1:55983',
      CARE_NOTIFY_EMAIL: 'owner@studio.example', CARE_TEST_HOSTS: JSON.stringify({ 'physio.example.com': '93.184.215.14' }),
      CARE_EMAIL_ALLOWLIST: 'frontdesk@example.com', CARE_APP_URL: 'http://localhost:3230',
    },
  })
}, { timeout: 240000 })
after(async () => { if (!skip) { await stopStack(); resend?.server.close() } })

const SIG = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='.repeat(4)
const CHECKS = [
  { id: 'visual-desktop', label: 'Desktop appearance looks right', category: 'Appearance' },
  { id: 'visual-mobile', label: 'Mobile appearance looks right', category: 'Appearance' },
  { id: 'booking', label: 'Booking shows availability and the steps make sense', category: 'Booking' },
]
const pub = async (token, path = '', init = {}) => {
  const r = await fetch(`${APP}/api/care/agreement/${token}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) }, body: init.json !== undefined ? JSON.stringify(init.json) : undefined })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}

test('without Stripe: agreements are sent, signed and stored; checkout, subscriptions and billing stay off; nothing becomes paid', { skip }, async () => {
  const st = (await api('status')).data
  assert.equal(st.stripe.mode, 'missing')
  assert.equal(st.stripe.configured, false)
  const cyclesBefore = rows(`select id from care_cycles where site_id = ${q(ids.site)}`).length
  const runsBefore = rows(`select id from care_scan_runs`).length

  const cur = (await api(`sites/${ids.site}`)).data.site
  assert.equal((await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, manual_checklist: CHECKS } })).status, 200)
  const conf = await api(`sites/${ids.site}/confirm`, { method: 'POST', json: { confirm_website: true, confirm_authorization: true, confirm_checklist: true, authorization_note: 'Written authorization, Oct 30' } })
  assert.equal(conf.status, 200, JSON.stringify(conf.data))
  const ag = (await api(`sites/${ids.site}/agreement`)).data
  assert.equal(ag.state, 'ready', JSON.stringify(ag.problems))
  assert.deepEqual(ag.payment, { open: false, message: 'Online payment isn’t connected yet. Signed agreements are kept, and payment opens once Stripe is connected.' })

  const sent = await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(sent.status, 200, JSON.stringify(sent.data))
  const mail = resend.emails.at(-1)
  assert.match(mail.text, /Signing doesn’t charge anything; online payment opens later/)
  assert.doesNotMatch(mail.text + mail.subject, /[–—]/)
  const token = one(`select agreement_token from care_sites where id = ${q(ids.site)}`).agreement_token
  const v = await pub(token)
  assert.equal(v.data.step, 'sign')
  assert.equal(v.data.payment_open, false)
  const signed = await pub(token, '', { method: 'POST', json: { agreement_id: v.data.agreement.id, snapshot_hash: v.data.agreement.snapshot_hash, signer_name: 'Sam Patel', signature_image: SIG, agree: true } })
  assert.equal(signed.status, 200, JSON.stringify(signed.data))
  assert.equal(signed.data.emailed, true)
  const copy = resend.emails.find((m) => m.subject === 'Your signed Website Care agreement for Northside Physio')
  assert.ok(copy.attachments?.length === 1, 'the signed PDF is attached')
  assert.match(copy.text, /Online payment isn’t open yet, so nothing has been charged/)
  assert.doesNotMatch(copy.text, /Continue to Payment/)
  const row = one(`select status, signed_pdf_path, signed_pdf_sha256 from care_agreements where site_id = ${q(ids.site)}`)
  assert.equal(row.status, 'signed')
  assert.match(row.signed_pdf_sha256, /^[0-9a-f]{64}$/)
  const dl = await fetch(`${APP}/api/care/admin/sites/${ids.site}/agreements/${v.data.agreement.id}/pdf`, { headers: { cookie: 'admin_token=care-local-admin' } })
  assert.equal(dl.status, 200)
  assert.equal(Buffer.from(await dl.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')
  assert.equal((await fetch(`${APP}/api/care/admin/sites/${ids.site}/agreements/${v.data.agreement.id}/pdf`)).status, 401, 'signed PDFs need the admin sign in')

  // Payment stays off everywhere, with a clear message.
  const after = await pub(token)
  assert.equal(after.data.step, 'pay')
  assert.equal(after.data.payment_open, false)
  const pay = await pub(token, '/checkout', { method: 'POST' })
  assert.equal(pay.status, 503)
  assert.match(pay.data.error, /Online payment isn’t open yet. Your signed agreement is on file/)
  const own = await api(`sites/${ids.site}/checkout`, { method: 'POST', json: {} })
  assert.equal(own.status, 503)
  assert.match(own.data.error, /Online payment isn’t connected yet/)
  assert.equal((await api(`sites/${ids.site}/portal`, { method: 'POST', json: {} })).status >= 400, true)
  // A forged billing notice is refused without a webhook secret.
  const wh = await fetch(`${APP}/api/care/stripe/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=forged' }, body: JSON.stringify({ id: 'evt_x', type: 'invoice.paid', data: { object: {} } }) })
  assert.ok(wh.status >= 400)
  // Nothing became paid and no check started.
  const s = one(`select billing_state, stripe_subscription_id, paid_through from care_sites where id = ${q(ids.site)}`)
  assert.equal(s.stripe_subscription_id, null)
  assert.equal(s.paid_through, null)
  assert.notEqual(s.billing_state, 'active')
  assert.equal(rows(`select id from care_cycles where site_id = ${q(ids.site)}`).length, cyclesBefore)
  assert.equal(rows(`select id from care_scan_runs`).length, runsBefore)
  // The client's documents list the signed agreement; the public site and admin keep working.
  const docs = (await api(`clients/${ids.client}/documents`)).data
  assert.ok(docs.documents.some((d) => d.kind === 'care_agreement' && /Signed by Sam Patel/.test(d.status)))
  for (const path of ['/', '/care', '/care/terms']) assert.equal((await fetch(APP + path)).status, 200, path)
  assert.equal((await api('overview')).status, 200)
})
