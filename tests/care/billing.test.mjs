/**
 * The care agreement, payment and the scan it starts, on this machine only:
 * the real Next.js routes, the real Stripe SDK and Resend SDK pointed at
 * local fakes (fake-services.mjs), a fake GitHub dispatch endpoint, signed
 * webhooks, and the pending migrations on a throwaway PostgreSQL. Nothing
 * reaches Stripe, Resend, GitHub, or a shared database.
 *
 * Workflow under test: you confirm the technical scope, the client gets a
 * persistent private agreement link, signs, the signed PDF is stored and
 * emailed, payment unlocks, and a verified successful payment immediately
 * queues and dispatches the scan. Reports are still approved by hand.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { available, one, rows, q, sql } from './pg.mjs'
import { startStack, stopStack, api, APP } from './local-stack.mjs'
import { startFakeStripe, startFakeResend, startFakeGithub, priceObj } from './fake-services.mjs'

const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run these tests)'
const Stripe = createRequire(import.meta.url)('stripe')
const WEBHOOK_SECRET = 'whsec_local_test'
const CRON = 'cron_local_test'
let ids, stripe, resend, github, bakery

before(async () => {
  if (skip) return
  stripe = await startFakeStripe(55992)
  resend = await startFakeResend(55993)
  github = await startFakeGithub(55994)
  // The plans' configured prices: Business matches $129; Premium is $249.
  stripe.prices.price_local_business = priceObj('price_local_business', 12900)
  stripe.prices.price_local_premium = priceObj('price_local_premium', 24900)
  stripe.prices.price_local_essential = priceObj('price_local_essential', 5900)
  ids = await startStack({
    env: {
      STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_API_BASE: 'http://127.0.0.1:55992', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      STRIPE_PRICE_CARE_ESSENTIAL: 'price_local_essential', STRIPE_PRICE_CARE_BUSINESS: 'price_local_business', STRIPE_PRICE_CARE_PREMIUM: 'price_local_premium',
      RESEND_API_KEY: 're_local', RESEND_BASE_URL: 'http://127.0.0.1:55993',
      CARE_GITHUB_DISPATCH_TOKEN: 'gh_local', CARE_GITHUB_REPO: 'local/repo', CARE_GITHUB_API_BASE: 'http://127.0.0.1:55994',
      CRON_SECRET: CRON, CARE_NOTIFY_EMAIL: 'owner@studio.example', CARE_TEST_HOSTS: JSON.stringify({ 'physio.example.com': '93.184.215.14' }),
      CARE_EMAIL_ALLOWLIST: 'frontdesk@example.com,owner@example.com', CARE_APP_URL: 'http://localhost:3230',
    },
  })
  bakery = one(`select id from care_sites where label = 'Harbor Street Bakery'`).id
}, { timeout: 240000 })
after(async () => { if (!skip) { await stopStack(); stripe?.server.close(); resend?.server.close(); github?.server.close() } })

const sessionsCreated = () => stripe.requests.filter((r) => r.method === 'POST' && r.path === '/v1/checkout/sessions')
const site = (id) => one(`select * from care_sites where id = ${q(id)}`)
const pub = async (token, path = '', init = {}) => {
  const r = await fetch(`${APP}/api/care/agreement/${token}${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...(init.headers || {}) }, body: init.json !== undefined ? JSON.stringify(init.json) : undefined })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}
const SIG = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='.repeat(4)
const CHECKS = [
  { id: 'visual-desktop', label: 'Desktop appearance looks right', category: 'Appearance' },
  { id: 'visual-mobile', label: 'Mobile appearance looks right', category: 'Appearance' },
  { id: 'booking', label: 'Booking shows availability and the steps make sense', category: 'Booking' },
]
const CONFIRM = { confirm_website: true, confirm_authorization: true, confirm_checklist: true, authorization_note: 'Signed care authorization, Oct 30' }

async function webhook(event) {
  const payload = JSON.stringify(event)
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  const r = await fetch(`${APP}/api/care/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload })
  return { status: r.status, data: await r.json() }
}
const ev = (type, object, id = `evt_local_${Math.random().toString(36).slice(2)}`) => ({ id, object: 'event', type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object } })
const cron = async () => (await fetch(`${APP}/api/care/cron`, { headers: { authorization: `Bearer ${CRON}` } })).json()
const wait = async (fn, ms = 8000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)) } return fn() }
const runsOf = (cycle) => rows(`select * from care_scan_runs where cycle_id = ${q(cycle)} order by created_at`)
const cyclesOf = (s) => rows(`select * from care_cycles where site_id = ${q(s)} order by period_start`)
const due = (run) => sql(`update care_scan_runs set next_dispatch_at = now() - interval '1 minute' where id = ${q(run)}`)
const ownerMails = (re) => resend.emails.filter((m) => m.to === 'owner@studio.example' && re.test(m.subject))

let token, agreementId, sub, inv1, period

test('the agreement can’t be sent before the technical scope is confirmed, or with a Stripe price that differs from the agreed amount', { skip }, async () => {
  const st = (await api(`sites/${ids.site}/agreement`)).data
  assert.equal(st.state, 'not_ready')
  assert.match(st.problems.join(' '), /Confirm the technical scope again first|Confirm the technical scope first/)
  assert.equal((await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })).status, 409)
  // The bakery's agreed $239 doesn't match the Premium price ($249).
  const b = (await api(`sites/${bakery}/agreement`)).data
  assert.match(b.problems.join(' '), /charges \$249 a month, but the agreed price is \$239 a month/)
  assert.equal((await api(`sites/${bakery}/checkout`, { method: 'POST', json: {} })).status, 409)
  assert.equal(sessionsCreated().length, 0, 'no checkout session was created')
  assert.equal(resend.emails.length, 0, 'no email was sent')
})

test('confirming the scope requires the applicable mandatory manual checks', { skip }, async () => {
  const cur = (await api(`sites/${ids.site}`)).data.site
  const put = await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, manual_checklist: [CHECKS[0]] } })
  assert.equal(put.status, 200, JSON.stringify(put.data))
  const r = await api(`sites/${ids.site}/confirm`, { method: 'POST', json: CONFIRM })
  assert.equal(r.status, 422)
  assert.match(r.data.error, /required manual check “Mobile appearance looks right”/)
  assert.match(r.data.error, /required manual check “Booking shows availability/, 'the booking destination requires the booking check')
  await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, manual_checklist: CHECKS } })
  const ok = await api(`sites/${ids.site}/confirm`, { method: 'POST', json: CONFIRM })
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.equal((await api(`sites/${ids.site}/agreement`)).data.state, 'ready')
})

test('price checks: currency, interval, trial, archived, live mode and an unreachable Stripe each block the agreement', { skip }, async () => {
  const good = stripe.prices.price_local_business
  for (const [bad, expect] of [
    [{ currency: 'eur' }, /in EUR, but the agreed price is in USD/],
    [{ recurring: { ...good.recurring, interval: 'year' } }, /bills every year, not once a month/],
    [{ recurring: { ...good.recurring, trial_period_days: 14 } }, /14 day free trial/],
    [{ active: false }, /archived/],
    [{ livemode: true }, /live price, but Stripe is in test mode/],
  ]) {
    stripe.prices.price_local_business = { ...good, ...bad }
    const d = (await api(`sites/${ids.site}/agreement`)).data
    assert.equal(d.state, 'not_ready')
    assert.match(d.problems.join(' '), expect)
  }
  stripe.prices.price_local_business = good
  stripe.failPrices = true
  assert.match((await api(`sites/${ids.site}/agreement`)).data.problems.join(' '), /couldn’t be checked/)
  stripe.failPrices = false
})

test('the owner sends the persistent private agreement link once; a reminder reuses the same link', { skip }, async () => {
  assert.equal((await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'someone@example.com' } })).status, 422)
  const sent = await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(sent.status, 200, JSON.stringify(sent.data))
  token = site(ids.site).agreement_token
  assert.match(token, /^[A-Za-z0-9_-]{32}$/)
  agreementId = sent.data.agreement_id
  assert.equal(sent.data.link, `http://localhost:3230/care/agreement/${token}`)
  const mail = resend.emails.at(-1)
  assert.equal(mail.to, 'frontdesk@example.com')
  assert.equal(mail.subject, 'Your Website Care agreement for Northside Physio')
  assert.match(mail.text, /Business Care/)
  assert.match(mail.text, /\$129 a month, billed monthly in advance until you cancel/)
  assert.ok(mail.text.includes(`/care/agreement/${token}`))
  assert.match(mail.text, /Your monthly website check is automatically queued when payment is confirmed\./)
  assert.doesNotMatch(mail.text + mail.subject, /[–—]/, 'no dashes in client text')
  assert.equal(sessionsCreated().length, 0, 'no checkout exists before signing')
  const dup = await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(dup.status, 409)
  const again = await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com', resend: true } })
  assert.equal(again.status, 200)
  assert.equal(site(ids.site).agreement_token, token, 'the link never changes')
  assert.equal(again.data.agreement_id, agreementId)
  assert.equal(rows(`select id from care_agreements where site_id = ${q(ids.site)}`).length, 1)
})

test('the client page shows the agreement only; payment stays locked until it is signed', { skip }, async () => {
  assert.equal((await pub('x'.repeat(32))).status, 404)
  const v = await pub(token)
  assert.equal(v.status, 200)
  assert.equal(v.data.step, 'sign')
  const a = v.data.agreement
  assert.equal(a.snapshot.plan.name, 'Business Care')
  assert.equal(a.snapshot.price.amount_cents, 12900)
  assert.deepEqual(a.snapshot.scope.checks.map((c) => c.label), CHECKS.map((c) => c.label))
  assert.ok(a.snapshot.terms.some((t) => t.title === 'Refunds' && /non-refundable after successful payment, except where required by law/.test(t.body.join(' '))))
  assert.ok(a.snapshot.terms.some((t) => t.title === 'Cancelling'))
  assert.doesNotMatch(JSON.stringify(v.data), /signature_image|signer_ip|authorization_note|internal_notes|stripe_customer/)
  assert.ok(one(`select first_viewed_at from care_agreements where id = ${q(agreementId)}`).first_viewed_at, 'the first view is recorded')
  const pay = await pub(token, '/checkout', { method: 'POST' })
  assert.equal(pay.status, 409)
  assert.match(pay.data.error, /Payment opens once the current agreement is signed/)
  assert.equal((await api(`sites/${ids.site}/checkout`, { method: 'POST', json: {} })).status, 409, 'the owner can’t create a payment link before signing either')
  assert.equal(sessionsCreated().length, 0)
})

test('signing needs the exact version, a name, a drawn signature and agreement; the signed PDF is stored and emailed; payment unlocks', { skip }, async () => {
  const a = (await pub(token)).data.agreement
  const base = { agreement_id: a.id, snapshot_hash: a.snapshot_hash, signer_name: 'Sam Patel', signature_image: SIG, agree: true }
  assert.equal((await pub(token, '', { method: 'POST', json: { ...base, agree: false } })).status, 422)
  assert.equal((await pub(token, '', { method: 'POST', json: { ...base, signer_name: '' } })).status, 422)
  assert.equal((await pub(token, '', { method: 'POST', json: { ...base, signature_image: 'nope' } })).status, 422)
  assert.equal((await pub(token, '', { method: 'POST', json: { ...base, snapshot_hash: 'f'.repeat(64) } })).status, 409, 'a stale page can’t sign')
  const before = resend.emails.length
  const ok = await pub(token, '', { method: 'POST', json: base })
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.equal(ok.data.emailed, true)
  const row = one(`select * from care_agreements where id = ${q(a.id)}`)
  assert.equal(row.status, 'signed')
  assert.equal(row.signer_name, 'Sam Patel')
  assert.equal(row.signer_ip, '203.0.113.7')
  assert.match(row.signed_pdf_sha256, /^[0-9a-f]{64}$/)
  assert.equal(row.signed_email_status, 'sent')
  const s = site(ids.site)
  assert.equal(s.care_terms_version, 'care-flex-2026-11', 'signing records the current plan time terms too')
  const mails = resend.emails.slice(before)
  const client = mails.find((m) => m.to === 'frontdesk@example.com')
  const owner = mails.find((m) => m.to === 'owner@studio.example')
  assert.equal(client.subject, 'Your signed Website Care agreement for Northside Physio')
  assert.equal(client.attachments[0].filename, 'Website_Care_Agreement_Northside_Physio.pdf')
  const pdf = Buffer.from(client.attachments[0].content, 'base64')
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.equal(owner.attachments[0].content, client.attachments[0].content, 'the same signed PDF goes to you')
  assert.match(owner.subject, /signed the care agreement/)
  const dl = await fetch(`${APP}/api/care/admin/sites/${ids.site}/agreements/${a.id}/pdf`, { headers: { cookie: 'admin_token=care-local-admin' } })
  assert.equal(dl.status, 200)
  assert.equal(Buffer.from(await dl.arrayBuffer()).toString('base64'), client.attachments[0].content, 'the stored file is the emailed file')
  assert.equal((await pub(token, '', { method: 'POST', json: base })).status, 409, 'signing twice is refused')
  const v = await pub(token)
  assert.equal(v.data.step, 'pay')
  assert.equal((await api(`sites/${ids.site}/agreement`)).data.state, 'signed')
})

test('continue to payment opens a checkout for the verified price; a changed price or scope locks it until a new version is signed', { skip }, async () => {
  const pay = await pub(token, '/checkout', { method: 'POST' })
  assert.equal(pay.status, 200, JSON.stringify(pay.data))
  assert.match(pay.data.url, /^https:\/\/checkout\.stripe\.local\/pay\/cs_local_/)
  const created = sessionsCreated()
  assert.equal(created.length, 1)
  assert.equal(created[0].form.line_items[0].price, 'price_local_business')
  assert.equal(created[0].form.metadata.agreement_id, agreementId)
  assert.match(created[0].form.custom_text.submit.message, /billed monthly in advance.*automatically queued when payment is confirmed.*non-refundable/)
  assert.equal(created[0].form.cancel_url, `http://localhost:3230/care/agreement/${token}`)
  assert.equal((await pub(token, '/checkout', { method: 'POST' })).data.url, pay.data.url, 'the open link is reused')
  assert.equal(sessionsCreated().length, 1)

  const cur = (await api(`sites/${ids.site}`)).data.site
  await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, agreed_monthly_price: 139 } })
  assert.equal(stripe.sessions[pay.data.url.split('/').pop()].status, 'expired', 'the open link for the old price was closed')
  assert.equal(site(ids.site).checkout_session_id, null)
  assert.equal((await pub(token)).data.step, 'unavailable')
  assert.equal((await pub(token, '/checkout', { method: 'POST' })).status, 409)
  assert.equal((await api(`sites/${ids.site}/agreement`)).data.state, 'outdated')
  await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, agreed_monthly_price: 129 } })
  assert.equal((await pub(token)).data.step, 'pay', 'back to the signed price: the signature covers it again')

  // A scope change needs the scope confirmed again and a new signature.
  await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, pages: [...cur.pages, { label: 'Contact', url: 'https://physio.example.com/contact' }] } })
  assert.equal(site(ids.site).enrollment_status, 'draft')
  assert.equal((await pub(token, '/checkout', { method: 'POST' })).status, 409)
  await api(`sites/${ids.site}/confirm`, { method: 'POST', json: CONFIRM })
  assert.equal((await api(`sites/${ids.site}/agreement`)).data.state, 'outdated')
  assert.equal((await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })).status, 200)
  const v2 = (await pub(token)).data
  assert.equal(v2.step, 'sign')
  assert.notEqual(v2.agreement.id, agreementId)
  assert.equal(v2.agreement.snapshot.scope.pages.length, cur.pages.length + 1)
  assert.equal((await pub(token, '', { method: 'POST', json: { agreement_id: v2.agreement.id, snapshot_hash: v2.agreement.snapshot_hash, signer_name: 'Sam Patel', signature_image: SIG, agree: true } })).status, 200)
  agreementId = v2.agreement.id
  assert.equal(one(`select status from care_agreements where site_id = ${q(ids.site)} order by issued_at limit 1`).status, 'signed', 'the earlier signed version is kept as signed')
  assert.equal((await pub(token, '/checkout', { method: 'POST' })).status, 200)
})

test('the owner can turn the private link off or replace it: old links are refused everywhere, open checkouts are closed, and nothing is signed again', { skip }, async () => {
  const old = token
  const sess1 = site(ids.site).checkout_session_id
  assert.ok(sess1 && stripe.sessions[sess1].status === 'open', 'a checkout is open from the current link')
  const signedBefore = one(`select id, signed_pdf_sha256, signed_at from care_agreements where id = ${q(agreementId)}`)
  const agreementsBefore = rows(`select id from care_agreements where site_id = ${q(ids.site)}`).length
  assert.equal((await api(`sites/${ids.site}/agreement/revoke`, { method: 'POST', json: { reason: 'Sent to the wrong person' } })).status, 422, 'needs explicit confirmation')
  assert.equal((await api(`sites/${ids.site}/agreement/revoke`, { method: 'POST', json: { reason: '', confirm: true } })).status, 422, 'needs a reason')
  const off = await api(`sites/${ids.site}/agreement/revoke`, { method: 'POST', json: { reason: 'Sent to the wrong person', confirm: true } })
  assert.equal(off.status, 200, JSON.stringify(off.data))
  assert.equal(off.data.closed_checkout, true)
  assert.equal(stripe.sessions[sess1].status, 'expired', 'the open checkout from the revoked link was closed in Stripe')
  assert.equal(site(ids.site).checkout_session_id, null)
  // Refused for viewing, signing and payment, without revealing anything.
  const v = await pub(old)
  assert.equal(v.status, 410)
  assert.match(v.data.error, /no longer active/)
  assert.equal(v.data.agreement, undefined)
  assert.equal((await pub(old, '', { method: 'POST', json: { agreement_id: agreementId, snapshot_hash: 'x', signer_name: 'Someone', signature_image: SIG, agree: true } })).status, 410)
  const n = sessionsCreated().length
  assert.equal((await pub(old, '/checkout', { method: 'POST' })).status, 410)
  assert.equal(sessionsCreated().length, n, 'no checkout is created from a revoked link')
  const st = (await api(`sites/${ids.site}/agreement`)).data
  assert.equal(st.link, null)
  assert.equal(st.link_off, true)
  assert.equal(st.state, 'signed', 'the signature still stands')
  const blocked = await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(blocked.status, 409)
  assert.match(blocked.data.error, /turned off/, 'sending never issues a new link by itself')
  assert.equal(site(ids.site).agreement_token, null)

  // Replace: a new private link for the same signed agreement.
  const rep = await api(`sites/${ids.site}/agreement/replace`, { method: 'POST', json: { reason: 'New contact at the clinic' } })
  assert.equal(rep.status, 200, JSON.stringify(rep.data))
  token = site(ids.site).agreement_token
  assert.match(token, /^[A-Za-z0-9_-]{32}$/)
  assert.notEqual(token, old)
  const nv = await pub(token)
  assert.equal(nv.data.step, 'pay', 'payment stays unlocked; no new signature because the link changed')
  assert.equal(nv.data.agreement.id, agreementId)
  assert.equal(rows(`select id from care_agreements where site_id = ${q(ids.site)}`).length, agreementsBefore, 'no new version')
  assert.deepEqual(one(`select id, signed_pdf_sha256, signed_at from care_agreements where id = ${q(agreementId)}`), signedBefore, 'the signed agreement and its PDF are untouched')
  assert.equal((await pub(old)).status, 410, 'the old link stays refused')
  // The new link is sent with copy that says nothing needs signing again.
  const sent = await api(`sites/${ids.site}/agreement`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(sent.status, 200, JSON.stringify(sent.data))
  const mail = resend.emails.at(-1)
  assert.equal(mail.subject, 'Your new Website Care link for Northside Physio')
  assert.ok(mail.text.includes(`/care/agreement/${token}`) && !mail.text.includes(old))
  assert.match(mail.text, /earlier link no longer works.*nothing needs to be signed again/s)
  assert.doesNotMatch(mail.text + mail.subject, /[–—]/)
  const pay2 = await pub(token, '/checkout', { method: 'POST' })
  assert.equal(pay2.status, 200)
  const sess2 = site(ids.site).checkout_session_id
  assert.equal(stripe.sessions[sess2].cancel_url, `http://localhost:3230/care/agreement/${token}`)

  // Replacing an active link closes its open checkout too.
  const mid = token
  assert.equal((await api(`sites/${ids.site}/agreement/replace`, { method: 'POST', json: { reason: 'Rotating the link' } })).status, 200)
  token = site(ids.site).agreement_token
  assert.equal(stripe.sessions[sess2].status, 'expired')
  assert.equal((await pub(mid, '/checkout', { method: 'POST' })).status, 410)
  assert.equal((await pub(token, '/checkout', { method: 'POST' })).status, 200)

  // History: every link, who turned it off and why, and which checkout was closed.
  const links = (await api(`sites/${ids.site}/agreement`)).data.links
  assert.equal(links.length, 3)
  assert.deepEqual(links.map((l) => l.status), ['active', 'revoked', 'revoked'])
  assert.ok(links.every((l) => l.token.length === 7), 'tokens are only shown by their last characters')
  assert.equal(links[2].revoked_reason, 'Sent to the wrong person')
  assert.equal(links[2].closed_checkout_session, sess1)
  assert.equal(links[1].closed_checkout_session, sess2)
  assert.ok(links[2].replaced_by && links[1].replaced_by)
  const acts = rows(`select action from care_activity where site_id = ${q(ids.site)} and action like 'agreement_link%'`).map((r) => r.action)
  for (const a of ['agreement_link_revoked', 'agreement_link_replaced', 'agreement_link_sent']) assert.ok(acts.includes(a), a)
})

test('the client’s Documents list shows their signed care agreements by client id, with the stored PDF; unlinked records are flagged, not attributed', { skip }, async () => {
  const clientId = site(ids.site).client_id
  const r = await api(`clients/${clientId}/documents`)
  assert.equal(r.status, 200, JSON.stringify(r.data))
  const ag = r.data.documents.filter((x) => x.kind === 'care_agreement')
  const signed = rows(`select id from care_agreements where site_id = ${q(ids.site)} and signed_at is not null`)
  assert.equal(ag.length, signed.length, 'every signed version is listed; unsigned replaced versions are not')
  assert.ok(ag.every((x) => x.client_id === undefined && x.site_label === 'Northside Physio'))
  const cur = ag.find((x) => x.id === agreementId)
  assert.match(cur.status, /^Signed by Sam Patel/)
  const dl = await fetch(`${APP}${cur.pdf}`, { headers: { cookie: 'admin_token=care-local-admin' } })
  assert.equal(dl.status, 200)
  const bytes = Buffer.from(await dl.arrayBuffer())
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), one(`select signed_pdf_sha256 from care_agreements where id = ${q(agreementId)}`).signed_pdf_sha256, 'the stored signed file')
  assert.deepEqual(r.data.sites.map((x) => x.id), [ids.site])
  assert.deepEqual(r.data.unlinked, [])
  // Another client sees none of these.
  const other = one(`insert into clients (name, email) values ('Other Client', 'other@example.com') returning id`).id
  assert.deepEqual((await api(`clients/${other}/documents`)).data.documents, [])
  // A record without a client id is flagged for checking, not listed as theirs.
  sql(`update care_agreements set client_id = null where id = ${q(agreementId)}`)
  const u = (await api(`clients/${clientId}/documents`)).data
  assert.ok(!u.documents.some((x) => x.id === agreementId))
  assert.equal(u.unlinked.length, 1)
  assert.match(u.unlinked[0].reason, /no client id recorded/)
  sql(`update care_agreements set client_id = ${q(clientId)} where id = ${q(agreementId)}`)
  assert.equal((await api(`clients/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}/documents`)).status, 404)
  // Every agreement version can be opened as the client read it; signed ones download their stored PDF.
  const st = (await api(`sites/${ids.site}/agreement`)).data
  const first = st.history.at(-1)
  assert.equal(first.status, 'signed')
  assert.equal(first.has_pdf, true)
  assert.notEqual(first.id, agreementId, 'the earlier signed version')
  const v = await api(`sites/${ids.site}/agreements/${first.id}`)
  assert.equal(v.status, 200)
  assert.equal(v.data.signer_name, 'Sam Patel')
  assert.equal(v.data.snapshot.price.amount_cents, 12900)
  assert.equal(v.data.pdf, `/api/care/admin/sites/${ids.site}/agreements/${first.id}/pdf`)
  assert.doesNotMatch(JSON.stringify(v.data), /signature_image|signer_ip|signed_pdf_path/)
  assert.equal((await fetch(`${APP}${v.data.pdf}`, { headers: { cookie: 'admin_token=care-local-admin' } })).status, 200)
  assert.equal((await api(`sites/${bakery}/agreements/${first.id}`)).status, 404, 'only through its own website')
})

test('a verified successful payment immediately queues and dispatches the scan; redelivered and out of order notices add nothing', { skip }, async () => {
  const s = site(ids.site)
  const start = Math.floor(Date.now() / 1000) - 60
  period = [start, start + 30 * 86400]
  sub = { id: 'sub_local_1', object: 'subscription', status: 'active', customer: s.stripe_customer_id, metadata: { care_site_id: ids.site, client_id: s.client_id, plan: 'business' }, cancel_at_period_end: false, cancel_at: null, canceled_at: null, ended_at: null,
    items: { data: [{ price: { id: 'price_local_business' }, current_period_start: period[0], current_period_end: period[1] }] } }
  stripe.subscriptions[sub.id] = sub
  const sess = stripe.sessions[s.checkout_session_id]
  Object.assign(sess, { status: 'complete', subscription: sub.id })
  inv1 = { id: 'in_local_1', object: 'invoice', status: 'paid', billing_reason: 'subscription_create', customer: sub.customer, currency: 'usd', amount_paid: 12900, attempt_count: 1,
    parent: { subscription_details: { subscription: sub.id } }, status_transitions: { paid_at: Math.floor(Date.now() / 1000) }, lines: { data: [{ amount: 12900, period: { start: period[0], end: period[1] }, pricing: { price_details: { price: 'price_local_business' } } }] } }
  stripe.invoices[inv1.id] = inv1
  const before = cyclesOf(ids.site).length
  const d0 = github.dispatches.length
  // invoice.paid first (out of order), then checkout completion.
  const paid = ev('invoice.paid', inv1, 'evt_local_paid_1')
  assert.equal((await webhook(paid)).data.status, 'processed')
  assert.equal((await webhook(ev('checkout.session.completed', sess))).data.status, 'processed')
  const cyc = cyclesOf(ids.site).filter((c) => c.stripe_invoice_id === 'in_local_1')
  assert.equal(cyc.length, 1)
  assert.equal(cyclesOf(ids.site).length, before + 1)
  assert.equal(cyc[0].included_minutes, 30)
  assert.equal(cyc[0].hold_reason, null)
  const run = await wait(() => { const r = runsOf(cyc[0].id); return r.length && r[0].dispatch_status === 'dispatched' ? r : null })
  assert.ok(run, JSON.stringify(runsOf(cyc[0].id)))
  assert.equal(run.length, 1)
  assert.equal(run[0].trigger, 'scheduled')
  assert.equal(run[0].status, 'queued')
  assert.ok(new Date(run[0].available_at) <= new Date(), 'available now, not at a later scheduled time')
  assert.equal(github.dispatches.length, d0 + 1, 'the runner was asked to start straight from the webhook')
  assert.equal(site(ids.site).checkout_url, null, 'the used link is closed')
  // Retries of the same event and another event for the same invoice: nothing new.
  assert.equal((await webhook(paid)).data.status, 'duplicate')
  assert.equal((await webhook(ev('invoice.paid', inv1))).status, 200)
  await new Promise((r) => setTimeout(r, 500))
  assert.equal(cyclesOf(ids.site).length, before + 1)
  assert.equal(runsOf(cyc[0].id).length, 1)
  assert.equal(github.dispatches.length, d0 + 1)
  // Admin shows payment received and the scan queued with the runner started.
  const view = (await api(`cycles/${cyc[0].id}`)).data
  assert.deepEqual(view.pipeline.map((p) => p.label), ['Payment received', 'Scan queued', 'Running', 'Completed'])
  assert.equal(view.pipeline[1].detail, 'runner started')
  const cal = (await api('calendar')).data.items.find((i) => i.id === cyc[0].id)
  assert.equal(cal.status, 'Paid, check queued')
  // Paid and subscribed: the client page says so and payment can't start again.
  assert.equal((await pub(token)).data.step, 'active')
  assert.equal((await pub(token, '/checkout', { method: 'POST' })).status, 409)
  // Nothing is sent to the client automatically.
  assert.equal(rows(`select id from care_report_sends`).length, 0)
  assert.equal(one(`select status from care_reports where cycle_id = ${q(cyc[0].id)}`).status, 'draft')
})

const renewal = (n, o = {}) => {
  const start = period[1] + (n - 1) * 30 * 86400
  const inv = { id: `in_local_r${n}`, object: 'invoice', status: 'paid', billing_reason: 'subscription_cycle', customer: sub.customer, currency: 'usd', amount_paid: 12900, attempt_count: 1,
    parent: { subscription_details: { subscription: sub.id } }, status_transitions: { paid_at: Math.floor(Date.now() / 1000) }, lines: { data: [{ amount: 12900, period: { start, end: start + 30 * 86400 }, pricing: { price_details: { price: 'price_local_business' } } }] }, ...o }
  stripe.invoices[inv.id] = inv
  return inv
}

test('a renewal queues and dispatches its own scan; a failed dispatch is kept, retried with backoff by the recovery tick, and recovers', { skip }, async () => {
  github.failTimes = 2
  const inv = renewal(1)
  assert.equal((await webhook(ev('invoice.paid', inv))).data.status, 'processed')
  const cyc = cyclesOf(ids.site).find((c) => c.stripe_invoice_id === inv.id)
  assert.ok(cyc)
  const r1 = await wait(() => { const r = runsOf(cyc.id)[0]; return r && r.dispatch_status === 'failed' ? r : null })
  assert.ok(r1, 'the first dispatch failed and was recorded')
  assert.equal(r1.status, 'queued', 'the paid review and its scan are kept')
  assert.match(r1.dispatch_error, /GitHub answered 503/)
  await cron()
  assert.equal(runsOf(cyc.id)[0].dispatch_attempts, 1, 'not retried before the backoff is due')
  due(r1.id); await cron()
  assert.equal(runsOf(cyc.id)[0].dispatch_attempts, 2)
  due(r1.id); await cron()
  const r3 = runsOf(cyc.id)[0]
  assert.equal(r3.dispatch_status, 'dispatched')
  assert.equal(r3.dispatch_attempts, 3)
  assert.equal(ownerMails(/couldn’t be started/).length, 0)
  // Dispatched but never picked up: dispatched again after the stale window.
  sql(`update care_scan_runs set dispatched_at = now() - interval '2 hours' where id = ${q(r1.id)}`)
  await cron()
  assert.equal(runsOf(cyc.id)[0].dispatch_attempts, 4)
})

test('a dispatch that keeps failing stops after five attempts, tells you once, and can be retried by hand', { skip }, async () => {
  github.fail = true
  const inv = renewal(2)
  await webhook(ev('invoice.paid', inv))
  const cyc = cyclesOf(ids.site).find((c) => c.stripe_invoice_id === inv.id)
  const r = await wait(() => { const x = runsOf(cyc.id)[0]; return x && x.dispatch_status === 'failed' ? x : null })
  for (let i = 0; i < 6; i++) { due(r.id); await cron() }
  const b = runsOf(cyc.id)[0]
  assert.equal(b.dispatch_status, 'blocked')
  assert.equal(b.dispatch_attempts, 5)
  assert.equal(b.status, 'queued')
  assert.equal(ownerMails(/couldn’t be started/).length, 1)
  due(r.id); await cron()
  assert.equal(runsOf(cyc.id)[0].dispatch_attempts, 5, 'blocked stops retrying')
  assert.ok((await api('overview')).data.blockedRuns.some((x) => x.id === r.id))
  github.fail = false
  const retry = await api(`cycles/${cyc.id}/dispatch`, { method: 'POST', json: {} })
  assert.equal(retry.data.result, 'dispatched')
  assert.equal(rows(`select id from care_scan_runs where cycle_id = ${q(cyc.id)} and trigger = 'scheduled'`).length, 1, 'one initial scan per paid period')
})

test('a renewal while the scope needs confirming again, or care is paused, is kept, held and flagged at once; never scanned', { skip }, async () => {
  const cur = (await api(`sites/${ids.site}`)).data.site
  await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, pages: [...cur.pages, { label: 'Fees', url: 'https://physio.example.com/fees' }] } })
  const inv = renewal(3)
  await webhook(ev('invoice.paid', inv))
  const cyc = cyclesOf(ids.site).find((c) => c.stripe_invoice_id === inv.id)
  assert.equal(cyc.hold_reason, 'setup_changed')
  assert.ok(cyc.hold_flagged_at)
  assert.equal(runsOf(cyc.id).length, 0)
  assert.equal(ownerMails(/is on hold/).length, 1)
  assert.ok((await api('overview')).data.heldCycles.some((c) => c.id === cyc.id))
  assert.equal((await api(`cycles/${cyc.id}/rerun`, { method: 'POST', json: {} })).status, 409)
  await cron()
  assert.equal(runsOf(cyc.id).length, 0, 'the recovery tick never scans a held review')
  const conf = await api(`sites/${ids.site}/confirm`, { method: 'POST', json: CONFIRM })
  assert.equal(conf.data.released, 1)
  assert.ok(await wait(() => runsOf(cyc.id)[0]?.dispatch_status === 'dispatched'))

  await api(`sites/${ids.site}/pause`, { method: 'POST', json: {} })
  const inv2 = renewal(4)
  await webhook(ev('invoice.paid', inv2))
  const c2 = cyclesOf(ids.site).find((c) => c.stripe_invoice_id === inv2.id)
  assert.equal(c2.hold_reason, 'paused')
  assert.equal(ownerMails(/is on hold/).length, 2)
  await api(`sites/${ids.site}/resume`, { method: 'POST', json: {} })
  assert.ok(await wait(() => runsOf(c2.id).length === 1 && runsOf(c2.id)[0].dispatch_status === 'dispatched'))
})

test('failed and incomplete payments never create a review or a scan', { skip }, async () => {
  const before = [cyclesOf(ids.site).length, github.dispatches.length]
  const open = renewal(5, { status: 'open', amount_paid: 0, attempt_count: 1 })
  assert.equal((await webhook(ev('invoice.payment_failed', open))).status, 200)
  // A paid notice for an invoice Stripe still shows as open is ignored (Stripe is re-read).
  assert.equal((await webhook(ev('invoice.paid', open))).data.status, 'ignored')
  assert.deepEqual([cyclesOf(ids.site).length, github.dispatches.length], before)
})

test('a duplicate charge for a paid period creates nothing and is flagged for you to correct', { skip }, async () => {
  const before = cyclesOf(ids.site).length
  const dupe = { ...inv1, id: 'in_local_dupe' }
  stripe.invoices[dupe.id] = dupe
  await webhook(ev('invoice.paid', dupe))
  assert.equal(cyclesOf(ids.site).length, before)
  assert.ok(resend.emails.some((m) => m.to === 'owner@studio.example' && /Possible duplicate charge/.test(m.html)))
})

test('cancelling at the end of the period keeps the paid review; the approved policy is in the notice', { skip }, async () => {
  sub.cancel_at_period_end = true
  await webhook(ev('customer.subscription.updated', sub))
  assert.equal(site(ids.site).billing_state, 'canceling')
  assert.ok(resend.emails.some((m) => m.to === 'owner@studio.example' && /stays available until it ends, with no prorated refund/.test(m.html)))
  assert.ok(cyclesOf(ids.site).every((c) => c.billing_flag === null || c.billing_flag === undefined))
})
