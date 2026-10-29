// Local stand ins for Website Care tests, on one port (4040):
//   /rest/v1/*      -> PostgREST (real Postgres, care_test database)
//   /storage/v1/*   -> in memory object storage
//   /emails         -> fake Resend (records messages, can fail on demand)
//   /v1/*           -> stateful fake Stripe API (records every call)
//   /repos/*        -> fake GitHub workflow dispatch
//   /__*            -> test controls
import http from 'node:http'
import crypto from 'node:crypto'

const REST = { host: '127.0.0.1', port: Number(process.env.POSTGREST_PORT || 55434) }
const objects = new Map()
let emails = []
let mode = { failEmail: false, failEmailTimes: 0, failDispatch: false, failDispatchTimes: 0, tosMissing: false }
let dispatches = []
const stripeCalls = []
const S = { customers: {}, sessions: {}, subs: {}, invoices: {}, charges: {}, invoicePayments: [], portalConfigs: {}, n: 0 }
const id = (p) => `${p}_${(++S.n).toString(36).padStart(6, '0')}${crypto.randomBytes(3).toString('hex')}`
const nowSec = () => Math.floor(Date.now() / 1000)
let events = []

function send(res, status, body, headers = {}) {
  const b = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)
  res.writeHead(status, { 'content-type': typeof body === 'string' || Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json', ...headers })
  res.end(b)
}
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))) })

// Stripe form encoding: a[b][0][c]=x
function parseForm(s) {
  const out = {}
  for (const pair of s.split('&').filter(Boolean)) {
    const [k, v = ''] = pair.split('=').map((x) => decodeURIComponent(x.replace(/\+/g, ' ')))
    const keys = k.replace(/\]/g, '').split('[')
    let o = out
    keys.forEach((key, i) => {
      if (i === keys.length - 1) o[key] = v
      else o = o[key] ??= /^\d+$/.test(keys[i + 1]) ? [] : {}
    })
  }
  return out
}

function emit(type, object, extra = {}) {
  const e = { id: id('evt'), object: 'event', api_version: '2026-09-30.endive', created: extra.created ?? nowSec(), livemode: false, type, data: { object: JSON.parse(JSON.stringify(object)) }, pending_webhooks: 1 }
  events.push(e)
  return e
}

const addMonth = (t) => { const d = new Date(t * 1000); d.setUTCMonth(d.getUTCMonth() + 1); return Math.floor(d.getTime() / 1000) }

function makeInvoice(sub, { reason, start, end, paid, price, amount = 5900, oneOff = false }) {
  const inv = {
    id: id('in'), object: 'invoice', customer: sub?.customer ?? oneOff, status: paid ? 'paid' : 'open', billing_reason: reason, amount_paid: paid ? amount : 0, amount_due: amount, currency: 'usd',
    attempt_count: paid ? 1 : 1, period_start: start, period_end: end,
    status_transitions: { paid_at: paid ? nowSec() : null },
    parent: sub ? { type: 'subscription_details', subscription_details: { subscription: sub.id, metadata: sub.metadata } } : null,
    lines: { object: 'list', data: [{ id: id('il'), object: 'line_item', amount, period: { start, end }, pricing: { type: 'price_details', price_details: { price, product: 'prod_care' } }, parent: sub ? { type: 'subscription_item_details', subscription_item_details: { subscription: sub.id, subscription_item: sub.items.data[0].id } } : null }] },
  }
  S.invoices[inv.id] = inv
  if (paid) payInvoiceCharge(inv)
  return inv
}
function payInvoiceCharge(inv) {
  const pi = id('pi')
  const ch = { id: id('ch'), object: 'charge', customer: inv.customer, payment_intent: pi, amount: inv.amount_paid, refunded: false, disputed: false }
  S.charges[ch.id] = ch
  S.invoicePayments.push({ id: id('inpay'), object: 'invoice_payment', invoice: inv.id, payment: { type: 'payment_intent', payment_intent: pi } })
  inv.charge_id = ch.id
}

function stripeApi(req, res, url, body) {
  const form = parseForm(body.toString())
  stripeCalls.push({ method: req.method, path: url.pathname, query: url.search, form })
  const p = url.pathname
  if (req.method === 'POST' && p === '/v1/customers') {
    const c = { id: id('cus'), object: 'customer', name: form.name, email: form.email, metadata: form.metadata || {} }
    S.customers[c.id] = c
    return send(res, 200, c)
  }
  if (req.method === 'POST' && p === '/v1/checkout/sessions') {
    // Real Stripe refuses terms consent when no terms URL is set on the account.
    if (mode.tosMissing && form.consent_collection?.terms_of_service === 'required') return send(res, 400, { error: { type: 'invalid_request_error', message: 'You cannot collect consent to your terms of service unless a URL is set in the Stripe Dashboard.' } })
    const s = { id: id('cs_test'), object: 'checkout.session', mode: form.mode, customer: form.customer, client_reference_id: form.client_reference_id, metadata: form.metadata || {}, subscription_data: form.subscription_data, line_items: form.line_items, url: `https://checkout.stripe.test/pay/${S.n}`, status: 'open', payment_status: 'unpaid', subscription: null, allow_promotion_codes: form.allow_promotion_codes, success_url: form.success_url, consent_collection: form.consent_collection || null, custom_text: form.custom_text || null, consent: null }
    S.sessions[s.id] = s
    return send(res, 200, s)
  }
  if (req.method === 'POST' && p === '/v1/billing_portal/configurations') {
    const c = { id: id('bpc'), object: 'billing_portal.configuration', features: form.features, business_profile: form.business_profile, metadata: form.metadata || {}, idempotency: req.headers['idempotency-key'] || null }
    S.portalConfigs[c.id] = c
    return send(res, 200, c)
  }
  if (req.method === 'POST' && p === '/v1/billing_portal/sessions') return send(res, 200, { id: id('bps'), object: 'billing_portal.session', url: `https://billing.stripe.test/p/${S.n}`, customer: form.customer, configuration: form.configuration || null })
  let m
  if (req.method === 'GET' && (m = p.match(/^\/v1\/checkout\/sessions\/([\w]+)$/))) return S.sessions[m[1]] ? send(res, 200, S.sessions[m[1]]) : send(res, 404, { error: { type: 'invalid_request_error', message: 'No such checkout session' } })
  if (req.method === 'GET' && (m = p.match(/^\/v1\/subscriptions\/([\w]+)$/))) return S.subs[m[1]] ? send(res, 200, S.subs[m[1]]) : send(res, 404, { error: { type: 'invalid_request_error', message: 'No such subscription' } })
  if (req.method === 'GET' && (m = p.match(/^\/v1\/invoices\/([\w]+)$/))) return S.invoices[m[1]] ? send(res, 200, S.invoices[m[1]]) : send(res, 404, { error: { type: 'invalid_request_error', message: 'No such invoice' } })
  if (req.method === 'GET' && (m = p.match(/^\/v1\/charges\/([\w]+)$/))) return S.charges[m[1]] ? send(res, 200, S.charges[m[1]]) : send(res, 404, { error: { type: 'invalid_request_error', message: 'No such charge' } })
  if (req.method === 'GET' && p === '/v1/invoice_payments') {
    const q = parseForm(url.search.slice(1))
    const pi = q.payment?.payment_intent
    return send(res, 200, { object: 'list', data: S.invoicePayments.filter((x) => x.payment.payment_intent === pi), has_more: false })
  }
  return send(res, 400, { error: { type: 'invalid_request_error', message: `fake stripe: unsupported ${req.method} ${p}` } })
}

function control(p, b) {
  if (p === '/__stripe/complete') {
    // The client finishes Checkout: subscription created, first invoice paid.
    const s = S.sessions[b.session_id]
    const start = b.at ?? nowSec()
    const end = addMonth(start)
    const price = s.line_items[0].price
    const sub = { id: id('sub'), object: 'subscription', customer: s.customer, status: 'active', cancel_at_period_end: false, cancel_at: null, canceled_at: null, ended_at: null, metadata: b.metadata ?? s.subscription_data?.metadata ?? {}, items: { object: 'list', data: [{ id: id('si'), object: 'subscription_item', price: { id: price, object: 'price' }, current_period_start: start, current_period_end: end }] } }
    S.subs[sub.id] = sub
    Object.assign(s, { status: 'complete', payment_status: b.fail ? 'unpaid' : 'paid', subscription: sub.id, consent: { terms_of_service: b.no_consent ? null : 'accepted', promotions: null } })
    const inv = makeInvoice(sub, { reason: 'subscription_create', start, end, paid: !b.fail, price })
    if (b.fail) { sub.status = 'incomplete' }
    const evs = [emit('checkout.session.completed', s), emit('customer.subscription.created', sub), emit(b.fail ? 'invoice.payment_failed' : 'invoice.paid', inv)]
    return { sub: sub.id, invoice: inv.id, events: evs }
  }
  if (p === '/__stripe/renew') {
    const sub = S.subs[b.sub_id]
    const it = sub.items.data[0]
    const start = it.current_period_end, end = addMonth(start)
    it.current_period_start = start; it.current_period_end = end
    const inv = makeInvoice(sub, { reason: 'subscription_cycle', start, end, paid: !b.fail, price: it.price.id })
    if (b.fail) { sub.status = 'past_due'; inv.attempt_count = b.attempt || 1 }
    return { invoice: inv.id, events: [emit('customer.subscription.updated', sub), emit(b.fail ? 'invoice.payment_failed' : 'invoice.paid', inv)] }
  }
  if (p === '/__stripe/pay') {
    const inv = S.invoices[b.invoice_id]
    inv.status = 'paid'; inv.amount_paid = inv.amount_due; inv.status_transitions.paid_at = nowSec()
    payInvoiceCharge(inv)
    const sub = S.subs[inv.parent.subscription_details.subscription]
    sub.status = 'active'
    return { events: [emit('invoice.paid', inv), emit('customer.subscription.updated', sub)] }
  }
  if (p === '/__stripe/fail_again') {
    const inv = S.invoices[b.invoice_id]
    inv.attempt_count += 1
    return { events: [emit('invoice.payment_failed', inv)] }
  }
  if (p === '/__stripe/cancel') {
    const sub = S.subs[b.sub_id]
    if (b.at_period_end) { sub.cancel_at_period_end = true; return { events: [emit('customer.subscription.updated', sub)] } }
    sub.status = 'canceled'; sub.canceled_at = nowSec(); sub.ended_at = b.ended_at ?? nowSec()
    return { events: [emit('customer.subscription.deleted', sub)] }
  }
  if (p === '/__stripe/end_period') {
    // The scheduled cancellation takes effect at the end of the paid period.
    const sub = S.subs[b.sub_id]
    sub.status = 'canceled'; sub.ended_at = sub.items.data[0].current_period_end; sub.canceled_at = sub.ended_at
    return { events: [emit('customer.subscription.deleted', sub)] }
  }
  if (p === '/__stripe/stale_active') {
    // A delayed "updated: active" snapshot captured before cancellation.
    const sub = S.subs[b.sub_id]
    const old = { ...JSON.parse(JSON.stringify(sub)), status: 'active', ended_at: null, canceled_at: null }
    return { events: [emit('customer.subscription.updated', old, { created: nowSec() - 3600 })] }
  }
  if (p === '/__stripe/change_plan') {
    const sub = S.subs[b.sub_id]
    const it = sub.items.data[0]
    it.price = { id: b.price, object: 'price' }
    const inv = makeInvoice(sub, { reason: 'subscription_update', start: nowSec(), end: it.current_period_end, paid: true, price: b.price, amount: 3500 })
    return { invoice: inv.id, events: [emit('customer.subscription.updated', sub), emit('invoice.paid', inv)] }
  }
  if (p === '/__stripe/unrelated') {
    const inv = makeInvoice(null, { reason: 'manual', start: nowSec(), end: nowSec(), paid: true, price: 'price_other', oneOff: b.customer })
    return { invoice: inv.id, events: [emit('invoice.paid', inv)] }
  }
  if (p === '/__stripe/foreign_sub') {
    // A subscription whose metadata names a website but a different client.
    const start = nowSec(), end = addMonth(start)
    const sub = { id: id('sub'), object: 'subscription', customer: b.customer || id('cus'), status: 'active', cancel_at_period_end: false, metadata: b.metadata, items: { object: 'list', data: [{ id: id('si'), price: { id: b.price }, current_period_start: start, current_period_end: end }] } }
    S.subs[sub.id] = sub
    const inv = makeInvoice(sub, { reason: 'subscription_create', start, end, paid: true, price: b.price })
    return { sub: sub.id, invoice: inv.id, events: [emit('customer.subscription.created', sub), emit('invoice.paid', inv)] }
  }
  if (p === '/__stripe/emit') {
    // Re-emit any stored object as an event (for example invoice.paid for an invoice that is still open).
    const obj = S.invoices[b.id] || S.subs[b.id] || S.sessions[b.id]
    return { events: [emit(b.type, obj)] }
  }
  if (p === '/__stripe/duplicate_invoice') {
    // A second paid invoice for the same subscription and the same period (a duplicate charge).
    const orig = S.invoices[b.invoice_id]
    const sub = S.subs[orig.parent.subscription_details.subscription]
    const line = orig.lines.data[0]
    const inv = makeInvoice(sub, { reason: orig.billing_reason, start: line.period.start, end: line.period.end, paid: true, price: line.pricing.price_details.price })
    return { invoice: inv.id, events: [emit('invoice.paid', inv)] }
  }
  if (p === '/__stripe/expire_incomplete') {
    const sub = S.subs[b.sub_id]
    sub.status = 'incomplete_expired'
    return { events: [emit('customer.subscription.updated', sub)] }
  }
  if (p === '/__stripe/refund') {
    const inv = S.invoices[b.invoice_id]
    const ch = S.charges[inv.charge_id]
    ch.refunded = true
    return { events: [emit('charge.refunded', ch)] }
  }
  if (p === '/__stripe/dispute') {
    const inv = S.invoices[b.invoice_id]
    const ch = S.charges[inv.charge_id]
    ch.disputed = true
    return { events: [emit('charge.dispute.created', { id: id('dp'), object: 'dispute', charge: ch.id, payment_intent: ch.payment_intent, status: 'needs_response' })] }
  }
  return null
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  if (p.startsWith('/rest/v1/')) {
    const up = http.request({ ...REST, path: req.url.slice('/rest/v1'.length), method: req.method, headers: { ...req.headers, host: `${REST.host}:${REST.port}` } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
    up.on('error', (e) => send(res, 502, String(e)))
    return req.pipe(up)
  }
  const body = await readBody(req)
  if (p === '/__reset') { objects.clear(); emails = []; dispatches = []; events = []; stripeCalls.length = 0; mode = { failEmail: false, failEmailTimes: 0, failDispatch: false, failDispatchTimes: 0, tosMissing: false }; return send(res, 200, { ok: true }) }
  if (p === '/__mode') { Object.assign(mode, JSON.parse(body.toString() || '{}')); return send(res, 200, mode) }
  if (p === '/__emails') return send(res, 200, emails)
  if (p === '/__dispatches') return send(res, 200, dispatches)
  if (p === '/__stripe/calls') return send(res, 200, stripeCalls)
  if (p === '/__stripe/state') return send(res, 200, S)
  if (p === '/__objects') return send(res, 200, [...objects.keys()])
  if (p === '/__object') { const o = objects.get(url.searchParams.get('key')); return o ? send(res, 200, o.body) : send(res, 404, { error: 'none' }) }
  if (p.startsWith('/__stripe/')) {
    const r = control(p, JSON.parse(body.toString() || '{}'))
    return r ? send(res, 200, r) : send(res, 404, { error: 'unknown control' })
  }
  // Storage
  let m
  if ((m = p.match(/^\/storage\/v1\/object\/([\w-]+)\/?$/)) && req.method === 'DELETE') {
    const { prefixes = [] } = JSON.parse(body.toString() || '{}')
    const gone = prefixes.filter((k) => objects.delete(`${m[1]}/${k}`)).map((k) => ({ name: k }))
    return send(res, 200, gone)
  }
  if ((m = p.match(/^\/storage\/v1\/object\/(?:authenticated\/)?([\w-]+)\/(.+)$/))) {
    const key = `${m[1]}/${decodeURIComponent(m[2])}`
    if (req.method === 'POST' || req.method === 'PUT') {
      if (objects.has(key) && req.headers['x-upsert'] !== 'true') return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
      objects.set(key, { body, type: req.headers['content-type'] })
      return send(res, 200, { Key: key, Id: crypto.randomUUID() })
    }
    if (req.method === 'GET') {
      const o = objects.get(key)
      return o ? send(res, 200, o.body, { 'content-type': o.type || 'application/octet-stream' }) : send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    }
  }
  // Resend
  if (p === '/emails' && req.method === 'POST') {
    const msg = JSON.parse(body.toString())
    if (mode.failEmail || mode.failEmailTimes > 0) {
      if (mode.failEmailTimes > 0) mode.failEmailTimes--
      return send(res, 500, { name: 'internal_server_error', message: 'Simulated email outage', statusCode: 500 })
    }
    const eid = crypto.randomUUID()
    emails.push({ id: eid, to: msg.to, from: msg.from, subject: msg.subject, html: msg.html, text: msg.text, idempotency: req.headers['idempotency-key'] || null, attachments: (msg.attachments || []).map((a) => ({ filename: a.filename, sha256: crypto.createHash('sha256').update(Buffer.from(a.content, 'base64')).digest('hex'), bytes: Buffer.from(a.content, 'base64').length })) })
    return send(res, 200, { id: eid })
  }
  // GitHub dispatch
  if (p.startsWith('/repos/') && req.method === 'POST') {
    const fail = mode.failDispatch || mode.failDispatchTimes > 0
    if (mode.failDispatchTimes > 0) mode.failDispatchTimes--
    dispatches.push({ path: p, auth: !!req.headers.authorization, body: body.toString(), at: Date.now(), ok: !fail })
    if (fail) return send(res, 503, { message: 'Simulated GitHub outage' })
    res.writeHead(204); return res.end()
  }
  // Stripe
  if (p.startsWith('/v1/')) return stripeApi(req, res, url, body)
  send(res, 404, { error: `mock: no route ${req.method} ${p}` })
}).listen(4040, '127.0.0.1', () => console.log('care mocks on :4040'))
