/**
 * Stripe subscriptions for Website Care.
 *
 * Source of truth: verified webhook events plus a fresh read of the object from
 * Stripe. Each event triggers a re-fetch, so retries, duplicates, and events
 * that arrive out of order all settle on Stripe's current state, and a late
 * "active" event can't bring back a canceled subscription.
 *
 * Service cycles come only from paid invoices for an approved care price with
 * billing reason subscription_create or subscription_cycle, using the line's
 * own service period. Plan change and other invoices never create a cycle.
 * Nothing here charges, refunds, or cancels anything.
 */
import Stripe from 'stripe'
import { db, must, CareError, getSettings, logActivity, type Row } from './db'
import { appUrl, isProductionDeploy } from './config'
import { planForPrice, priceIdFor, plan as planInfo } from './plans'
import { createCycle } from './cycles'
import { queueBillingNotice } from './notify'

let cached: Stripe | null = null

export function stripeMode(): 'test' | 'live' | 'missing' {
  const k = process.env.STRIPE_SECRET_KEY || ''
  if (k.startsWith('sk_live_') || k.startsWith('rk_live_')) return 'live'
  if (k.startsWith('sk_test_') || k.startsWith('rk_test_')) return 'test'
  return 'missing'
}

export function stripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new CareError('Stripe is not configured (STRIPE_SECRET_KEY).', 503)
  if (stripeMode() === 'live' && process.env.CARE_STRIPE_LIVE_APPROVED !== 'true') {
    throw new CareError('A live Stripe key is set but live billing has not been approved (CARE_STRIPE_LIVE_APPROVED).', 503)
  }
  const opts: Stripe.StripeConfig = { maxNetworkRetries: 2, timeout: 15000, appInfo: { name: 'alantevelez-website-care' } }
  const base = process.env.STRIPE_API_BASE
  if (base) {
    if (isProductionDeploy()) throw new CareError('STRIPE_API_BASE is for local tests only.', 503)
    const u = new URL(base)
    Object.assign(opts, { host: u.hostname, port: u.port, protocol: u.protocol.replace(':', '') })
  }
  cached = new Stripe(key, opts)
  return cached
}

async function livePolicyGate() {
  if (stripeMode() !== 'live') return
  const s = await getSettings()
  if (!s.policy_approved_at) throw new CareError('Approve the billing policies in Website Care settings before using live checkout.', 409)
}

export async function createCheckout(siteId: string, actor: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (site.enrollment_status === 'ended') throw new CareError('Care for this website has ended.', 409)
  if (site.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(site.subscription_status || '')) {
    throw new CareError('This website already has a subscription. Use the billing portal link instead.', 409)
  }
  await livePolicyGate()
  const price = priceIdFor(site.plan)
  if (!price) throw new CareError(`No approved Stripe Price ID is set for ${planInfo(site.plan).name}.`, 503)
  const client = must(await db.from('clients').select('id, name, email, business').eq('id', site.client_id).single(), 'Client')
  const s = stripe()
  let customer = site.stripe_customer_id as string | null
  if (!customer) {
    const sibling = (await db.from('care_sites').select('stripe_customer_id').eq('client_id', site.client_id).not('stripe_customer_id', 'is', null).limit(1).maybeSingle()).data
    customer = sibling?.stripe_customer_id || null
  }
  if (!customer) {
    const c = await s.customers.create(
      { name: client.business || client.name || undefined, email: site.recipient_email || client.email || undefined, metadata: { client_id: client.id } },
      { idempotencyKey: `care-customer-${client.id}` },
    )
    customer = c.id
  }
  await db.from('care_sites').update({ stripe_customer_id: customer, updated_at: new Date().toISOString() }).eq('id', siteId)
  const meta = { care_site_id: site.id, client_id: site.client_id, plan: site.plan }
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: site.id,
    line_items: [{ price, quantity: 1 }],
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: false,
    success_url: `${appUrl()}/care/subscribed`,
    cancel_url: `${appUrl()}/care`,
  })
  await logActivity({ site_id: siteId, actor, action: 'checkout_created', detail: { session: session.id, plan: site.plan, mode: stripeMode() } })
  return { url: session.url, id: session.id, mode: stripeMode() }
}

export async function portalSession(siteId: string, actor: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (!site.stripe_customer_id) throw new CareError('This website has no Stripe customer yet.', 409)
  const p = await stripe().billingPortal.sessions.create({ customer: site.stripe_customer_id, return_url: `${appUrl()}/care` })
  await logActivity({ site_id: siteId, actor, action: 'portal_link_created', detail: {} })
  return { url: p.url }
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                             */
/* ------------------------------------------------------------------ */

export function verifyEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new CareError('Webhook secret not configured.', 503)
  if (!signature) throw new CareError('Missing signature.', 400)
  try {
    return Stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch {
    throw new CareError('Invalid signature.', 400)
  }
}

const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: string }).id) : null)
const ts = (n: number | null | undefined) => (n ? new Date(n * 1000).toISOString() : null)

/** Finds the enrolled website for a subscription, linking it when metadata proves the association. */
async function siteForSubscription(sub: Stripe.Subscription): Promise<Row | null> {
  const linked = (await db.from('care_sites').select('*').eq('stripe_subscription_id', sub.id).maybeSingle()).data
  if (linked) return linked
  const siteId = sub.metadata?.care_site_id
  const clientId = sub.metadata?.client_id
  if (!siteId || !clientId) return null
  const site = (await db.from('care_sites').select('*').eq('id', siteId).maybeSingle()).data
  // Explicit identifiers only: the site and client in the metadata must match each other.
  if (!site || site.client_id !== clientId) return null
  if (site.stripe_subscription_id && site.stripe_subscription_id !== sub.id) return null
  const customer = idOf(sub.customer)
  if (site.stripe_customer_id && customer && site.stripe_customer_id !== customer) return null
  const upd = await db.from('care_sites').update({ stripe_subscription_id: sub.id, stripe_customer_id: customer, updated_at: new Date().toISOString() })
    .eq('id', site.id).is('stripe_subscription_id', null).select('*')
  if (upd.data?.length) {
    await logActivity({ site_id: site.id, actor: 'stripe', action: 'subscription_linked', detail: { subscription: sub.id } })
    return upd.data[0]
  }
  return (await db.from('care_sites').select('*').eq('stripe_subscription_id', sub.id).maybeSingle()).data
}

function billingState(sub: Stripe.Subscription, site: Row): string {
  switch (sub.status) {
    case 'active':
    case 'trialing':
      if (sub.cancel_at_period_end || sub.cancel_at) return 'canceling'
      // Refunds and disputes stay flagged until the owner marks them reviewed.
      if (site.billing_state === 'refunded' || site.billing_state === 'disputed') return site.billing_state
      return site.failed_payment_count > 0 && site.billing_state === 'attention' ? 'attention' : 'active'
    case 'past_due': return 'past_due'
    case 'unpaid': return 'unpaid'
    case 'incomplete': return 'awaiting_payment'
    case 'incomplete_expired': return 'expired'
    case 'canceled': return 'canceled'
    case 'paused': return 'paused'
    default: return String(sub.status)
  }
}

export async function syncSubscription(subId: string, actor = 'stripe') {
  const sub = await stripe().subscriptions.retrieve(subId)
  const site = await siteForSubscription(sub)
  if (!site) return { ignored: 'No enrolled website matches this subscription.' }
  const item = sub.items?.data?.[0]
  const price = item ? idOf(item.price) : null
  const newPlan = planForPrice(price)
  const state = billingState(sub, site)
  const patch: Record<string, unknown> = {
    subscription_status: sub.status, billing_state: state, stripe_price_id: price,
    current_period_start: ts(item?.current_period_start), current_period_end: ts(item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end || !!sub.cancel_at, canceled_at: ts(sub.canceled_at), ended_at: ts(sub.ended_at),
    stripe_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
  if (state === 'active') { patch.billing_attention_since = null; patch.failed_payment_count = 0 }
  if (newPlan && newPlan !== site.plan) {
    patch.plan = newPlan
    await logActivity({ site_id: site.id, actor, action: 'plan_changed', detail: { from: site.plan, to: newPlan } })
  }
  await db.from('care_sites').update(patch).eq('id', site.id)
  if (!newPlan && price) await queueBillingNotice(site, `price:${price}`, 'Unknown price', `The subscription uses a price (${price}) that is not one of the approved care prices.`)
  if (state === 'canceled' && site.billing_state !== 'canceled') {
    const endedEarly = sub.ended_at && site.current_period_end && sub.ended_at * 1000 < new Date(site.current_period_end).getTime() - 3600_000
    if (endedEarly) {
      await db.from('care_cycles').update({ billing_flag: 'canceled_immediately', billing_flag_at: new Date().toISOString() })
        .eq('site_id', site.id).is('completed_at', null).is('billing_flag', null)
    }
    await logActivity({ site_id: site.id, actor, action: 'subscription_ended', detail: { early: !!endedEarly } })
    await queueBillingNotice(site, `canceled:${sub.id}`, 'Canceled', endedEarly ? 'The subscription was canceled before the end of the paid period. Open reviews are kept and flagged for you to decide.' : 'The subscription ended at the end of its paid period. Past reports are kept.')
  }
  if (state === 'canceling' && site.billing_state !== 'canceling') {
    await logActivity({ site_id: site.id, actor, action: 'cancel_scheduled', detail: { at: patch.current_period_end } })
    await queueBillingNotice(site, `canceling:${sub.id}:${item?.current_period_end}`, 'Canceling at period end', 'The client scheduled cancellation. The paid period is still honored; no new cycle starts after it ends.')
  }
  return { site_id: site.id, state }
}

function subscriptionOfInvoice(inv: Stripe.Invoice): string | null {
  return idOf(inv.parent?.subscription_details?.subscription) || idOf((inv as unknown as { subscription?: unknown }).subscription)
}

function carePriceOfLine(line: Stripe.InvoiceLineItem): string | null {
  return idOf(line.pricing?.price_details?.price) || idOf((line as unknown as { price?: unknown }).price)
}

export async function handleInvoicePaid(invoiceId: string) {
  const inv = await stripe().invoices.retrieve(invoiceId)
  if (inv.status !== 'paid') return { ignored: `Invoice is ${inv.status}, not paid.` }
  const subId = subscriptionOfInvoice(inv)
  if (!subId) return { ignored: 'Not a subscription invoice.' }
  const sub = await stripe().subscriptions.retrieve(subId)
  const site = await siteForSubscription(sub)
  if (!site) return { ignored: 'No enrolled website matches this subscription.' }
  if (!['subscription_create', 'subscription_cycle'].includes(inv.billing_reason || '')) {
    await syncSubscription(subId)
    return { ignored: `Billing reason ${inv.billing_reason} does not start a service period.` }
  }
  const line = (inv.lines?.data || []).find((l) => {
    const p = planForPrice(carePriceOfLine(l))
    return !!p && (l.amount ?? 0) >= 0
  })
  if (!line) return { ignored: 'No approved care price on this invoice.' }
  const plan = planForPrice(carePriceOfLine(line))!
  const periodStart = new Date(line.period.start * 1000)
  const periodEnd = new Date(line.period.end * 1000)
  const { cycle, created } = await createCycle({
    siteId: site.id, source: 'stripe', invoiceId: inv.id, subscriptionId: subId, periodStart, periodEnd, plan,
    paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : new Date(), amountPaid: inv.amount_paid, currency: inv.currency, actor: 'stripe',
  })
  const paidThrough = site.paid_through && new Date(site.paid_through) > periodEnd ? site.paid_through : periodEnd.toISOString()
  await db.from('care_sites').update({ paid_through: paidThrough, failed_payment_count: 0, billing_attention_since: null, updated_at: new Date().toISOString() }).eq('id', site.id)
  await syncSubscription(subId)
  return { cycle_id: cycle.id, created }
}

export async function handlePaymentFailed(invoiceId: string) {
  const inv = await stripe().invoices.retrieve(invoiceId)
  const subId = subscriptionOfInvoice(inv)
  if (!subId) return { ignored: 'Not a subscription invoice.' }
  const sub = await stripe().subscriptions.retrieve(subId)
  const site = await siteForSubscription(sub)
  if (!site) return { ignored: 'No enrolled website matches this subscription.' }
  if (inv.status === 'paid') return { ignored: 'Invoice was paid after this failure.' }
  const settings = await getSettings()
  const count = Math.max(site.failed_payment_count + 1, inv.attempt_count || 1)
  const attention = count >= settings.billing_attention_after_failures
  await db.from('care_sites').update({
    failed_payment_count: count, billing_state: attention ? 'attention' : site.billing_state,
    billing_attention_since: attention ? site.billing_attention_since || new Date().toISOString() : site.billing_attention_since, updated_at: new Date().toISOString(),
  }).eq('id', site.id)
  await logActivity({ site_id: site.id, actor: 'stripe', action: 'payment_failed', detail: { invoice: inv.id, attempt: inv.attempt_count } })
  if (attention) await queueBillingNotice(site, `failed:${inv.id}:${inv.attempt_count}`, 'Payment failed', `Payment attempt ${inv.attempt_count || count} failed. Stripe will retry on its own schedule. No review starts for an unpaid period.`)
  return { site_id: site.id, failures: count }
}

async function siteForCharge(charge: { customer?: unknown; payment_intent?: unknown }) {
  const customer = idOf(charge.customer)
  if (!customer) return { site: null, invoiceId: null }
  let invoiceId: string | null = null
  const pi = idOf(charge.payment_intent)
  if (pi) {
    try {
      const list = await stripe().invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: pi }, limit: 1 })
      invoiceId = idOf(list.data[0]?.invoice)
    } catch { /* invoice lookup is best effort */ }
  }
  let site = null
  if (invoiceId) {
    const cyc = (await db.from('care_cycles').select('site_id').eq('stripe_invoice_id', invoiceId).maybeSingle()).data
    if (cyc) site = (await db.from('care_sites').select('*').eq('id', cyc.site_id).single()).data
  }
  if (!site) {
    const sites = (await db.from('care_sites').select('*').eq('stripe_customer_id', customer)).data || []
    if (sites.length === 1) site = sites[0]
  }
  return { site, invoiceId }
}

async function flagCharge(kind: 'refunded' | 'disputed', charge: Stripe.Charge | { id: string; customer?: unknown; payment_intent?: unknown }, detail: string) {
  const { site, invoiceId } = await siteForCharge(charge)
  if (!site) return { ignored: 'No enrolled website matches this payment.' }
  if (invoiceId) await db.from('care_cycles').update({ billing_flag: kind, billing_flag_at: new Date().toISOString() }).eq('stripe_invoice_id', invoiceId)
  await db.from('care_sites').update({ billing_state: kind === 'disputed' ? 'disputed' : site.billing_state === 'active' ? 'refunded' : site.billing_state, billing_attention_since: site.billing_attention_since || new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', site.id)
  await logActivity({ site_id: site.id, actor: 'stripe', action: kind, detail: { charge: charge.id, invoice: invoiceId } })
  await queueBillingNotice(site, `${kind}:${charge.id}`, kind === 'refunded' ? 'Refund recorded' : 'Payment disputed', detail)
  return { site_id: site.id, flagged: kind }
}

export async function processEvent(event: Stripe.Event): Promise<{ status: 'processed' | 'ignored' | 'duplicate'; note?: string }> {
  if (event.livemode && stripeMode() !== 'live') return { status: 'ignored', note: 'Live event received by a test configuration.' }
  const obj = event.data.object as unknown as { id?: string }
  const begin = await db.rpc('care_begin_stripe_event', { p_id: event.id, p_type: event.type, p_created: new Date(event.created * 1000).toISOString(), p_livemode: event.livemode, p_object: obj?.id || null })
  if (begin.error) throw new CareError(begin.error.message, 500)
  if (begin.data === 'duplicate') return { status: 'duplicate' }
  try {
    let result: Record<string, unknown> = {}
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session
        const sub = idOf(s.subscription)
        result = s.mode === 'subscription' && sub ? await syncSubscription(sub) : { ignored: 'Not a subscription checkout.' }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        result = await syncSubscription((event.data.object as Stripe.Subscription).id)
        break
      case 'invoice.paid':
        result = await handleInvoicePaid((event.data.object as Stripe.Invoice).id!)
        break
      case 'invoice.payment_failed':
        result = await handlePaymentFailed((event.data.object as Stripe.Invoice).id!)
        break
      case 'charge.refunded':
        result = await flagCharge('refunded', event.data.object as Stripe.Charge, 'A payment was refunded in Stripe. The related review is flagged; decide whether to continue, pause, or close it.')
        break
      case 'charge.dispute.created': {
        const d = event.data.object as Stripe.Dispute
        result = await flagCharge('disputed', { id: idOf(d.charge) || d.id, customer: null, payment_intent: d.payment_intent, ...(await chargeCustomer(idOf(d.charge))) }, 'The client disputed a payment. Respond in Stripe. The related review is flagged.')
        break
      }
      default:
        result = { ignored: 'Event type not used by Website Care.' }
    }
    const ignored = typeof result.ignored === 'string'
    await db.from('care_stripe_events').update({ status: ignored ? 'ignored' : 'processed', note: ignored ? String(result.ignored).slice(0, 300) : null, processed_at: new Date().toISOString() }).eq('id', event.id)
    return { status: ignored ? 'ignored' : 'processed', note: ignored ? String(result.ignored) : undefined }
  } catch (e) {
    await db.from('care_stripe_events').update({ status: 'failed', error: String((e as Error).message || e).slice(0, 300) }).eq('id', event.id)
    throw e
  }
}

async function chargeCustomer(chargeId: string | null) {
  if (!chargeId) return {}
  try {
    const c = await stripe().charges.retrieve(chargeId)
    return { customer: c.customer, payment_intent: c.payment_intent }
  } catch {
    return {}
  }
}
