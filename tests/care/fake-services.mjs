/**
 * Local stand ins for Stripe's API and Resend's API, for tests on this
 * machine only. The real Stripe SDK and Resend SDK talk to them over HTTP
 * (STRIPE_API_BASE and RESEND_BASE_URL), so the real request code runs
 * without reaching either service. Every request is recorded.
 */
import http from 'node:http'
import { randomBytes } from 'node:crypto'

const rid = (p) => `${p}_local_${randomBytes(5).toString('hex')}`
const now = () => Math.floor(Date.now() / 1000)

/** Stripe's form encoding (a[b][0][c]=v) back into an object. */
function parseForm(body) {
  const out = {}
  for (const [k, v] of new URLSearchParams(body)) {
    const path = k.replace(/\]/g, '').split('[')
    let o = out
    path.forEach((p, i) => {
      if (i === path.length - 1) o[p] = v
      else o = o[p] ??= /^\d+$/.test(path[i + 1]) ? [] : {}
    })
  }
  return out
}

export function priceObj(id, cents, o = {}) {
  return {
    id, object: 'price', active: true, type: 'recurring', billing_scheme: 'per_unit', currency: 'usd', livemode: false, unit_amount: cents,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed', trial_period_days: null }, ...o,
  }
}

export function startFakeStripe(port) {
  const s = {
    requests: [],
    prices: {},
    customers: {},
    sessions: {},
    subscriptions: {},
    invoices: {},
    failPrices: false,
  }
  const send = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
  const missing = (res, what) => send(res, 404, { error: { type: 'invalid_request_error', message: `No such ${what}` } })
  s.server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const url = new URL(req.url, 'http://x')
      const parts = url.pathname.split('/').filter(Boolean).slice(1) // drop v1
      const form = parseForm(body)
      s.requests.push({ method: req.method, path: url.pathname, form, query: Object.fromEntries(url.searchParams) })
      const [a, b, c, d] = parts
      if (a === 'prices' && req.method === 'GET') {
        if (s.failPrices) return send(res, 500, { error: { type: 'api_error', message: 'Stripe is unavailable' } })
        return s.prices[b] ? send(res, 200, s.prices[b]) : missing(res, `price: '${b}'`)
      }
      if (a === 'customers' && req.method === 'POST') { const o = { id: rid('cus'), object: 'customer', ...form }; s.customers[o.id] = o; return send(res, 200, o) }
      if (a === 'subscriptions' && !b) return send(res, 200, { object: 'list', has_more: false, data: Object.values(s.subscriptions).filter((x) => x.customer === url.searchParams.get('customer')) })
      if (a === 'subscriptions' && b) return s.subscriptions[b] ? send(res, 200, s.subscriptions[b]) : missing(res, 'subscription')
      if (a === 'invoices' && b) return s.invoices[b] ? send(res, 200, s.invoices[b]) : missing(res, 'invoice')
      if (a === 'checkout' && b === 'sessions') {
        if (req.method === 'POST' && !c) {
          const o = {
            id: rid('cs'), object: 'checkout.session', status: 'open', mode: form.mode, customer: form.customer, metadata: form.metadata || {},
            price: form.line_items?.[0]?.price, expires_at: Number(form.expires_at) || now() + 86400, subscription: null, custom_text: form.custom_text || null, cancel_url: form.cancel_url,
          }
          o.url = `https://checkout.stripe.local/pay/${o.id}`
          s.sessions[o.id] = o
          return send(res, 200, o)
        }
        const o = s.sessions[c]
        if (!o) return missing(res, 'checkout.session')
        if (d === 'expire' && req.method === 'POST') {
          if (o.status !== 'open') return send(res, 400, { error: { type: 'invalid_request_error', message: 'Only open sessions can be expired.' } })
          o.status = 'expired'
          return send(res, 200, o)
        }
        return send(res, 200, o)
      }
      send(res, 404, { error: { type: 'invalid_request_error', message: `Unhandled ${req.method} ${url.pathname}` } })
    })
  })
  return new Promise((r) => s.server.listen(port, '127.0.0.1', () => r(s)))
}

export function startFakeResend(port) {
  const s = { emails: [] }
  s.server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const m = body ? JSON.parse(body) : {}
      const id = rid('email')
      s.emails.push({ id, ...m, idempotencyKey: req.headers['idempotency-key'] })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id }))
    })
  })
  return new Promise((r) => s.server.listen(port, '127.0.0.1', () => r(s)))
}

/** GitHub's workflow dispatch endpoint. `fail` refuses every dispatch, `failTimes` the next n. */
export function startFakeGithub(port) {
  const s = { dispatches: [], fail: false, failTimes: 0 }
  s.server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const failing = s.fail || s.failTimes > 0
      if (s.failTimes > 0) s.failTimes--
      s.dispatches.push({ path: req.url, ok: !failing, body, at: Date.now() })
      if (failing) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"message":"Simulated GitHub outage"}') }
      res.writeHead(204); res.end()
    })
  })
  return new Promise((r) => s.server.listen(port, '127.0.0.1', () => r(s)))
}
