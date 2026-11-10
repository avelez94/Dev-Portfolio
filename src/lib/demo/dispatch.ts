/**
 * Serves one admin request inside the demo. The browser sends the request it
 * would have made (see DemoMode.tsx); it runs here against the session's demo
 * data. Dashboard data and storage go straight to the demo database. Website
 * Care and the other admin API routes run their real handlers inside the demo
 * scope, so their database calls reach the demo database and their outside
 * services are simulated. Stripe is answered by the simulated Stripe
 * (stripe-sim.ts); the client's checkout page and the practice scenarios
 * have demo routes, and their notices go through the real processEvent.
 */
import 'server-only'
import { NextRequest } from 'next/server'
import { demoScope, type DemoScope } from './context'
import { rest, storage } from './rest'
import { DEMO_IDS, simulatedFindings } from './fixtures'
import { db, must, type Row } from '@/lib/care/db'
import { enqueueScan } from '@/lib/care/cycles'
import { processEvent } from '@/lib/care/stripe'
import { expireLink, payCheckout, runScenario, type Scenario } from './stripe-sim'
import { completeRun } from '@/lib/care/runs'
import { recordWork } from '@/lib/care/work-server'
import { loadBundle, buildSnapshot, hashSnapshot, markReady, approve } from '@/lib/care/report'
import { sendReport } from '@/lib/care/send'
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
import * as agreementDoc from '@/app/api/care/agreement/[token]/route'
import * as agreementPay from '@/app/api/care/agreement/[token]/checkout/route'
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

/** The scenario a website can practice, given its simulated subscription. */
const SCENARIOS: Scenario[] = ['renewal', 'failed_payment', 'cancel_at_period_end', 'cancel_now', 'repeat']

const fail = (e: unknown) => ({ error: String((e as Error).message || e), status: (e as { status?: number; statusCode?: number }).status || 409 })

/** The client paying on the simulated checkout page, then Stripe's notices through the real processEvent. */
async function demoPayment(sessionId: string) {
  try {
    const r = await payCheckout(processEvent, sessionId)
    const site = must(await db.from('care_sites').select('label, plan, agreed_monthly_price').eq('id', r.site_id).single(), 'Website')
    note('payment', `Simulated checkout paid for ${site.label}. Stripe's notices were processed: ${r.delivered.map((d) => `${d.type} (${d.status})`).join(', ')}. No Stripe call was made.`)
    await simulateRunner()
    const cycle = (await db.from('care_cycles').select('id, hold_reason').eq('site_id', r.site_id).order('created_at', { ascending: false }).limit(1).maybeSingle()).data
    return { site_id: r.site_id, cycle_id: cycle?.id || null, held: !!cycle?.hold_reason, delivered: r.delivered }
  } catch (e) { return fail(e) }
}

async function demoScenario(siteId: string, scenario: string) {
  if (!SCENARIOS.includes(scenario as Scenario) && scenario !== 'expire_link') return { error: 'Unknown practice scenario.', status: 422 }
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  try {
    if (scenario === 'expire_link') {
      if (!site.checkout_session_id) return { error: 'There is no open checkout link to expire. Have the client sign and choose Continue to payment first.', status: 409 }
      const delivered = await expireLink(processEvent, siteId, site.checkout_session_id)
      note('payment', `Simulated: the checkout link for ${site.label} expired before it was used. Stripe's notice was processed: ${delivered.map((d) => `${d.type} (${d.status})`).join(', ')}.`)
      return { summary: 'The checkout link expired. Continue to payment on the agreement page makes a fresh one.', delivered }
    }
    if (!site.stripe_subscription_id) return { error: 'This website has no subscription to practice with. Use Lakeside Dental, or complete a simulated checkout first.', status: 409 }
    const r = await runScenario(processEvent, siteId, site.stripe_subscription_id, scenario as Scenario)
    note('payment', `Practice for ${site.label}: ${r.summary} Notices processed: ${r.delivered.map((d) => `${d.type} (${d.status}${d.note ? `: ${d.note}` : ''})`).join(', ')}. No Stripe call was made.`)
    await simulateRunner()
    return r
  } catch (e) { return fail(e) }
}

async function careOverride(method: string, seg: string[], body: Row, query: URLSearchParams): Promise<DemoResponse | null> {
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
  if (key === 'POST demo-checkout/pay') { const r = await demoPayment(String(body.session || '')); return reply('status' in r ? r.status as number : 200, r) }
  if (key === 'GET demo-checkout/session') {
    const sid = String(query.get('session') || '')
    const sess = (await db.from('demo_stripe').select('data').eq('id', sid).eq('kind', 'session').maybeSingle()).data?.data
    if (!sess) return reply(404, { error: 'This checkout link isn’t valid.' })
    const expired = sess.status === 'open' && sess.expires_at * 1000 <= Date.now()
    return reply(200, { id: sess.id, status: expired ? 'expired' : sess.status, expires_at: new Date(sess.expires_at * 1000).toISOString(), site_id: sess.metadata?.care_site_id, price: sess.price })
  }
  if (key === 'POST sites/:id/demo-scenario') { const r = await demoScenario(seg[1], String(body.scenario || '')); return reply('status' in r ? r.status as number : 200, r) }
  if (key === 'POST sites/:id/portal') { note('note', 'Simulated Stripe billing portal link. No Stripe call was made.'); return reply(200, { url: `/admin/care?site=${seg[1]}`, simulated: true }) }
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
    let body: Row = {}
    try { body = raw.length ? JSON.parse(raw.toString('utf8')) : {} } catch { body = {} }
    const over = await careOverride(r.method, seg, body, params)
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
  if (doc && doc[2] === 'agreement') {
    // The client's care agreement page: read, sign (real signing, PDF and simulated email), then pay on the simulated checkout.
    const pay = r.path.endsWith('/checkout')
    const token = r.path.split('/')[4]
    const h = ((pay ? agreementPay : agreementDoc) as unknown as RouteModule)[r.method as 'GET']
    if (!h) return reply(405, { error: 'Method not allowed' })
    return fromResponse(await h(new NextRequest(url, init), { params: Promise.resolve({ token }) }))
  }
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
  await recordWork(DEMO_IDS.cycles.physioPrev, {
    batch_key: 'demo-seed-physio-prev', confirmed: true, completed_on: new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10),
    lines: [{ source: 'preset', preset_id: preset.id, quantity: 1, client_description: 'Replaced the front desk photo you supplied.' }],
  }, 'admin')
  // The checks finish last, so the suggested Report text starts from the seeded work too.
  await simulateRunner()
  // Last month's send is history, not something that happened in this session: keep it out of Simulated actions.
  const log = demoScope.getStore()?.log
  const before = log?.length ?? 0
  await finishPreviousMonth()
  log?.splice(before)
}

/** Northside Physio's previous month, reviewed, approved and sent with the real functions, then dated to last month. */
async function finishPreviousMonth() {
  const cycle = DEMO_IDS.cycles.physioPrev
  const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
  await markReady(cycle, 'admin')
  const snap = await buildSnapshot(await loadBundle(cycle))
  await approve(cycle, { snapshot_hash: hashSnapshot(snap), signoff: true, approver: 'Alante Velez' }, 'admin')
  const report = must(await db.from('care_reports').select('id, current_approval_id').eq('cycle_id', cycle).single(), 'Report')
  await sendReport(cycle, { approval_id: report.current_approval_id, confirm_email: 'frontdesk@example.com', subject: 'Your website health report', message: 'Hi Sam, here is last month’s report for Northside Physio.' }, 'admin')
  await db.from('care_scan_runs').update({ started_at: ago(33), finished_at: ago(33), created_at: ago(33) }).eq('cycle_id', cycle)
  await db.from('care_report_approvals').update({ approved_at: ago(28) }).eq('report_id', report.id)
  await db.from('care_report_sends').update({ created_at: ago(27), finished_at: ago(27) }).eq('report_id', report.id)
  await db.from('care_cycles').update({ completed_at: ago(27) }).eq('id', cycle)
  await db.from('care_work_entries').update({ recorded_at: ago(31) }).eq('cycle_id', cycle)
}
