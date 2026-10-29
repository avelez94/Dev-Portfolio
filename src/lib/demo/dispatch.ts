/**
 * Serves one admin request inside the demo. The browser sends the request it
 * would have made (see DemoMode.tsx); it runs here against the session's demo
 * data. Dashboard data and storage go straight to the demo database. Website
 * Care and the other admin API routes run their real handlers inside the demo
 * scope, so their database calls reach the demo database and their outside
 * services are simulated. A few Stripe actions have demo versions, because
 * the Stripe SDK can't be pointed at the demo.
 */
import 'server-only'
import { NextRequest } from 'next/server'
import { demoScope, type DemoScope } from './context'
import { rest, storage } from './rest'
import { DEMO_IDS, simulatedFindings } from './fixtures'
import { db, must, logActivity, type Row } from '@/lib/care/db'
import { createCycle, enqueueScan } from '@/lib/care/cycles'
import { completeRun } from '@/lib/care/runs'
import { recordWork } from '@/lib/care/work-server'
import { plan as planInfo } from '@/lib/care/plans'
import * as careRoute from '@/app/api/care/admin/[...path]/route'
import * as invoicesSend from '@/app/api/invoices/send/route'
import * as emailSend from '@/app/api/email/send/route'
import * as meetings from '@/app/api/meetings/schedule/route'
import * as proposals from '@/app/api/proposals/route'
import * as sows from '@/app/api/sows/route'
import * as contracts from '@/app/api/contracts/route'
import * as contractsSigned from '@/app/api/contracts/send-signed/route'
import * as debtPayoff from '@/app/api/debt-payoff/route'
import * as proposalDoc from '@/app/api/proposals/[id]/route'
import * as sowDoc from '@/app/api/sows/[id]/route'
import * as contractDoc from '@/app/api/contracts/[id]/route'
import { DEMO_PUBLIC_DOCS } from './mode'

export type DemoRequest = { method: string; path: string; search: string; headers: Record<string, string>; body: string }
export type DemoResponse = { status: number; headers: Record<string, string>; body: string }

/** The same tables and bucket the real /api/admin/data route allows, plus the debt tracker's table. */
const TABLES = new Set([
  'availability', 'blocked_dates', 'blocked_slots', 'bookings', 'clients', 'contracts', 'documents',
  'intake_submissions', 'invoice_milestones', 'invoices', 'meetings', 'pricing', 'projects', 'proposals', 'sows', 'debt_payoff',
])

type RouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', (req: NextRequest, ctx: { params: Promise<Record<string, unknown>> }) => Promise<Response>>>
const ROUTES: Record<string, RouteModule> = {
  '/api/invoices/send': invoicesSend, '/api/email/send': emailSend, '/api/meetings/schedule': meetings, '/api/proposals': proposals,
  '/api/sows': sows, '/api/contracts': contracts, '/api/contracts/send-signed': contractsSigned, '/api/debt-payoff': debtPayoff,
}

const reply = (status: number, data: unknown): DemoResponse => ({ status, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(data)).toString('base64') })

async function fromResponse(r: Response): Promise<DemoResponse> {
  const headers: Record<string, string> = {}
  r.headers.forEach((v, k) => { if (['content-type', 'content-disposition', 'content-range', 'cache-control'].includes(k)) headers[k] = v })
  return { status: r.status, headers, body: Buffer.from(await r.arrayBuffer()).toString('base64') }
}

function note(kind: 'payment' | 'note' | 'scan', summary: string) {
  demoScope.getStore()?.log.push({ at: new Date().toISOString(), kind, summary })
}

/* ------------------------- simulated services ------------------------- */

/** Stands in for the check runner: queues due checks (as the hourly cron would) and finishes them with fictional results. */
export async function simulateRunner() {
  const due = (await db.from('care_cycles').select('id, site_id').eq('scan_state', 'not_started').is('hold_reason', null).is('completed_at', null)).data || []
  for (const c of due) await enqueueScan(c.id, 'scheduled', 'demo')
  await db.from('care_scan_runs').update({ available_at: new Date().toISOString() }).eq('status', 'queued')
  for (let i = 0; i < 10; i++) {
    const claimed = await db.rpc('care_claim_scan_run', { p_owner: 'demo-runner', p_lease_seconds: 300 })
    const run = (claimed.data as Row[] | null)?.[0]
    if (!run) break
    const findings = simulatedFindings(run.config || {})
    await completeRun(run.id, 'demo-runner', { outcome: 'succeeded', findings: findings as Parameters<typeof completeRun>[2]['findings'] })
    const site = (await db.from('care_sites').select('label').eq('id', run.site_id).single()).data
    note('scan', `Simulated check finished for ${site?.label || 'a website'}: ${findings.length} results`)
  }
}

/** Step 1, like createCheckout: links a (simulated) Stripe customer and returns a checkout link. Nothing is paid yet. */
async function demoCheckoutLink(siteId: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (site.enrollment_status === 'ended') return { error: 'Care for this website has ended.', status: 409 }
  if (site.stripe_subscription_id) return { error: 'This website already has a subscription. Use the billing portal link instead.', status: 409 }
  const customer = site.stripe_customer_id || `cus_demo_${siteId.slice(-6)}`
  await db.from('care_sites').update({ stripe_customer_id: customer, updated_at: new Date().toISOString() }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor: 'admin', action: 'checkout_created', detail: { session: 'cs_demo', plan: site.plan, mode: 'demo' } })
  note('note', `Simulated Stripe checkout link created for ${site.label}. Nothing was emailed; in real use you send the link yourself.`)
  return { url: `/admin/care/demo-checkout?site=${siteId}`, simulated: true }
}

/**
 * Step 2, the client paying: what Stripe's verified payment notices would do
 * (handleInvoicePaid and syncSubscription). Stripe charges the plan's Stripe
 * Price, which can differ from the agreed monthly price recorded for reports.
 */
async function demoPayment(siteId: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (!site.stripe_customer_id) return { error: 'Create the checkout link first.', status: 409 }
  if (site.stripe_subscription_id) return { error: 'This website already has a subscription.', status: 409 }
  const tag = siteId.slice(-6)
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 86_400_000)
  const charged = planInfo(site.plan).monthly
  await db.from('care_sites').update({
    stripe_subscription_id: `sub_demo_${tag}`, subscription_status: 'active', billing_state: 'active', stripe_synced_at: now.toISOString(),
    current_period_start: now.toISOString(), current_period_end: end.toISOString(), paid_through: end.toISOString(), updated_at: now.toISOString(),
  }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor: 'stripe', action: 'subscription_linked', detail: { subscription: `sub_demo_${tag}`, simulated: true } })
  const r = await createCycle({ siteId, source: 'stripe', invoiceId: `in_demo_${tag}_${now.getTime()}`, subscriptionId: `sub_demo_${tag}`, periodStart: now, periodEnd: end, plan: site.plan, paidAt: now, amountPaid: charged * 100, currency: 'usd', actor: 'stripe' })
  const differs = typeof site.agreed_monthly_price === 'number' && site.agreed_monthly_price !== charged
  note('payment', `Simulated first payment of $${charged} for ${site.label} (the ${planInfo(site.plan).name} Stripe price).${differs ? ` The agreed price recorded for reports is $${site.agreed_monthly_price}; Stripe would still charge $${charged}.` : ''} No Stripe call was made.`)
  await simulateRunner()
  return { cycle_id: r.cycle.id, held: !!r.cycle.hold_reason, charged }
}

async function careOverride(method: string, seg: string[]): Promise<DemoResponse | null> {
  const key = `${method} ${seg.map((s, i) => (i === 1 && /^[0-9a-f-]{36}$/i.test(s) ? ':id' : s)).join('/')}`
  if (key === 'GET status') {
    return reply(200, {
      enabled: true, demo: true,
      stripe: { mode: 'test', webhook: false, prices: { essential: true, business: true, premium: true }, simulated: true },
      runner: { token: false, dispatch: false, simulated: true },
      email: { provider: true, clientEmailsLive: false, allowlist: [], simulated: true },
      calendar: { adminCalendar: true, resendWebhook: false },
      policyApproved: false,
    })
  }
  if (key === 'POST sites/:id/checkout') { const r = await demoCheckoutLink(seg[1]); return reply('status' in r ? r.status as number : 200, r) }
  if (key === 'POST sites/:id/demo-pay') { const r = await demoPayment(seg[1]); return reply('status' in r ? r.status as number : 200, r) }
  if (key === 'POST sites/:id/portal') { note('note', 'Simulated Stripe billing portal link. No Stripe call was made.'); return reply(200, { url: `/admin/care?site=${seg[1]}`, simulated: true }) }
  if (key === 'POST sites/:id/sync') { note('note', 'Simulated Stripe sync. Nothing was fetched from Stripe.'); return reply(200, { ok: true, simulated: true }) }
  return null
}

/* ------------------------------- dispatch ------------------------------- */

export async function dispatchDemo(r: DemoRequest, origin: string, cookie: string): Promise<DemoResponse> {
  const scope = demoScope.getStore() as DemoScope
  const raw = Buffer.from(r.body || '', 'base64')
  const headers = new Headers(r.headers)
  const params = new URLSearchParams(r.search)

  if (r.path.startsWith('/api/admin/data/')) {
    const parts = r.path.slice('/api/admin/data/'.length).split('/').filter(Boolean)
    if (parts.some((p) => p === '..' || p === '.')) return reply(403, { error: 'Not allowed' })
    if (parts[0] === 'rest' && parts[1] === 'v1' && parts.length === 3 && TABLES.has(parts[2])) {
      const out = await rest(scope, r.method, [decodeURIComponent(parts[2])], params, headers, raw)
      return { status: out.status, headers: out.headers || {}, body: Buffer.from(out.body ?? '').toString('base64') }
    }
    if (parts[0] === 'storage' && parts[1] === 'v1' && parts[2] === 'object' && parts.includes('freelance-docs')) {
      const out = await storage(scope, r.method, parts.slice(2), headers, raw)
      return { status: out.status, headers: out.headers || {}, body: Buffer.from(out.body ?? '').toString('base64') }
    }
    return reply(403, { error: 'Not allowed' })
  }

  const init = { method: r.method, headers: new Headers({ ...r.headers, cookie }), body: ['GET', 'HEAD'].includes(r.method) ? undefined : new Uint8Array(raw) }
  const url = new URL(r.path + (r.search ? `?${r.search.replace(/^\?/, '')}` : ''), origin)

  if (r.path.startsWith('/api/care/admin/')) {
    const seg = r.path.slice('/api/care/admin/'.length).split('/').filter(Boolean).map(decodeURIComponent)
    const over = await careOverride(r.method, seg)
    if (over) return over
    const handler = (careRoute as unknown as RouteModule)[r.method as 'GET']
    if (!handler) return reply(405, { error: 'Method not allowed' })
    const res = await fromResponse(await handler(new NextRequest(url, init), { params: Promise.resolve({ path: seg }) }))
    if (r.method !== 'GET') await simulateRunner()
    // Checkout is simulated in the demo, so every plan counts as having its Stripe price.
    if (r.method === 'GET' && seg.join('/') === 'template' && res.status === 200) {
      const t = JSON.parse(Buffer.from(res.body, 'base64').toString('utf8'))
      t.plans = (t.plans || []).map((p: Row) => ({ ...p, priceConfigured: true }))
      return reply(200, t)
    }
    return res
  }

  // Client document pages opened from a demo session: the real handlers, on demo data.
  const doc = r.path.match(DEMO_PUBLIC_DOCS)
  if (doc) {
    const m = ({ proposals: proposalDoc, sows: sowDoc, contracts: contractDoc } as unknown as Record<string, RouteModule>)[doc[1]]
    const h = m?.[r.method as 'GET']
    if (!h) return reply(405, { error: 'Method not allowed' })
    return fromResponse(await h(new NextRequest(url, init), { params: Promise.resolve({ id: r.path.split('/').pop() }) }))
  }

  const mod = ROUTES[r.path]
  const handler = mod?.[r.method as 'POST']
  if (!handler) return reply(404, { error: 'Not available in the demo' })
  return fromResponse(await handler(new NextRequest(url, init), { params: Promise.resolve({}) }))
}

/** The parts of a new demo session that go through the real care functions. */
export async function seedWork() {
  const preset = must(await db.from('care_task_presets').select('id').eq('key', 'image-replace').single(), 'Preset')
  await recordWork(DEMO_IDS.cycles.physio, {
    batch_key: 'demo-seed-physio-images', confirmed: true, completed_on: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
    lines: [{ source: 'preset', preset_id: preset.id, quantity: 2, client_description: 'Replaced two treatment room photos you supplied.' }],
  }, 'admin')
  // The checks finish last, so the suggested Report text starts from the seeded work too.
  await simulateRunner()
}
