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
import { clientEmailAllowed } from './config'
import { subscriptionInvitation } from './emails'
import { stripeSim } from './stripe-sim'
import { Resend } from 'resend'
import { BRAND } from '@/lib/brand'

let cached: Stripe | null = null

export function stripeMode(): 'test' | 'live' | 'missing' {
  const k = process.env.STRIPE_SECRET_KEY || ''
  if (k.startsWith('sk_live_') || k.startsWith('rk_live_')) return 'live'
  if (k.startsWith('sk_test_') || k.startsWith('rk_test_')) return 'test'
  return 'missing'
}

export function stripe(): Stripe {
  const sim = stripeSim()
  if (sim) return sim.stripe
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

/* ------------------------------------------------------------------ */
/* Checkout price check                                                 */
/* ------------------------------------------------------------------ */

export type PriceFacts = { id: string; amount_cents: number | null; currency: string; interval: string | null; interval_count: number | null }
export type PriceCheck = {
  ok: boolean
  problems: string[]
  expected: { amount_cents: number; currency: 'usd'; interval: 'month' }
  price: PriceFacts | null
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`

/** What checkout must charge: the client's agreed monthly price (or the plan price when none is recorded), in US dollars, every month. */
export function expectedCharge(site: Row): PriceCheck['expected'] {
  const monthly = typeof site.agreed_monthly_price === 'number' ? site.agreed_monthly_price : planInfo(site.plan).monthly
  return { amount_cents: Math.round(monthly * 100), currency: 'usd', interval: 'month' }
}

/**
 * Compares a configured Stripe Price with what the client agreed to pay. Every
 * difference is a problem: the amount, the currency, anything other than once
 * a month, a metered or tiered price, an archived price, a free trial, or a
 * test price on a live account (and the reverse).
 */
export function comparePrice(price: Stripe.Price, expected: PriceCheck['expected'], mode: ReturnType<typeof stripeMode>): string[] {
  const problems: string[] = []
  const r = price.recurring
  if (!price.active) problems.push(`The Stripe price ${price.id} is archived.`)
  if (price.type !== 'recurring' || !r) problems.push(`The Stripe price ${price.id} is a one time price, not a monthly subscription.`)
  else {
    if (r.interval !== 'month' || r.interval_count !== 1) problems.push(`The Stripe price bills every ${r.interval_count === 1 ? r.interval : `${r.interval_count} ${r.interval}s`}, not once a month.`)
    if (r.usage_type !== 'licensed') problems.push('The Stripe price is metered by usage, not a fixed monthly amount.')
    if (r.trial_period_days) problems.push(`The Stripe price starts with a ${r.trial_period_days} day free trial.`)
  }
  if (price.billing_scheme !== 'per_unit' || price.unit_amount == null) problems.push('The Stripe price uses tiers or a custom amount, not one fixed amount.')
  if (price.currency !== expected.currency) problems.push(`The Stripe price is in ${price.currency.toUpperCase()}, but the agreed price is in USD.`)
  if (price.unit_amount != null && price.unit_amount !== expected.amount_cents) {
    problems.push(`The Stripe price charges ${dollars(price.unit_amount)} a month, but the agreed price is ${dollars(expected.amount_cents)} a month.`)
  }
  if (mode === 'live' && !price.livemode) problems.push('The Stripe price is a test price, but Stripe is in live mode.')
  if (mode === 'test' && price.livemode) problems.push('The Stripe price is a live price, but Stripe is in test mode.')
  return problems
}

/** Reads the plan's configured Stripe Price from Stripe and checks it. Anything that can't be confirmed counts as a problem. */
export async function verifyCheckoutPrice(site: Row): Promise<PriceCheck> {
  const expected = expectedCharge(site)
  const id = priceIdFor(site.plan)
  if (!id) return { ok: false, problems: [`No Stripe Price ID is set for ${planInfo(site.plan).name}.`], expected, price: null }
  let price: Stripe.Price
  try {
    price = await stripe().prices.retrieve(id)
  } catch (e) {
    return { ok: false, problems: [`The Stripe price couldn’t be checked (${String((e as Error).message || e).slice(0, 160)}). Checkout stays blocked until it can be verified.`], expected, price: null }
  }
  const problems = comparePrice(price, expected, stripeSim() ? 'test' : stripeMode())
  return {
    ok: problems.length === 0, problems, expected,
    price: { id: price.id, amount_cents: price.unit_amount, currency: price.currency, interval: price.recurring?.interval || null, interval_count: price.recurring?.interval_count ?? null },
  }
}

function priceBlocked(site: Row, check: PriceCheck): CareError {
  return new CareError(`Checkout is blocked for ${site.label}: ${check.problems.join(' ')} Nothing was sent and no checkout link was created. Correct the agreed price on this website, or have a Stripe price that matches it set for the plan.`, 409)
}

/* ------------------------------------------------------------------ */
/* Checkout links and invitations                                       */
/* ------------------------------------------------------------------ */

const LINK_HOURS = 24
// A link this close to expiring is replaced rather than sent.
const MIN_LINK_LIFE_MS = 2 * 3600_000

async function clearCheckout(siteId: string) {
  await db.from('care_sites').update({ checkout_session_id: null, checkout_url: null, checkout_expires_at: null, checkout_price_id: null, checkout_amount_cents: null, updated_at: new Date().toISOString() }).eq('id', siteId)
}

/** Closes the website's open checkout link (for example after its price changed) so it can't be paid. */
export async function closeCheckout(siteId: string, reason: string, actor: string) {
  const site = (await db.from('care_sites').select('checkout_session_id').eq('id', siteId).maybeSingle()).data
  if (!site?.checkout_session_id) return false
  try { await stripe().checkout.sessions.expire(site.checkout_session_id) } catch { /* already expired or completed */ }
  await clearCheckout(siteId)
  await logActivity({ site_id: siteId, actor, action: 'checkout_closed', detail: { session: site.checkout_session_id, reason } })
  return true
}

/** Refuses when the website already has a subscription, here or in Stripe (one whose notice hasn't arrived yet). */
async function refuseDuplicate(site: Row) {
  if (site.enrollment_status === 'ended') throw new CareError('Care for this website has ended.', 409)
  if (site.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(site.subscription_status || '')) {
    throw new CareError('This website already has a subscription. Use the billing portal link instead.', 409)
  }
  if (!site.stripe_customer_id) return
  const subs = await stripe().subscriptions.list({ customer: site.stripe_customer_id, status: 'all', limit: 20 })
  const live = subs.data.find((x) => x.metadata?.care_site_id === site.id && !['canceled', 'incomplete_expired'].includes(x.status))
  if (live) throw new CareError(`Stripe already has a subscription for this website (${live.id}, ${live.status}). Use Refresh from Stripe instead of creating another.`, 409)
}

export type CheckoutLink = { url: string; id: string; expires_at: string; reused: boolean; mode: string; check: PriceCheck }

/**
 * The website's checkout link: the open one if it is still good for a while
 * and uses the same verified price, otherwise a new one. The price is checked
 * against the agreed amount first; a link is never created with a wrong price.
 */
export async function openCheckout(siteId: string, actor: string): Promise<CheckoutLink> {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  await livePolicyGate()
  const check = await verifyCheckoutPrice(site)
  if (!check.ok) throw priceBlocked(site, check)
  await refuseDuplicate(site)
  const s = stripe()
  const mode = stripeSim() ? 'demo' : stripeMode()

  if (site.checkout_session_id) {
    let open: Stripe.Checkout.Session | null = null
    try { open = await s.checkout.sessions.retrieve(site.checkout_session_id) } catch { open = null }
    if (open?.status === 'complete') throw new CareError('The client already completed checkout with the current link. Use Refresh from Stripe to pick up the subscription.', 409)
    const stillGood = open?.status === 'open' && open.url && open.expires_at * 1000 - Date.now() > MIN_LINK_LIFE_MS
    if (stillGood && site.checkout_price_id === check.price!.id && site.checkout_amount_cents === check.expected.amount_cents) {
      return { url: open!.url!, id: open!.id, expires_at: new Date(open!.expires_at * 1000).toISOString(), reused: true, mode, check }
    }
    // Expired, nearly expired, or for a different price: close it so it can't be paid, then make a new one.
    if (open?.status === 'open') { try { await s.checkout.sessions.expire(open.id) } catch { /* already closed */ } }
    await clearCheckout(siteId)
    await logActivity({ site_id: siteId, actor, action: 'checkout_replaced', detail: { session: site.checkout_session_id, reason: open?.status === 'open' ? 'expiring or price changed' : open?.status || 'not found' } })
  }

  const client = must(await db.from('clients').select('id, name, email, business').eq('id', site.client_id).single(), 'Client')
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
  if (!site.stripe_customer_id) await refuseDuplicate({ ...site, stripe_customer_id: customer })
  const meta = { care_site_id: site.id, client_id: site.client_id, plan: site.plan }
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: site.id,
    line_items: [{ price: check.price!.id, quantity: 1 }],
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: false,
    // Stripe allows at most 24 hours from creation; a few minutes are kept in hand.
    expires_at: Math.floor(Date.now() / 1000) + LINK_HOURS * 3600 - 300,
    success_url: `${appUrl()}/care/subscribed`,
    cancel_url: `${appUrl()}/care`,
  })
  const expires = new Date(session.expires_at * 1000).toISOString()
  await db.from('care_sites').update({
    checkout_session_id: session.id, checkout_url: session.url, checkout_expires_at: expires, checkout_price_id: check.price!.id, checkout_amount_cents: check.expected.amount_cents, updated_at: new Date().toISOString(),
  }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor, action: 'checkout_created', detail: { session: session.id, plan: site.plan, price: check.price!.id, amount_cents: check.expected.amount_cents, mode } })
  return { url: session.url!, id: session.id, expires_at: expires, reused: false, mode, check }
}

/** Kept for the existing route name: the checkout link to copy and send yourself. */
export const createCheckout = openCheckout

/** Everything shown before sending an invitation. Reads Stripe's price; creates nothing. */
export async function invitationPreview(siteId: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  const client = must(await db.from('clients').select('id, name, email, business').eq('id', site.client_id).single(), 'Client')
  const p = planInfo(site.plan)
  const recipient = { name: site.recipient_name || client.name || '', email: String(site.recipient_email || client.email || '').trim() }
  const blockers: string[] = []
  if (site.enrollment_status === 'ended') blockers.push('Care for this website has ended.')
  if (site.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(site.subscription_status || '')) blockers.push('This website already has a subscription.')
  if (!recipient.email) blockers.push('There is no recipient email. Add one in Website settings.')
  let check: PriceCheck
  try { check = await verifyCheckoutPrice(site) } catch (e) { check = { ok: false, problems: [String((e as Error).message || e)], expected: expectedCharge(site), price: null } }
  if (!check.ok) blockers.push(...check.problems)
  const allowed = recipient.email ? clientEmailAllowed(recipient.email) : { ok: false, reason: 'No recipient email.' }
  if (!allowed.ok && allowed.reason) blockers.push(allowed.reason)
  const linkOpen = !!site.checkout_url && !!site.checkout_expires_at && new Date(site.checkout_expires_at).getTime() > Date.now()
  return {
    recipient, client: { name: client.name, business: client.business }, site: { label: site.label, url: site.site_url },
    plan: { id: p.id, name: p.name, included_minutes: p.includedMinutes },
    amount_cents: check.expected.amount_cents, currency: 'USD', interval: 'month',
    check, blockers, ok: blockers.length === 0,
    link: site.checkout_session_id ? { expires_at: site.checkout_expires_at, open: linkOpen } : null,
    last_sent: site.invitation_sent_at ? { at: site.invitation_sent_at, to: site.invitation_sent_to } : null,
  }
}

let mailer: Resend | null = null

/**
 * Emails the client their checkout link, after the same checks as checkout
 * and only once you type the recipient address. Sending again for a link that
 * was already sent needs `resend: true`; an expired link is replaced first.
 */
export async function sendInvitation(siteId: string, body: { confirm_email?: string; resend?: boolean }, actor: string) {
  const pre = await invitationPreview(siteId)
  if (!pre.recipient.email) throw new CareError('There is no recipient email. Add one in Website settings.', 422)
  if (String(body.confirm_email || '').trim().toLowerCase() !== pre.recipient.email.toLowerCase()) throw new CareError(`Type the recipient address exactly (${pre.recipient.email}) to confirm.`, 422)
  const allowed = clientEmailAllowed(pre.recipient.email)
  if (!allowed.ok) throw new CareError(allowed.reason!, 403)
  const link = await openCheckout(siteId, actor)
  const site = must(await db.from('care_sites').select('invitation_sent_at, invitation_sent_to, checkout_session_id').eq('id', siteId).single(), 'Website')
  if (link.reused && site.invitation_sent_at && !body.resend) {
    throw new CareError(`This link was already sent to ${site.invitation_sent_to} on ${new Date(site.invitation_sent_at).toUTCString().slice(0, 16)}. Choose Send again to resend the same link.`, 409)
  }
  const m = subscriptionInvitation({
    name: pre.recipient.name, business: pre.client.business || '', siteLabel: pre.site.label, siteUrl: pre.site.url, planName: pre.plan.name,
    amount: dollars(link.check.expected.amount_cents), includedMinutes: pre.plan.included_minutes, link: link.url, expires: link.expires_at,
  })
  mailer ??= new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await mailer.emails.send(
    { from: BRAND.from, to: pre.recipient.email, replyTo: BRAND.email, subject: m.subject, html: m.html, text: m.text },
    { idempotencyKey: `care-invite-${link.id}-${body.resend ? Date.now() : 'first'}` },
  )
  if (error) throw new CareError(`The invitation wasn’t sent: ${error.message || 'the email provider refused it'}. The checkout link is still open; you can retry.`, 502)
  const now = new Date().toISOString()
  await db.from('care_sites').update({ invitation_sent_at: now, invitation_sent_to: pre.recipient.email, updated_at: now }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor, action: 'invitation_sent', detail: { to: pre.recipient.email, session: link.id, amount_cents: link.check.expected.amount_cents, resend: !!body.resend, provider_id: data?.id || null } })
  return { sent_to: pre.recipient.email, expires_at: link.expires_at, reused_link: link.reused, url: link.url }
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
        // The link has been used; it can't be sent or paid again.
        if (sub) await db.from('care_sites').update({ checkout_url: null, checkout_expires_at: null, updated_at: new Date().toISOString() }).eq('checkout_session_id', s.id)
        break
      }
      case 'checkout.session.expired': {
        const s = event.data.object as Stripe.Checkout.Session
        const site = (await db.from('care_sites').select('id').eq('checkout_session_id', s.id).maybeSingle()).data
        if (!site) { result = { ignored: 'Not the current checkout link for any website.' }; break }
        // Kept as the website's last link so the page can say it expired; a new invitation replaces it.
        await db.from('care_sites').update({ checkout_url: null, checkout_expires_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', site.id)
        await logActivity({ site_id: site.id, actor: 'stripe', action: 'checkout_expired', detail: { session: s.id } })
        result = { site_id: site.id, expired: true }
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
