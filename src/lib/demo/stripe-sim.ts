/**
 * Simulated Stripe for the preview demo. It answers the Stripe calls Website
 * Care makes (prices, customers, checkout sessions, subscriptions, invoices)
 * from objects kept in the demo database, so the real checkout, invitation,
 * and webhook code runs unchanged and nothing reaches Stripe.
 *
 * The practice scenarios change those objects the way Stripe would and then
 * hand a Stripe style event to the real processEvent, the same function the
 * verified webhook calls. Redelivering an event uses the same event id, as
 * Stripe's retries do, so it can't create a second period or review.
 */
import 'server-only'
import { randomBytes } from 'node:crypto'
import type Stripe from 'stripe'
import { demoScope } from './context'
import { installStripeSim } from '@/lib/care/stripe-sim'
import { plan as planInfo, PLAN_IDS, type PlanId } from '@/lib/care/plans'

type Obj = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const rid = (prefix: string) => `${prefix}_demo_${randomBytes(6).toString('hex')}`
const now = () => Math.floor(Date.now() / 1000)
export const DEMO_PRICE = (p: string) => `price_demo_${p}`

function q() {
  const s = demoScope.getStore()
  if (!s) throw new Error('The simulated Stripe only runs inside the demo.')
  return s.query
}

class SimError extends Error {
  type = 'StripeInvalidRequestError'
  statusCode = 404
}

async function get(id: string, kind: string): Promise<Obj> {
  const r = await q()(`select data from public.demo_stripe where id = $1 and kind = $2`, [id, kind])
  if (!r.rows[0]) throw new SimError(`No such ${kind}: '${id}'`)
  return r.rows[0].data as Obj
}

async function put(kind: string, o: Obj) {
  await q()(`insert into public.demo_stripe (id, kind, data) values ($1, $2, $3::jsonb) on conflict (id) do update set data = excluded.data`, [o.id, kind, JSON.stringify(o)])
  return o
}

async function all(kind: string): Promise<Obj[]> {
  return (await q()(`select data from public.demo_stripe where kind = $1 order by created_at`, [kind])).rows.map((r) => r.data as Obj)
}

/** The configured price for each plan: the published monthly price, in USD, monthly. */
function price(id: string): Obj {
  const p = PLAN_IDS.find((x) => DEMO_PRICE(x) === id)
  if (!p) throw new SimError(`No such price: '${id}'`)
  return {
    id, object: 'price', active: true, type: 'recurring', billing_scheme: 'per_unit', currency: 'usd', livemode: false, unit_amount: planInfo(p).monthly * 100,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed', trial_period_days: null }, nickname: planInfo(p).name,
  }
}

const addMonth = (t: number) => { const d = new Date(t * 1000); d.setUTCMonth(d.getUTCMonth() + 1); return Math.floor(d.getTime() / 1000) }

function subscriptionObj(o: { id: string; customer: string; priceId: string; meta: Obj; start: number }): Obj {
  return {
    id: o.id, object: 'subscription', status: 'active', customer: o.customer, metadata: o.meta, cancel_at_period_end: false, cancel_at: null, canceled_at: null, ended_at: null,
    items: { data: [{ price: { id: o.priceId }, current_period_start: o.start, current_period_end: addMonth(o.start) }] },
  }
}

function invoiceObj(o: { sub: Obj; reason: string; start: number; end: number; paid: boolean }): Obj {
  const p = o.sub.items.data[0].price.id
  const amount = price(p).unit_amount
  return {
    id: rid('in'), object: 'invoice', status: o.paid ? 'paid' : 'open', billing_reason: o.reason, customer: o.sub.customer, currency: 'usd',
    amount_paid: o.paid ? amount : 0, amount_due: amount, attempt_count: 1, parent: { subscription_details: { subscription: o.sub.id } },
    status_transitions: { paid_at: o.paid ? now() : null }, lines: { data: [{ amount, period: { start: o.start, end: o.end }, pricing: { price_details: { price: p } } }] },
  }
}

const simStripe = {
  prices: { retrieve: async (id: string) => price(id) },
  customers: {
    create: async (params: Obj) => put('customer', { id: rid('cus'), object: 'customer', name: params.name, email: params.email, metadata: params.metadata || {} }),
  },
  subscriptions: {
    retrieve: async (id: string) => get(id, 'subscription'),
    list: async (params: Obj) => ({ data: (await all('subscription')).filter((s) => s.customer === params.customer) }),
  },
  invoices: { retrieve: async (id: string) => get(id, 'invoice') },
  checkout: {
    sessions: {
      create: async (params: Obj) => {
        const id = rid('cs')
        return put('session', {
          id, object: 'checkout.session', mode: params.mode, status: 'open', customer: params.customer, metadata: params.metadata, client_reference_id: params.client_reference_id,
          price: params.line_items?.[0]?.price, expires_at: params.expires_at || now() + 86400, subscription: null, url: `/admin/care/demo-checkout?session=${id}`,
        })
      },
      retrieve: async (id: string) => get(id, 'session'),
      expire: async (id: string) => {
        const s = await get(id, 'session')
        if (s.status !== 'open') throw new SimError(`Checkout session ${id} is ${s.status} and can't be expired.`)
        return put('session', { ...s, status: 'expired' })
      },
    },
  },
  billingPortal: { sessions: { create: async () => ({ url: '/admin/care' }) } },
}

/** Installs the simulated Stripe for demo requests. Outside a demo request it answers null, so real Stripe is used as before. */
export function installDemoStripe() {
  installStripeSim(() => (demoScope.getStore() ? { stripe: simStripe as unknown as Stripe, priceId: (p: string) => DEMO_PRICE(p) } : null))
}

/* ------------------------------ events ------------------------------ */

function event(type: string, object: Obj): Stripe.Event {
  return { id: rid('evt'), object: 'event', type, created: now(), livemode: false, api_version: null, pending_webhooks: 0, request: null, data: { object } } as unknown as Stripe.Event
}

type Process = (e: Stripe.Event) => Promise<{ status: string; note?: string }>
export type Delivered = { type: string; status: string; note?: string }

async function deliver(processEvent: Process, siteId: string, events: Stripe.Event[]): Promise<Delivered[]> {
  const out: Delivered[] = []
  for (const e of events) {
    const r = await processEvent(e)
    out.push({ type: e.type, status: r.status, note: r.note })
  }
  // Kept so "send the last notice again" can redeliver the same events.
  await put('delivery', { id: `last_${siteId}`, events })
  return out
}

/** The client paying on the simulated checkout page: what Stripe does, then the notices it sends. */
export async function payCheckout(processEvent: Process, sessionId: string): Promise<{ site_id: string; delivered: Delivered[] }> {
  const s = await get(sessionId, 'session')
  const siteId = s.metadata?.care_site_id
  if (s.status === 'open' && s.expires_at <= now()) {
    await put('session', { ...s, status: 'expired' })
    await deliver(processEvent, siteId, [event('checkout.session.expired', { ...s, status: 'expired' })])
    throw new SimError('This checkout link has expired. Ask for a new invitation.')
  }
  if (s.status === 'expired') throw new SimError('This checkout link has expired. Ask for a new invitation.')
  if (s.status === 'complete') throw new SimError('This checkout link was already used.')
  const start = now()
  const sub = await put('subscription', subscriptionObj({ id: rid('sub'), customer: s.customer, priceId: s.price, meta: s.metadata, start }))
  const inv = await put('invoice', invoiceObj({ sub, reason: 'subscription_create', start, end: addMonth(start), paid: true }))
  const done = await put('session', { ...s, status: 'complete', subscription: sub.id })
  return { site_id: siteId, delivered: await deliver(processEvent, siteId, [event('checkout.session.completed', done), event('invoice.paid', inv)]) }
}

/** Practice: the open checkout link runs out before the client pays. */
export async function expireLink(processEvent: Process, siteId: string, sessionId: string) {
  const s = await get(sessionId, 'session')
  if (s.status !== 'open') throw new SimError(`The link is already ${s.status}.`)
  const expired = await put('session', { ...s, status: 'expired', expires_at: now() - 60 })
  return deliver(processEvent, siteId, [event('checkout.session.expired', expired)])
}

export type Scenario = 'renewal' | 'failed_payment' | 'cancel_at_period_end' | 'cancel_now' | 'repeat'

/**
 * Practice scenarios for a website with a (simulated) subscription. Each one
 * changes the subscription the way Stripe would and delivers Stripe's notices
 * to the real event processing.
 */
export async function runScenario(processEvent: Process, siteId: string, subId: string, scenario: Scenario): Promise<{ delivered: Delivered[]; summary: string }> {
  if (scenario === 'repeat') {
    const last = await get(`last_${siteId}`, 'delivery').catch(() => null)
    if (!last) throw new SimError('There is no earlier notice to send again yet.')
    const delivered: Delivered[] = []
    for (const e of last.events as Stripe.Event[]) { const r = await processEvent(e); delivered.push({ type: e.type, status: r.status, note: r.note }) }
    return { delivered, summary: 'Stripe sent the same notices again (same event ids, as its retries do).' }
  }
  const sub = await get(subId, 'subscription')
  const item = sub.items.data[0]
  if (['canceled', 'incomplete_expired'].includes(sub.status)) throw new SimError('This subscription has ended. Nothing more happens to it.')

  if (scenario === 'renewal') {
    if (sub.cancel_at_period_end) {
      // No renewal: the paid period ends and the subscription closes.
      const ended = await put('subscription', { ...sub, status: 'canceled', ended_at: item.current_period_end, canceled_at: sub.canceled_at || now() })
      return { delivered: await deliver(processEvent, siteId, [event('customer.subscription.deleted', ended)]), summary: 'The paid period ended. Because cancellation was scheduled, Stripe closed the subscription instead of renewing it.' }
    }
    const openInv = (await all('invoice')).find((i) => i.parent?.subscription_details?.subscription === sub.id && i.status === 'open')
    if (openInv) {
      // Stripe's retry of the failed renewal succeeds.
      const paid = await put('invoice', { ...openInv, status: 'paid', amount_paid: openInv.amount_due, status_transitions: { paid_at: now() } })
      const active = await put('subscription', { ...sub, status: 'active' })
      return { delivered: await deliver(processEvent, siteId, [event('invoice.paid', paid), event('customer.subscription.updated', active)]), summary: `Stripe retried the failed renewal and it was paid (attempt ${openInv.attempt_count + 1}).` }
    }
    const start = item.current_period_end
    const next = await put('subscription', { ...sub, status: 'active', items: { data: [{ ...item, current_period_start: start, current_period_end: addMonth(start) }] } })
    const inv = await put('invoice', invoiceObj({ sub: next, reason: 'subscription_cycle', start, end: addMonth(start), paid: true }))
    return { delivered: await deliver(processEvent, siteId, [event('invoice.paid', inv), event('customer.subscription.updated', next)]), summary: 'Stripe renewed the subscription and the next month was paid.' }
  }

  if (scenario === 'failed_payment') {
    let inv = (await all('invoice')).find((i) => i.parent?.subscription_details?.subscription === sub.id && i.status === 'open')
    let current = sub
    if (inv) inv = await put('invoice', { ...inv, attempt_count: inv.attempt_count + 1 })
    else {
      if (sub.cancel_at_period_end) throw new SimError('Cancellation is scheduled, so there is no renewal payment to fail.')
      const start = item.current_period_end
      current = await put('subscription', { ...sub, items: { data: [{ ...item, current_period_start: start, current_period_end: addMonth(start) }] } })
      inv = await put('invoice', invoiceObj({ sub: current, reason: 'subscription_cycle', start, end: addMonth(start), paid: false }))
    }
    const pastDue = await put('subscription', { ...current, status: 'past_due' })
    return { delivered: await deliver(processEvent, siteId, [event('invoice.payment_failed', inv), event('customer.subscription.updated', pastDue)]), summary: `The renewal payment failed (attempt ${inv.attempt_count}). Stripe will retry on its own schedule.` }
  }

  if (scenario === 'cancel_at_period_end') {
    if (sub.cancel_at_period_end) throw new SimError('Cancellation is already scheduled for the end of the period.')
    const c = await put('subscription', { ...sub, cancel_at_period_end: true, canceled_at: now() })
    return { delivered: await deliver(processEvent, siteId, [event('customer.subscription.updated', c)]), summary: 'The client scheduled cancellation at the end of the paid period. Run Renewal to reach the period end.' }
  }

  // cancel_now
  const c = await put('subscription', { ...sub, status: 'canceled', canceled_at: now(), ended_at: now() })
  return { delivered: await deliver(processEvent, siteId, [event('customer.subscription.deleted', c)]), summary: 'The subscription was canceled immediately, before the end of the paid period.' }
}

/** Simulated Stripe objects for a demo website that starts with a subscription (Lakeside Dental). */
export function seedSubscription(o: { siteId: string; clientId: string; plan: PlanId; customer: string; sub: string; invoice: string; start: number; end: number }): Obj[] {
  const base = subscriptionObj({ id: o.sub, customer: o.customer, priceId: DEMO_PRICE(o.plan), meta: { care_site_id: o.siteId, client_id: o.clientId, plan: o.plan }, start: o.start })
  const s = { ...base, items: { data: [{ ...base.items.data[0], current_period_end: o.end }] } }
  return [
    { id: o.customer, kind: 'customer', data: { id: o.customer, object: 'customer', metadata: { client_id: o.clientId } } },
    { id: o.sub, kind: 'subscription', data: s },
    { id: o.invoice, kind: 'invoice', data: { ...invoiceObj({ sub: s, reason: 'subscription_create', start: o.start, end: o.end, paid: true }), id: o.invoice } },
  ]
}
