/**
 * Checkout, invitations, and Stripe's notices, on this machine only: the real
 * Next.js routes, the real Stripe SDK and Resend SDK pointed at local fakes
 * (fake-services.mjs), signed webhooks, and the pending migrations on a
 * throwaway PostgreSQL. Nothing reaches Stripe, Resend, or a shared database.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { available, one, rows, q } from './pg.mjs'
import { startStack, stopStack, api, APP } from './local-stack.mjs'
import { startFakeStripe, startFakeResend, priceObj } from './fake-services.mjs'

const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run these tests)'
const Stripe = createRequire(import.meta.url)('stripe')
const WEBHOOK_SECRET = 'whsec_local_test'
let ids, stripe, resend, bakery

before(async () => {
  if (skip) return
  stripe = await startFakeStripe(55992)
  resend = await startFakeResend(55993)
  // The plans' configured prices: Business matches $129; Premium is $249.
  stripe.prices.price_local_business = priceObj('price_local_business', 12900)
  stripe.prices.price_local_premium = priceObj('price_local_premium', 24900)
  stripe.prices.price_local_essential = priceObj('price_local_essential', 5900)
  ids = await startStack({
    env: {
      STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_API_BASE: 'http://127.0.0.1:55992', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      STRIPE_PRICE_CARE_ESSENTIAL: 'price_local_essential', STRIPE_PRICE_CARE_BUSINESS: 'price_local_business', STRIPE_PRICE_CARE_PREMIUM: 'price_local_premium',
      RESEND_API_KEY: 're_local', RESEND_BASE_URL: 'http://127.0.0.1:55993',
      CARE_EMAIL_ALLOWLIST: 'frontdesk@example.com,owner@example.com', CARE_APP_URL: 'http://localhost:3230',
    },
  })
  bakery = one(`select id from care_sites where label = 'Harbor Street Bakery'`).id
}, { timeout: 240000 })
after(async () => { if (!skip) { await stopStack(); stripe?.server.close(); resend?.server.close() } })

const sessionsCreated = () => stripe.requests.filter((r) => r.method === 'POST' && r.path === '/v1/checkout/sessions')
const site = (id) => one(`select * from care_sites where id = ${q(id)}`)

async function webhook(event) {
  const payload = JSON.stringify(event)
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  const r = await fetch(`${APP}/api/care/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload })
  return { status: r.status, data: await r.json() }
}
const ev = (type, object, id = `evt_local_${Math.random().toString(36).slice(2)}`) => ({ id, object: 'event', type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object } })

test('a Stripe price that differs from the agreed amount blocks checkout and the invitation; nothing is created or sent', { skip }, async () => {
  const pre = await api(`sites/${bakery}/invitation`)
  assert.equal(pre.status, 200)
  assert.equal(pre.data.ok, false)
  assert.equal(pre.data.amount_cents, 23900)
  assert.match(pre.data.blockers.join(' '), /charges \$249 a month, but the agreed price is \$239 a month/)
  const before = sessionsCreated().length
  const co = await api(`sites/${bakery}/checkout`, { method: 'POST', json: {} })
  assert.equal(co.status, 409)
  assert.match(co.data.error, /Checkout is blocked for Harbor Street Bakery/)
  const inv = await api(`sites/${bakery}/invitation`, { method: 'POST', json: { confirm_email: 'owner@example.com' } })
  assert.equal(inv.status, 409)
  assert.equal(sessionsCreated().length, before, 'no checkout session was created')
  assert.equal(resend.emails.length, 0, 'no email was sent')
})

test('currency, interval, trial, and a price Stripe can’t confirm each block checkout', { skip }, async () => {
  const check = async () => (await api(`sites/${ids.site}/invitation`)).data
  const good = stripe.prices.price_local_business
  for (const [bad, expect] of [
    [{ currency: 'eur' }, /in EUR, but the agreed price is in USD/],
    [{ recurring: { ...good.recurring, interval: 'year' } }, /bills every year, not once a month/],
    [{ recurring: { ...good.recurring, interval_count: 3 } }, /bills every 3 months/],
    [{ recurring: { ...good.recurring, trial_period_days: 14 } }, /14 day free trial/],
    [{ active: false }, /archived/],
    [{ livemode: true }, /live price, but Stripe is in test mode/],
  ]) {
    stripe.prices.price_local_business = { ...good, ...bad }
    const d = await check()
    assert.equal(d.ok, false)
    assert.match(d.blockers.join(' '), expect)
  }
  stripe.prices.price_local_business = good
  stripe.failPrices = true
  const d = await check()
  assert.match(d.blockers.join(' '), /couldn’t be checked/)
  const co = await api(`sites/${ids.site}/checkout`, { method: 'POST', json: {} })
  assert.equal(co.status, 409)
  stripe.failPrices = false
  assert.equal(sessionsCreated().length, 0)
})

test('the invitation shows recipient, plan, and recurring amount, needs the typed address, and is sent once per link', { skip }, async () => {
  const pre = (await api(`sites/${ids.site}/invitation`)).data
  assert.equal(pre.ok, true)
  assert.deepEqual([pre.recipient.email, pre.plan.name, pre.amount_cents, pre.currency, pre.interval, pre.check.price.id], ['frontdesk@example.com', 'Business Care', 12900, 'USD', 'month', 'price_local_business'])
  assert.equal((await api(`sites/${ids.site}/invitation`, { method: 'POST', json: { confirm_email: 'someone@example.com' } })).status, 422)

  const sent = await api(`sites/${ids.site}/invitation`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(sent.status, 200, JSON.stringify(sent.data))
  const created = sessionsCreated()
  assert.equal(created.length, 1)
  assert.equal(created[0].form.line_items[0].price, 'price_local_business')
  assert.equal(created[0].form.metadata.care_site_id, ids.site)
  assert.ok(Math.abs(Number(created[0].form.expires_at) - (Date.now() / 1000 + 86100)) < 120, 'the link lasts just under 24 hours')
  assert.equal(resend.emails.length, 1)
  const mail = resend.emails[0]
  assert.equal(mail.to, 'frontdesk@example.com')
  assert.equal(mail.subject, 'Start Website Care for Northside Physio')
  assert.match(mail.text, /Business Care/)
  assert.match(mail.text, /\$129 a month, billed monthly until you cancel/)
  assert.match(mail.text, /https:\/\/checkout\.stripe\.local\/pay\/cs_local_/)
  assert.doesNotMatch(mail.text + mail.subject, /[–—]/, 'no dashes in client text')

  // The same link is not sent twice by accident; Send again resends it without a new session.
  const dup = await api(`sites/${ids.site}/invitation`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(dup.status, 409)
  assert.match(dup.data.error, /already sent/)
  const again = await api(`sites/${ids.site}/invitation`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com', resend: true } })
  assert.equal(again.status, 200)
  assert.equal(again.data.reused_link, true)
  assert.equal(sessionsCreated().length, 1, 'no second checkout session')
  assert.equal(resend.emails.length, 2)
  assert.notEqual(resend.emails[0].idempotencyKey, resend.emails[1].idempotencyKey)
  // The copy link button reuses the same open link too.
  const copy = await api(`sites/${ids.site}/checkout`, { method: 'POST', json: {} })
  assert.equal(copy.data.reused, true)
  assert.equal(sessionsCreated().length, 1)
})

test('an expired link is replaced by a new one; Stripe’s expiry notice marks it expired', { skip }, async () => {
  const s0 = site(ids.site)
  stripe.sessions[s0.checkout_session_id].status = 'expired'
  const r = await webhook(ev('checkout.session.expired', stripe.sessions[s0.checkout_session_id]))
  assert.equal(r.status, 200)
  const s1 = site(ids.site)
  assert.equal(s1.checkout_url, null)
  assert.equal(s1.checkout_session_id, s0.checkout_session_id, 'kept so the page can say it expired')
  const pre = (await api(`sites/${ids.site}/invitation`)).data
  assert.equal(pre.link.open, false)
  const sent = await api(`sites/${ids.site}/invitation`, { method: 'POST', json: { confirm_email: 'frontdesk@example.com' } })
  assert.equal(sent.status, 200)
  assert.equal(sent.data.reused_link, false)
  assert.equal(sessionsCreated().length, 2)
  assert.notEqual(site(ids.site).checkout_session_id, s0.checkout_session_id)
})

test('changing the agreed price closes the open link so the old price can’t be paid', { skip }, async () => {
  const open = site(ids.site).checkout_session_id
  const cur = (await api(`sites/${ids.site}`)).data.site
  const put = await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, agreed_monthly_price: 139 } })
  assert.equal(put.status, 200, JSON.stringify(put.data))
  assert.equal(stripe.sessions[open].status, 'expired')
  assert.equal(site(ids.site).checkout_session_id, null)
  const blocked = (await api(`sites/${ids.site}/invitation`)).data
  assert.match(blocked.blockers.join(' '), /charges \$129 a month, but the agreed price is \$139 a month/)
  await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, agreed_monthly_price: 129 } })
})

test('a subscription Stripe already has for the website blocks another checkout', { skip }, async () => {
  const s = site(ids.site)
  stripe.subscriptions.sub_local_dup = { id: 'sub_local_dup', object: 'subscription', status: 'active', customer: s.stripe_customer_id, metadata: { care_site_id: ids.site, client_id: s.client_id } }
  const co = await api(`sites/${ids.site}/checkout`, { method: 'POST', json: {} })
  assert.equal(co.status, 409)
  assert.match(co.data.error, /Stripe already has a subscription for this website/)
  delete stripe.subscriptions.sub_local_dup
})

test('paid notices: checkout completion links the subscription once; redelivered and repeated notices create no second period, review, or allowance', { skip }, async () => {
  assert.equal((await api(`sites/${ids.site}/checkout`, { method: 'POST', json: {} })).status, 200)
  const s = site(ids.site)
  const start = Math.floor(Date.now() / 1000) + 30 * 86400
  const sub = { id: 'sub_local_1', object: 'subscription', status: 'active', customer: s.stripe_customer_id, metadata: { care_site_id: ids.site, client_id: s.client_id, plan: 'business' }, cancel_at_period_end: false, cancel_at: null, canceled_at: null, ended_at: null,
    items: { data: [{ price: { id: 'price_local_business' }, current_period_start: start, current_period_end: start + 30 * 86400 }] } }
  stripe.subscriptions[sub.id] = sub
  const sess = stripe.sessions[s.checkout_session_id]
  Object.assign(sess, { status: 'complete', subscription: sub.id })
  const inv = { id: 'in_local_1', object: 'invoice', status: 'paid', billing_reason: 'subscription_create', customer: sub.customer, currency: 'usd', amount_paid: 12900, attempt_count: 1,
    parent: { subscription_details: { subscription: sub.id } }, status_transitions: { paid_at: Math.floor(Date.now() / 1000) }, lines: { data: [{ amount: 12900, period: { start, end: start + 30 * 86400 }, pricing: { price_details: { price: 'price_local_business' } } }] } }
  stripe.invoices[inv.id] = inv
  const cycles = () => rows(`select id from care_cycles where site_id = ${q(ids.site)}`).length
  const reports = () => rows(`select r.id from care_reports r join care_cycles c on c.id = r.cycle_id where c.site_id = ${q(ids.site)}`).length
  const before = [cycles(), reports()]

  assert.equal((await webhook(ev('checkout.session.completed', sess))).data.status, 'processed')
  assert.equal(site(ids.site).stripe_subscription_id, sub.id)
  assert.equal(site(ids.site).checkout_url, null, 'the used link is closed')
  const paid = ev('invoice.paid', inv, 'evt_local_paid_1')
  assert.equal((await webhook(paid)).data.status, 'processed')
  assert.deepEqual([cycles(), reports()], [before[0] + 1, before[1] + 1])
  const minutes = one(`select sum(included_minutes)::int as m from care_cycles where site_id = ${q(ids.site)}`).m

  // Stripe retries the same event, and a second event for the same invoice: nothing new.
  assert.equal((await webhook(paid)).data.status, 'duplicate')
  assert.equal((await webhook(ev('invoice.paid', inv))).status, 200)
  assert.deepEqual([cycles(), reports()], [before[0] + 1, before[1] + 1])
  assert.equal(one(`select sum(included_minutes)::int as m from care_cycles where site_id = ${q(ids.site)}`).m, minutes)

  // With a subscription linked, invitations and checkout are refused.
  assert.equal((await api(`sites/${ids.site}/checkout`, { method: 'POST', json: {} })).status, 409)
  assert.equal((await api(`sites/${ids.site}/invitation`)).data.ok, false)
})
