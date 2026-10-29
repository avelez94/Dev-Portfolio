/**
 * Website Care admin API. Every request needs the admin cookie, and the whole
 * feature answers 404 unless WEBSITE_CARE_ENABLED is "true".
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { careEnabled, careOff, clientEmailAllowed } from '@/lib/care/config'
import { db, must, CareError, getSettings, logActivity, getObject, EVIDENCE_BUCKET, REPORTS_BUCKET, type Row } from '@/lib/care/db'
import { parseSiteInput, setupHash, assertSitePricing, assertClient, confirmSite, CHECKLIST_TEMPLATE, LIMIT_DEFAULTS, LIMIT_CAPS } from '@/lib/care/sites'
import { createCycle, enqueueScan, cancelScan, releaseHeldCycles } from '@/lib/care/cycles'
import { loadBundle, buildSnapshot, hashSnapshot, readinessProblems, updateContent, updateManual, updateFinding, markReady, approve, invalidateApproval, updateIssueNote, updatePlanTime } from '@/lib/care/report'
import { groupFindings, groupKey, type FindingIn } from '@/lib/care/report-model'
import { reportPdf } from '@/lib/care/report-pdf'
import { sendPreview, sendReport, markStuckSend } from '@/lib/care/send'
import { createCheckout, portalSession, syncSubscription, stripeMode } from '@/lib/care/stripe'
import { deliver } from '@/lib/care/notify'
import { diffFindings, type FindingRow } from '@/lib/care/findings'
import { checkUrlResolves } from '@/lib/care/url-safety'
import { validTimeZone, zonedToUtc, localDate } from '@/lib/care/schedule'
import { isPlanId, plan as planInfo, priceIdFor, PLAN_IDS } from '@/lib/care/plans'
import * as work from '@/lib/care/work-server'
import { CARE_TERMS_VERSION } from '@/content/care-terms'

export const maxDuration = 60

const ACTOR = 'admin'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

type Ctx = { req: NextRequest; seg: string[]; body: Row }
type Handler = (c: Ctx) => Promise<Response>

function id(v: string | undefined) {
  if (!v || !UUID.test(v)) throw new CareError('Not found', 404)
  return v
}

/* ------------------------------ overview ------------------------------ */

async function status() {
  const s = await getSettings()
  return ok({
    enabled: true,
    stripe: { mode: stripeMode(), webhook: !!process.env.STRIPE_WEBHOOK_SECRET, prices: Object.fromEntries(PLAN_IDS.map((p) => [p, !!priceIdFor(p)])) },
    runner: { token: !!process.env.CARE_RUNNER_TOKEN, dispatch: !!(process.env.CARE_GITHUB_DISPATCH_TOKEN && process.env.CARE_GITHUB_REPO) },
    email: { provider: !!process.env.RESEND_API_KEY, clientEmailsLive: process.env.CARE_CLIENT_EMAIL_LIVE === 'true', allowlist: (process.env.CARE_EMAIL_ALLOWLIST || '').split(',').filter(Boolean) },
    calendar: { adminCalendar: true, resendWebhook: !!process.env.RESEND_WEBHOOK_SECRET },
    policyApproved: !!s.policy_approved_at,
  })
}

async function overview() {
  const sites = (await db.from('care_sites').select('*').order('created_at')).data || []
  const clientIds = [...new Set(sites.map((s) => s.client_id))]
  const clients = clientIds.length ? (await db.from('clients').select('id, name, business, email').in('id', clientIds)).data || [] : []
  const cycles = (await db.from('care_cycles').select('*').order('review_due_at').limit(300)).data || []
  const reports = cycles.length ? (await db.from('care_reports').select('id, cycle_id, status, version').in('cycle_id', cycles.map((c) => c.id))).data || [] : []
  const failedRuns = (await db.from('care_scan_runs').select('id, cycle_id, site_id, error, finished_at, attempts').eq('status', 'failed').order('finished_at', { ascending: false }).limit(20)).data || []
  const activeRuns = (await db.from('care_scan_runs').select('id, cycle_id, status, progress, attempts, available_at').in('status', ['queued', 'running'])).data || []
  const failedNotes = (await db.from('care_notifications').select('id, kind, cycle_id, error, attempts, created_at, status').in('status', ['failed', 'pending']).gt('attempts', 0).order('created_at', { ascending: false }).limit(20)).data || []
  const failedEvents = (await db.from('care_stripe_events').select('id, type, error, received_at, attempts').eq('status', 'failed').order('received_at', { ascending: false }).limit(20)).data || []
  const stuckSends = (await db.from('care_report_sends').select('id, report_id, recipient_email, created_at, status, error').in('status', ['sending', 'failed']).order('created_at', { ascending: false }).limit(20)).data || []
  const settings = await getSettings()
  const workFlags = await work.workFlags()
  return ok({ sites, clients, cycles, reports, failedRuns, activeRuns, failedNotes, failedEvents, stuckSends, workFlags, timezone: settings.timezone, policyApproved: !!settings.policy_approved_at })
}

/* ------------------------------ settings ------------------------------ */

async function getSettingsRoute() {
  const s = await getSettings()
  return ok(s)
}

async function putSettings({ body }: Ctx) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.timezone !== undefined) {
    if (!validTimeZone(String(body.timezone))) throw new CareError('Unknown time zone.')
    patch.timezone = String(body.timezone)
  }
  if (body.working_days !== undefined) {
    const d = (Array.isArray(body.working_days) ? body.working_days : []).map(Number).filter((n: number) => n >= 1 && n <= 7)
    patch.working_days = [...new Set(d)].sort()
  }
  for (const k of ['work_start', 'work_end'] as const) {
    if (body[k] !== undefined) {
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(body[k]))) throw new CareError('Times must look like 09:00.')
      patch[k] = String(body[k]).slice(0, 5)
    }
  }
  const ints: [string, number, number][] = [['review_minutes', 15, 480], ['review_window_days', 1, 28], ['lead_days', 0, 14], ['overdue_reminder_hours', 12, 720], ['overdue_reminder_max', 0, 10], ['billing_attention_after_failures', 1, 10], ['evidence_retention_days', 30, 730]]
  for (const [k, lo, hi] of ints) {
    if (body[k] === undefined) continue
    const n = Number(body[k])
    if (!Number.isInteger(n) || n < lo || n > hi) throw new CareError(`${k.replace(/_/g, ' ')} must be ${lo} to ${hi}.`)
    patch[k] = n
  }
  if (body.grace_days !== undefined) {
    if (body.grace_days === null || body.grace_days === '') patch.grace_days = null
    else {
      const n = Number(body.grace_days)
      if (!Number.isInteger(n) || n < 0 || n > 60) throw new CareError('Grace period must be 0 to 60 days.')
      patch.grace_days = n
    }
  }
  if (typeof body.start_reminder === 'boolean') patch.start_reminder = body.start_reminder
  if (body.notify_email !== undefined) {
    const e = String(body.notify_email || '').trim()
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new CareError('Notification email is not valid.')
    patch.notify_email = e || null
  }
  for (const k of ['refund_handling', 'dispute_handling', 'immediate_cancel_handling'] as const) {
    if (body[k] !== undefined) patch[k] = String(body[k]).slice(0, 60)
  }
  const before = await getSettings()
  const start = String(patch.work_start ?? before.work_start).slice(0, 5)
  const end = String(patch.work_end ?? before.work_end).slice(0, 5)
  if (start >= end) throw new CareError('The workday must end after it starts.')
  if (Array.isArray(patch.working_days) && patch.working_days.length === 0) throw new CareError('Choose at least one working day.')
  // Changing a billing policy value clears an earlier approval.
  const policyKeys = ['grace_days', 'billing_attention_after_failures', 'refund_handling', 'dispute_handling', 'immediate_cancel_handling']
  if (policyKeys.some((k) => k in patch && (patch as Record<string, unknown>)[k] !== (before as unknown as Record<string, unknown>)[k])) {
    patch.policy_approved_at = null
    patch.policy_approved_note = null
  }
  await db.from('care_settings').update(patch).eq('id', 1)
  await logActivity({ actor: ACTOR, action: 'settings_changed', detail: { keys: Object.keys(patch).filter((k) => k !== 'updated_at') } })
  return getSettingsRoute()
}

async function approvePolicy({ body }: Ctx) {
  const note = String(body.note || '').trim()
  if (body.confirm !== true || note.length < 5) throw new CareError('Tick the box and describe the approved policy (for example, where it is written in your care agreement).')
  const s = await getSettings()
  if (s.grace_days === null) throw new CareError('Set a grace period first (0 is allowed).')
  await db.from('care_settings').update({ policy_approved_at: new Date().toISOString(), policy_approved_note: note.slice(0, 1000) }).eq('id', 1)
  await logActivity({ actor: ACTOR, action: 'billing_policy_approved', detail: { note: note.slice(0, 200) } })
  return getSettingsRoute()
}

/* ------------------------------ sites ------------------------------ */

async function clients() {
  const r = await db.from('clients').select('id, name, business, email, created_at').order('created_at', { ascending: false }).limit(500)
  return ok({ clients: r.data || [] })
}

async function template() {
  return ok({ checklist: CHECKLIST_TEMPLATE, limits: LIMIT_DEFAULTS, caps: LIMIT_CAPS, plans: PLAN_IDS.map((p) => ({ ...planInfo(p), priceConfigured: !!priceIdFor(p) })) })
}

async function createSite({ body }: Ctx) {
  const { value, errors } = parseSiteInput(body)
  if (errors.length) throw new CareError(errors.join(' '), 422)
  await assertClient(value.client_id)
  await assertSitePricing(value)
  // New enrollments use the current care agreement terms (flexible plan time).
  const ins = await db.from('care_sites').insert({ ...value, enrollment_status: 'draft', care_terms_version: CARE_TERMS_VERSION, care_terms_note: 'Enrolled under the current care terms', care_terms_reviewed_at: new Date().toISOString() }).select('*').single()
  const site = must(ins, 'Website')
  await logActivity({ site_id: site.id, actor: ACTOR, action: 'enrollment_created', detail: { plan: value.plan } })
  return ok({ site }, 201)
}

async function getSite({ seg }: Ctx) {
  const siteId = id(seg[1])
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  const client = (await db.from('clients').select('id, name, business, email').eq('id', site.client_id).maybeSingle()).data
  const cycles = (await db.from('care_cycles').select('*').eq('site_id', siteId).order('period_start', { ascending: false })).data || []
  const reports = cycles.length ? (await db.from('care_reports').select('id, cycle_id, status, version').in('cycle_id', cycles.map((c) => c.id))).data || [] : []
  const activity = (await db.from('care_activity').select('*').eq('site_id', siteId).order('created_at', { ascending: false }).limit(60)).data || []
  return ok({ site, client, cycles, reports, activity, setupChanged: site.confirmed_hash ? site.confirmed_hash !== setupHash(site) : false })
}

async function putSite({ seg, body }: Ctx) {
  const siteId = id(seg[1])
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (site.enrollment_status === 'ended') throw new CareError('Care for this website has ended. Its history is kept but it can’t be edited.', 409)
  const { value, errors } = parseSiteInput({ ...site, ...body })
  if (errors.length) throw new CareError(errors.join(' '), 422)
  if (value.client_id !== site.client_id && site.stripe_subscription_id) throw new CareError('This website is linked to a subscription, so its client can’t be changed.', 409)
  await assertClient(value.client_id)
  await assertSitePricing(value, siteId)
  const patch: Record<string, unknown> = { ...value, updated_at: new Date().toISOString() }
  if (site.stripe_subscription_id) delete patch.plan // the subscription decides the plan once billing is linked
  const changed = site.enrollment_status === 'confirmed' && setupHash({ ...site, ...value }) !== site.confirmed_hash
  if (changed) patch.enrollment_status = 'draft'
  const saved = must(await db.from('care_sites').update(patch).eq('id', siteId).select('*').single(), 'Website')
  if (changed) await logActivity({ site_id: siteId, actor: ACTOR, action: 'setup_changed_needs_confirmation', detail: {} })
  // A new recipient changes what an approved report would say, so open approvals are cleared.
  if (site.recipient_email !== saved.recipient_email || site.recipient_name !== saved.recipient_name) {
    const open = (await db.from('care_cycles').select('id').eq('site_id', siteId).is('completed_at', null)).data || []
    for (const c of open) await invalidateApproval(c.id, 'The report recipient changed.', ACTOR)
  }
  // Open reviews without their own recorded price show the website's agreed price.
  if (site.agreed_monthly_price !== saved.agreed_monthly_price) {
    const open = (await db.from('care_cycles').select('id').eq('site_id', siteId).is('completed_at', null).is('agreed_price', null)).data || []
    for (const c of open) await invalidateApproval(c.id, 'The agreed monthly price changed.', ACTOR)
  }
  return ok({ site: saved, needsConfirmation: changed })
}

async function confirm({ seg, body }: Ctx) {
  const siteId = id(seg[1])
  const site = await confirmSite(siteId, body, ACTOR)
  const released = await releaseHeldCycles(siteId, ACTOR)
  return ok({ site, released })
}

function setStatus(to: 'paused' | 'confirmed' | 'ended'): Handler {
  return async ({ seg, body }: Ctx) => {
    const siteId = id(seg[1])
    const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
    if (to === 'confirmed') {
      if (site.enrollment_status !== 'paused') throw new CareError('Only a paused website can be resumed.', 409)
      if (site.confirmed_hash !== setupHash(site)) throw new CareError('The setup changed while paused. Confirm it again.', 409)
    }
    if (to === 'ended' && body.confirm !== true) throw new CareError('Confirm ending care for this website.', 422)
    await db.from('care_sites').update({ enrollment_status: to, updated_at: new Date().toISOString() }).eq('id', siteId)
    await logActivity({ site_id: siteId, actor: ACTOR, action: `enrollment_${to}`, detail: {} })
    if (to === 'confirmed') await releaseHeldCycles(siteId, ACTOR)
    return ok({ ok: true })
  }
}

async function checkout({ seg }: Ctx) {
  return ok(await createCheckout(id(seg[1]), ACTOR))
}
async function portal({ seg }: Ctx) {
  return ok(await portalSession(id(seg[1]), ACTOR))
}
async function sync({ seg }: Ctx) {
  const site = must(await db.from('care_sites').select('stripe_subscription_id').eq('id', id(seg[1])).single(), 'Website')
  if (!site.stripe_subscription_id) throw new CareError('No subscription is linked yet.', 409)
  return ok(await syncSubscription(site.stripe_subscription_id, ACTOR))
}

async function clearBilling({ seg, body }: Ctx) {
  const siteId = id(seg[1])
  const note = String(body.note || '').trim()
  if (note.length < 3) throw new CareError('Add a short note about how you handled it.')
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  const next = site.subscription_status === 'active' ? (site.cancel_at_period_end ? 'canceling' : 'active') : site.billing_state
  await db.from('care_sites').update({ billing_state: next, billing_attention_since: null, failed_payment_count: 0, updated_at: new Date().toISOString() }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor: ACTOR, action: 'billing_attention_cleared', detail: { note: note.slice(0, 300), from: site.billing_state } })
  return ok({ ok: true })
}

/** A service period for a client billed outside Stripe (for example by invoice). */
async function manualCycle({ seg, body }: Ctx) {
  const siteId = id(seg[1])
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (site.stripe_subscription_id) throw new CareError('This website is billed through Stripe, so its periods come from paid invoices.', 409)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.period_start)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.period_end))) throw new CareError('Enter the paid period start and end dates.')
  if (body.confirm_paid !== true) throw new CareError('Confirm this period has been paid or agreed in writing.', 422)
  const s = await getSettings()
  const start = zonedToUtc(String(body.period_start), '00:00', s.timezone)
  const end = zonedToUtc(String(body.period_end), '00:00', s.timezone)
  if (end <= start) throw new CareError('The period must end after it starts.')
  if (!isPlanId(site.plan)) throw new CareError('Choose a plan first.')
  const r = await createCycle({ siteId, source: 'manual', periodStart: start, periodEnd: end, plan: site.plan, paidAt: new Date(), actor: ACTOR })
  if (!r.created) throw new CareError('A review cycle already exists for that period.', 409)
  if (body.note) await db.from('care_cycles').update({ manual_note: String(body.note).slice(0, 500) }).eq('id', r.cycle.id)
  return ok({ cycle: r.cycle }, 201)
}

async function checkUrl({ body }: Ctx) {
  const domains = Array.isArray(body.approved_domains) ? body.approved_domains : String(body.approved_domains || '').split(/[\s,]+/).filter(Boolean)
  return ok(await checkUrlResolves(String(body.url || ''), domains.length ? domains : undefined))
}

/* ------------------------------ cycles ------------------------------ */

async function getCycle({ seg }: Ctx) {
  const cycleId = id(seg[1])
  const b = await loadBundle(cycleId)
  const snapshot = await buildSnapshot(b)
  const hash = hashSnapshot(snapshot)
  const allFindings = (await db.from('care_findings').select('*').eq('cycle_id', cycleId).order('created_at')).data || []
  const prevFindings = b.previousRun ? b.earlierFindings.filter((f: Row) => f.run_id === b.previousRun.id) : []
  const diff = b.previousRun ? diffFindings(prevFindings as FindingRow[], b.findings as FindingRow[]) : null
  const settings = await getSettings()
  const notifications = (await db.from('care_notifications').select('id, kind, status, attempts, error, created_at, sent_at').eq('cycle_id', cycleId).order('created_at', { ascending: false })).data || []
  const activity = (await db.from('care_activity').select('*').eq('cycle_id', cycleId).order('created_at', { ascending: false }).limit(60)).data || []
  // Grouped view for the review screen: one card per issue type, with its raw results.
  const cfg = b.latest?.config || { pages: b.site.pages || [], destinations: b.site.destinations || [] }
  const groups = groupFindings(b.findings.map((f: Row) => ({ ...f, client_visible: true }) as FindingIn), cfg.pages || [], cfg.destinations || []).map((g) => ({
    ...g,
    note: b.notes.find((n: Row) => n.group_key === g.key) || null,
    items: b.findings.filter((f: Row) => groupKey(f as FindingIn) === g.key),
  }))
  // Issues an earlier check this month found that the latest check no longer shows.
  const latestKeys = new Set(groups.map((g) => g.key))
  const cleared = groupFindings(b.earlierFindings.map((f: Row) => ({ ...f, client_visible: true }) as FindingIn), cfg.pages || [], cfg.destinations || [])
    .filter((g) => g.severity === 'issue' && !latestKeys.has(g.key))
    .map((g) => ({ ...g, severity: 'cleared', note: b.notes.find((n: Row) => n.group_key === g.key) || null, items: [] }))
  const manualIssues = b.manual.filter((m: Row) => m.status === 'failed').map((m: Row) => ({ key: `manual:${m.item_id}`, title: m.label, note: b.notes.find((n: Row) => n.group_key === `manual:${m.item_id}`) || null }))
  const statusCounts: Record<string, number> = {}
  for (const f of b.findings) if (f.check_key !== 'screenshot') statusCounts[f.status] = (statusCounts[f.status] || 0) + 1
  const checkedUrls = { pages: (cfg.pages || []).map((p: Row) => p.url), destinations: (cfg.destinations || []).map((d: Row) => d.url) }
  const currentUrls = { pages: (b.site.pages || []).map((p: Row) => p.url), destinations: (b.site.destinations || []).map((d: Row) => d.url) }
  return ok({
    ...b, allFindings, snapshot, snapshotHash: hash, problems: await readinessProblems(b), diff, notifications, activity, groups, cleared, manualIssues, statusCounts,
    scope: { checked: checkedUrls, setupChangedSinceCheck: !!b.latest && JSON.stringify(checkedUrls) !== JSON.stringify(currentUrls) },
    timezone: settings.timezone, plan: planInfo(b.cycle.plan), recipientAllowed: b.site.recipient_email ? clientEmailAllowed(b.site.recipient_email) : null,
  })
}

async function putIssue({ seg, body }: Ctx) {
  await updateIssueNote(id(seg[1]), String(body.group_key || ''), body, ACTOR)
  return ok({ ok: true })
}

/** Care reviews for the admin Schedule calendar: one item per review cycle. */
async function calendarItems() {
  const s = await getSettings()
  const since = new Date(Date.now() - 60 * 86400_000).toISOString()
  const cycles = (await db.from('care_cycles').select('*').or(`completed_at.is.null,review_due_at.gte.${since}`).order('review_due_at').limit(200)).data || []
  if (!cycles.length) return ok({ items: [], timezone: s.timezone })
  const sites = (await db.from('care_sites').select('id, label, site_url, client_id').in('id', [...new Set(cycles.map((c) => c.site_id))])).data || []
  const clients = (await db.from('clients').select('id, name, business').in('id', [...new Set(sites.map((x) => x.client_id))])).data || []
  const reports = (await db.from('care_reports').select('id, cycle_id, status, version').in('cycle_id', cycles.map((c) => c.id))).data || []
  const sends = reports.length ? (await db.from('care_report_sends').select('report_id, status, delivery_status, finished_at').in('report_id', reports.map((r) => r.id)).eq('status', 'accepted')).data || [] : []
  const items = cycles.map((c) => {
    const site = sites.find((x) => x.id === c.site_id)
    const client = clients.find((x) => x.id === site?.client_id)
    const report = reports.find((r) => r.cycle_id === c.id)
    const send = sends.find((x) => x.report_id === report?.id)
    return {
      id: c.id,
      date: localDate(new Date(c.review_due_at), s.timezone),
      due: c.review_due_at,
      client: client?.business || client?.name || 'Unknown client',
      site: site?.label || '',
      url: site?.site_url || '',
      status: careStatus(c, report, send),
      overdue: !c.completed_at && new Date(c.review_due_at) < new Date(),
      done: !!c.completed_at,
      link: `/admin/care?cycle=${c.id}`,
    }
  })
  return ok({ items, timezone: s.timezone })
}

function careStatus(c: Row, report: Row | undefined, send: Row | undefined): string {
  if (send?.delivery_status === 'bounced' || send?.delivery_status === 'complained') return 'Sent, delivery failed'
  if (send?.delivery_status === 'delivered') return 'Sent and delivered'
  if (c.completed_at) return 'Sent, delivery not confirmed'
  if (c.hold_reason === 'enrollment') return 'Waiting for setup'
  if (c.scan_state === 'queued' || c.scan_state === 'running') return 'Automated check running'
  if (c.scan_state === 'failed') return 'Check failed'
  if (report?.status === 'approved') return 'Approved, not sent'
  if (report?.status === 'ready') return 'Ready for approval'
  if (c.scan_state === 'done' || c.scan_state === 'partial') return 'Manual review due'
  return 'Scheduled'
}

async function rerun({ seg }: Ctx) {
  const cycleId = id(seg[1])
  const r = await enqueueScan(cycleId, 'rerun', ACTOR)
  return ok({ run: r.run, created: r.created })
}

async function cancel({ seg }: Ctx) {
  return ok({ run_id: await cancelScan(id(seg[1]), ACTOR) })
}

async function putManual({ seg, body }: Ctx) {
  await updateManual(id(seg[1]), String(seg[3] || ''), body, ACTOR)
  return ok({ ok: true })
}

async function putDue({ seg, body }: Ctx) {
  const cycleId = id(seg[1])
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) throw new CareError('Choose a date.')
  const s = await getSettings()
  const due = zonedToUtc(String(body.date), s.work_end, s.timezone)
  const c = must(await db.from('care_cycles').select('*').eq('id', cycleId).single(), 'Cycle')
  if (due < new Date(c.period_start)) throw new CareError('The due date can’t be before the service period starts.')
  await db.from('care_cycles').update({ review_due_at: due.toISOString(), reminders_sent: 0, last_reminder_at: null, updated_at: new Date().toISOString() }).eq('id', cycleId)
  await logActivity({ cycle_id: cycleId, site_id: c.site_id, actor: ACTOR, action: 'due_date_changed', detail: { to: body.date } })
  return ok({ ok: true })
}

async function putPlanTime({ seg, body }: Ctx) {
  await updatePlanTime(id(seg[1]), body, ACTOR)
  return ok({ ok: true })
}

async function putReport({ seg, body }: Ctx) {
  const cycleId = id(seg[1])
  const r = must(await db.from('care_reports').select('id').eq('cycle_id', cycleId).single(), 'Report')
  return ok({ report: await updateContent(r.id, body, ACTOR) })
}

async function putFinding({ seg, body }: Ctx) {
  await updateFinding(id(seg[1]), body, ACTOR)
  return ok({ ok: true })
}

async function ready({ seg }: Ctx) {
  await markReady(id(seg[1]), ACTOR)
  return ok({ ok: true })
}

async function backToDraft({ seg }: Ctx) {
  const cycleId = id(seg[1])
  const r = must(await db.from('care_reports').select('status').eq('cycle_id', cycleId).single(), 'Report')
  if (r.status !== 'ready' && r.status !== 'approved') throw new CareError('The report is not ready or approved.', 409)
  await invalidateApproval(cycleId, 'Returned to draft by the owner.', ACTOR)
  return ok({ ok: true })
}

async function approveRoute({ seg, body }: Ctx) {
  return ok(await approve(id(seg[1]), body, ACTOR))
}

async function pdf({ req, seg }: Ctx) {
  const cycleId = id(seg[1])
  const which = req.nextUrl.searchParams.get('version')
  let bytes: Buffer
  let name: string
  if (which) {
    // A stored approved (or sent) version: the exact file.
    const report = must(await db.from('care_reports').select('id').eq('cycle_id', cycleId).single(), 'Report')
    const a = must(await db.from('care_report_approvals').select('pdf_path, version').eq('report_id', report.id).eq('version', Number(which)).single(), 'Approved version')
    bytes = await getObject(REPORTS_BUCKET, a.pdf_path)
    name = `health-report-v${a.version}.pdf`
  } else {
    const b = await loadBundle(cycleId)
    bytes = await reportPdf(await buildSnapshot(b))
    name = `health-report-preview-v${b.report.version}.pdf`
  }
  const dl = req.nextUrl.searchParams.get('download') === '1'
  return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="${name}"`, 'Cache-Control': 'no-store' } })
}

async function sendPreviewRoute({ seg }: Ctx) {
  return ok(await sendPreview(id(seg[1])))
}

async function send({ seg, body }: Ctx) {
  return ok(await sendReport(id(seg[1]), body, ACTOR))
}

async function markSend({ seg }: Ctx) {
  await markStuckSend(id(seg[1]), ACTOR)
  return ok({ ok: true })
}

async function evidence({ req }: Ctx) {
  const path = req.nextUrl.searchParams.get('path') || ''
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w.-]{1,80}\.(jpg|jpeg|png)$/i.test(path)) throw new CareError('Not found', 404)
  const bytes = await getObject(EVIDENCE_BUCKET, path)
  return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': path.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, max-age=300' } })
}

async function retryNotification({ seg }: Ctx) {
  const n = must(await db.from('care_notifications').select('*').eq('id', id(seg[1])).single(), 'Notification')
  if (n.status === 'sent') throw new CareError('That notification was already sent.', 409)
  await db.from('care_notifications').update({ status: 'pending', max_attempts: n.attempts + 1 }).eq('id', n.id)
  const sent = await deliver({ ...n, max_attempts: n.attempts + 1 })
  return ok({ sent })
}

async function activity({ req }: Ctx) {
  const site = req.nextUrl.searchParams.get('site')
  let q = db.from('care_activity').select('*').order('created_at', { ascending: false }).limit(100)
  if (site && UUID.test(site)) q = q.eq('site_id', site)
  return ok({ activity: (await q).data || [] })
}

/* ------------------------------ plan time: catalog, ledger, estimates ------------------------------ */

const presetsList = async () => ok({ presets: await work.listPresets() })
const presetCreate = async ({ body }: Ctx) => ok({ preset: await work.createPreset(body, ACTOR) }, 201)
const presetUpdate = async ({ seg, body }: Ctx) => ok({ preset: await work.updatePreset(id(seg[1]), body, ACTOR) })
const presetConfirm = async ({ seg, body }: Ctx) => ok({ preset: await work.confirmPreset(id(seg[1]), Number(body.version), ACTOR) })
const siteWork = async ({ seg }: Ctx) => ok(await work.siteWork(id(seg[1])))
const cycleWork = async ({ seg }: Ctx) => {
  const cycle = must(await db.from('care_cycles').select('site_id').eq('id', id(seg[1])).single(), 'Billing period')
  const site = await work.siteWork(cycle.site_id)
  return ok({ ...site, ledger: await work.ledgerFor(id(seg[1])) })
}
const recordWork = async ({ seg, body }: Ctx) => ok(await work.recordWork(id(seg[1]), body, ACTOR))
const voidWork = async ({ body }: Ctx) => ok(await work.voidWork(body.entries, body.reason, ACTOR))
const workLog = async ({ seg, body }: Ctx) => { await work.confirmWorkLog(id(seg[1]), body.confirmed === true, ACTOR); return ok({ ok: true }) }
const estimateCreate = async ({ seg, body }: Ctx) => ok({ estimate: await work.createEstimate(id(seg[1]), body, ACTOR) }, 201)
const estimateUpdate = async ({ seg, body }: Ctx) => ok({ estimate: await work.updateEstimate(id(seg[1]), body, ACTOR) })
const estimateApprove = async ({ seg, body }: Ctx) => ok(await work.approveEstimate(id(seg[1]), body.note, ACTOR))
const estimateClose = async ({ seg, body }: Ctx) => ok(await work.closeEstimate(id(seg[1]), body.status, body.reason, ACTOR))
const estimateCarry = async ({ seg }: Ctx) => ok({ estimate: await work.carryEstimate(id(seg[1]), ACTOR) }, 201)
const estimateInvoice = async ({ seg, body }: Ctx) => ok(await work.invoiceEstimate(id(seg[1]), body, ACTOR))
const termsReview = async ({ seg, body }: Ctx) => { await work.reviewTerms(id(seg[1]), body.note, ACTOR); return ok({ ok: true }) }

/* ------------------------------ router ------------------------------ */

const routes: [string, string, Handler][] = [
  ['GET', 'status', status],
  ['GET', 'overview', overview],
  ['GET', 'settings', getSettingsRoute],
  ['PUT', 'settings', putSettings],
  ['POST', 'settings/approve-policy', approvePolicy],
  ['GET', 'clients', clients],
  ['GET', 'template', template],
  ['GET', 'activity', activity],
  ['POST', 'check-url', checkUrl],
  ['POST', 'sites', createSite],
  ['GET', 'sites/:id', getSite],
  ['PUT', 'sites/:id', putSite],
  ['POST', 'sites/:id/confirm', confirm],
  ['POST', 'sites/:id/checkout', checkout],
  ['POST', 'sites/:id/portal', portal],
  ['POST', 'sites/:id/sync', sync],
  ['POST', 'sites/:id/cycles', manualCycle],
  ['POST', 'sites/:id/clear-billing', clearBilling],
  ['POST', 'sites/:id/pause', setStatus('paused')],
  ['POST', 'sites/:id/resume', setStatus('confirmed')],
  ['POST', 'sites/:id/end', setStatus('ended')],
  ['GET', 'cycles/:id', getCycle],
  ['POST', 'cycles/:id/rerun', rerun],
  ['POST', 'cycles/:id/cancel-scan', cancel],
  ['PUT', 'cycles/:id/manual/:item', putManual],
  ['PUT', 'cycles/:id/due', putDue],
  ['PUT', 'cycles/:id/report', putReport],
  ['PUT', 'cycles/:id/plan-time', putPlanTime],
  ['PUT', 'cycles/:id/issue', putIssue],
  ['GET', 'calendar', calendarItems],
  ['POST', 'cycles/:id/ready', ready],
  ['POST', 'cycles/:id/draft', backToDraft],
  ['POST', 'cycles/:id/approve', approveRoute],
  ['GET', 'cycles/:id/pdf', pdf],
  ['GET', 'cycles/:id/send-preview', sendPreviewRoute],
  ['POST', 'cycles/:id/send', send],
  ['PUT', 'findings/:id', putFinding],
  ['POST', 'sends/:id/mark-failed', markSend],
  ['POST', 'notifications/:id/retry', retryNotification],
  ['GET', 'evidence', evidence],
  ['GET', 'presets', presetsList],
  ['POST', 'presets', presetCreate],
  ['PUT', 'presets/:id', presetUpdate],
  ['POST', 'presets/:id/confirm', presetConfirm],
  ['GET', 'sites/:id/work', siteWork],
  ['POST', 'sites/:id/terms', termsReview],
  ['POST', 'sites/:id/estimates', estimateCreate],
  ['GET', 'cycles/:id/work', cycleWork],
  ['POST', 'cycles/:id/work', recordWork],
  ['PUT', 'cycles/:id/work-log', workLog],
  ['POST', 'work/void', voidWork],
  ['PUT', 'estimates/:id', estimateUpdate],
  ['POST', 'estimates/:id/approve', estimateApprove],
  ['POST', 'estimates/:id/close', estimateClose],
  ['POST', 'estimates/:id/carry', estimateCarry],
  ['POST', 'estimates/:id/invoice', estimateInvoice],
]

async function dispatch(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!careEnabled()) return careOff()
  const denied = requireAdmin(req)
  if (denied) return denied
  const { path } = await ctx.params
  const seg = path || []
  for (const [method, pattern, handler] of routes) {
    if (method !== req.method) continue
    const pp = pattern.split('/')
    if (pp.length !== seg.length) continue
    if (pp.every((p, i) => p === seg[i] || (p === ':id' && UUID.test(seg[i])) || (p === ':item' && /^[a-z0-9-]{1,60}$/i.test(seg[i])))) {
      try {
        let body: Row = {}
        if (req.method !== 'GET') {
          const t = await req.text()
          if (t.length > 200_000) throw new CareError('Request too large.', 413)
          body = t ? JSON.parse(t) : {}
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CareError('Expected a JSON object.')
        }
        return await handler({ req, seg, body })
      } catch (e) {
        if (e instanceof CareError) return ok({ error: e.message }, e.status)
        if (e instanceof SyntaxError) return ok({ error: 'Invalid JSON.' }, 400)
        const se = e as { type?: string; message?: string; statusCode?: number }
        if (se?.type?.startsWith?.('Stripe')) return ok({ error: `Stripe: ${se.message}` }, 502)
        console.error('care admin error', e)
        return ok({ error: 'Something went wrong.' }, 500)
      }
    }
  }
  return ok({ error: 'Not found' }, 404)
}

export const GET = dispatch
export const POST = dispatch
export const PUT = dispatch
