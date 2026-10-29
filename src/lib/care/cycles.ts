/**
 * Review cycles and scan jobs.
 * - One cycle per paid service period per website (unique site + period start,
 *   and unique Stripe invoice), with its own included time allowance, so
 *   retries and duplicate events can't add more.
 * - A verified payment queues the period's one initial scan straight away and
 *   asks the runner to start it (GitHub workflow dispatch). Dispatch is
 *   recorded on the run and retried within limits; the cron is the recovery
 *   path for missed or failed dispatches, never the normal path.
 * - A paid period for a website whose scope isn't confirmed (never confirmed,
 *   changed since, paused or ended) is kept and held, and flagged to the owner
 *   immediately instead of scanning an unauthorized scope.
 * - Reruns add a scan run to the same cycle. They never create a billing cycle.
 */
import { after } from 'next/server'
import { db, must, CareError, getSettings, logActivity, type Row } from './db'
import { cycleDates } from './schedule'
import { scanConfig, setupHash } from './sites'
import { plan as planInfo, type PlanId } from './plans'
import { queueHoldNotice, queueDispatchBlocked, queueBillingNotice } from './notify'

type CycleInput = {
  siteId: string
  source: 'stripe' | 'manual'
  invoiceId?: string | null
  subscriptionId?: string | null
  periodStart: Date
  periodEnd: Date
  plan: PlanId
  paidAt?: Date | null
  amountPaid?: number | null
  currency?: string | null
  billingReason?: string | null
  actor: string
}

export type HoldReason = 'enrollment' | 'setup_changed' | 'paused' | 'ended'

/** Why a paid period can't be scanned right now, or null when the confirmed scope can be checked. */
export function holdReasonFor(site: Row): HoldReason | null {
  if (site.enrollment_status === 'ended') return 'ended'
  if (site.enrollment_status === 'paused') return 'paused'
  if (site.enrollment_status !== 'confirmed') return site.confirmed_at ? 'setup_changed' : 'enrollment'
  if (!site.confirmed_hash || site.confirmed_hash !== setupHash(site as Parameters<typeof setupHash>[0])) return 'setup_changed'
  return null
}

export const HOLD_TEXT: Record<HoldReason, string> = {
  enrollment: 'The website setup has not been confirmed yet.',
  setup_changed: 'The agreed setup changed and needs to be confirmed again.',
  paused: 'Care for this website is paused.',
  ended: 'Care for this website has ended.',
}

export async function createCycle(i: CycleInput): Promise<{ cycle: Row; created: boolean }> {
  const site = must(await db.from('care_sites').select('*').eq('id', i.siteId).single(), 'Website')
  // A paid Stripe period is never dropped, even for an ended site: it is kept and flagged.
  if (site.enrollment_status === 'ended' && i.source !== 'stripe') throw new CareError('Care for this website has ended.', 409)
  const settings = await getSettings()
  const paidAt = i.paidAt || new Date()
  const dates = cycleDates(i.periodStart, settings, site.review_window_days)
  const hold = holdReasonFor(site)
  // Payment confirmed: the check is available now, not at a later scheduled time.
  const scanAfter = i.source === 'stripe' ? new Date(Math.min(dates.scanAfter.getTime(), Date.now())) : dates.scanAfter
  const row = {
    site_id: i.siteId,
    source: i.source,
    stripe_invoice_id: i.invoiceId ?? null,
    stripe_subscription_id: i.subscriptionId ?? null,
    period_start: i.periodStart.toISOString(),
    period_end: i.periodEnd.toISOString(),
    plan: i.plan,
    paid_at: paidAt.toISOString(),
    amount_paid: i.amountPaid ?? null,
    currency: i.currency ?? null,
    allowance_minutes: planInfo(i.plan).includedMinutes,
    scan_after: scanAfter.toISOString(),
    review_start_at: dates.reviewStartAt.toISOString(),
    review_due_at: dates.reviewDueAt.toISOString(),
    hold_reason: hold,
    hold_flagged_at: hold && i.source === 'stripe' ? new Date().toISOString() : null,
  }
  const ins = await db.from('care_cycles').insert(row).select('*').single()
  if (ins.error) {
    if (ins.error.code === '23505') {
      // Already have this period (or this invoice): return the existing cycle.
      const q = i.invoiceId
        ? await db.from('care_cycles').select('*').or(`stripe_invoice_id.eq.${i.invoiceId},and(site_id.eq.${i.siteId},period_start.eq.${row.period_start})`).limit(1).maybeSingle()
        : await db.from('care_cycles').select('*').eq('site_id', i.siteId).eq('period_start', row.period_start).maybeSingle()
      if (q.data) {
        // A second paid invoice for a period that already has one: a possible duplicate charge.
        if (i.invoiceId && q.data.stripe_invoice_id && q.data.stripe_invoice_id !== i.invoiceId) {
          await logActivity({ site_id: i.siteId, cycle_id: q.data.id, actor: i.actor, action: 'possible_duplicate_charge', detail: { invoice: i.invoiceId, existing: q.data.stripe_invoice_id } })
          await queueBillingNotice(site, `duplicate:${i.invoiceId}`, 'Possible duplicate charge',
            `A second paid invoice (${i.invoiceId}) covers a period that already has a paid review (${q.data.stripe_invoice_id}). No second review was created. Check it in Stripe and correct the charge if it is a duplicate.`)
        }
        return { cycle: q.data, created: false }
      }
    }
    throw new CareError(`Could not create the review cycle: ${ins.error.message}`, 500)
  }
  const cycle = ins.data
  await seedCycleWork(cycle, site)
  if (site.enrollment_status !== 'ended') await db.from('care_sites').update({ next_review_due: cycle.review_due_at, updated_at: new Date().toISOString() }).eq('id', i.siteId)
  await logActivity({ site_id: i.siteId, cycle_id: cycle.id, actor: i.actor, action: i.source === 'stripe' ? 'payment_received' : 'cycle_created', detail: { source: i.source, period_start: row.period_start, invoice: i.invoiceId ?? null, billing_reason: i.billingReason ?? null, hold } })
  if (!hold) await enqueueScan(cycle.id, 'scheduled', i.actor)
  else if (i.source === 'stripe') await queueHoldNotice(site, cycle, hold, i.billingReason === 'subscription_cycle')
  return { cycle, created: true }
}

/** Creates the draft report and the manual checklist rows for a new cycle. */
async function seedCycleWork(cycle: Row, site: Row) {
  await db.from('care_reports').upsert({ cycle_id: cycle.id, content: {} }, { onConflict: 'cycle_id', ignoreDuplicates: true })
  const items = (site.manual_checklist || []).map((m: Record<string, string>) => ({
    cycle_id: cycle.id, item_id: m.id, label: m.label, category: m.category, instructions: m.instructions || null,
  }))
  if (items.length) await db.from('care_manual_results').upsert(items, { onConflict: 'cycle_id,item_id', ignoreDuplicates: true })
}

/**
 * Queues a scan and asks the runner to start it. Only one queued or running
 * run per cycle, and only one initial ('scheduled') run per cycle ever.
 */
export async function enqueueScan(cycleId: string, trigger: 'scheduled' | 'rerun', actor: string) {
  const cycle = must(await db.from('care_cycles').select('*').eq('id', cycleId).single(), 'Cycle')
  const site = must(await db.from('care_sites').select('*').eq('id', cycle.site_id).single(), 'Website')
  const hold = holdReasonFor(site)
  if (hold) throw new CareError(hold === 'setup_changed' || hold === 'enrollment' ? 'Confirm the website setup before running checks.' : HOLD_TEXT[hold], 409)
  const active = await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).in('status', ['queued', 'running']).maybeSingle()
  if (active.data) return { run: active.data, created: false }
  const availableAt = trigger === 'scheduled' && cycle.scan_after && new Date(cycle.scan_after) > new Date() ? cycle.scan_after : new Date().toISOString()
  const ins = await db.from('care_scan_runs').insert({
    cycle_id: cycleId, site_id: site.id, trigger, config: scanConfig(site), requested_by: actor, available_at: availableAt,
  }).select('*').single()
  if (ins.error) {
    if (ins.error.code === '23505') {
      const again = await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).in('status', ['queued', 'running']).maybeSingle()
      if (again.data) return { run: again.data, created: false }
      if (trigger === 'scheduled') {
        const initial = await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).eq('trigger', 'scheduled').maybeSingle()
        if (initial.data) return { run: initial.data, created: false }
      }
    }
    throw new CareError(`Could not queue the check: ${ins.error.message}`, 500)
  }
  await db.from('care_cycles').update({ scan_state: 'queued', hold_reason: null, updated_at: new Date().toISOString() }).eq('id', cycleId)
  await logActivity({ site_id: site.id, cycle_id: cycleId, actor, action: trigger === 'rerun' ? 'rerun_queued' : 'scan_queued', detail: { run_id: ins.data.id } })
  // Dispatch right after the response (webhooks answer Stripe quickly); the
  // outcome is stored on the run, and the cron retries anything left pending.
  const runId = ins.data.id
  try {
    after(() => dispatchRun(runId, actor))
  } catch {
    await dispatchRun(runId, actor)
  }
  return { run: ins.data, created: true }
}

/** After confirmation or resuming, paid periods that were held get their scan queued. */
export async function releaseHeldCycles(siteId: string, actor: string) {
  const held = await db.from('care_cycles').select('id').eq('site_id', siteId).in('hold_reason', ['enrollment', 'setup_changed', 'paused']).is('completed_at', null)
  for (const c of held.data || []) await enqueueScan(c.id, 'scheduled', actor)
  return (held.data || []).length
}

export async function cancelScan(cycleId: string, actor: string) {
  const run = await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).in('status', ['queued', 'running']).maybeSingle()
  if (!run.data) throw new CareError('No check is queued or running for this review.', 409)
  if (run.data.status === 'queued') {
    await db.from('care_scan_runs').update({ status: 'canceled', finished_at: new Date().toISOString(), error: 'Canceled before it started.', dispatch_status: run.data.dispatch_status === 'dispatched' ? 'dispatched' : 'not_needed', updated_at: new Date().toISOString() }).eq('id', run.data.id).eq('status', 'queued')
    await db.from('care_cycles').update({ scan_state: 'canceled', updated_at: new Date().toISOString() }).eq('id', cycleId)
  } else {
    await db.from('care_scan_runs').update({ cancel_requested: true, updated_at: new Date().toISOString() }).eq('id', run.data.id)
  }
  await logActivity({ cycle_id: cycleId, site_id: run.data.site_id, actor, action: 'scan_cancel_requested', detail: { run_id: run.data.id } })
  return run.data.id
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                             */
/* ------------------------------------------------------------------ */

/** Dispatch attempts per run before the owner is told it's blocked. */
export const DISPATCH_MAX_ATTEMPTS = 5
/** Minutes to wait after failed attempt n (1 based). */
export const DISPATCH_BACKOFF_MIN = [1, 5, 15, 60]
/** A dispatched run nobody claimed within this long is dispatched again. */
export const DISPATCH_STALE_MIN = 30

export function dispatchConfigured() {
  return !!(process.env.CARE_GITHUB_DISPATCH_TOKEN && process.env.CARE_GITHUB_REPO)
}

/** Asks GitHub to start the check workflow now. */
export async function dispatchRunner(): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.CARE_GITHUB_DISPATCH_TOKEN
  const repo = process.env.CARE_GITHUB_REPO
  if (!token || !repo) return { ok: false, error: 'Runner dispatch is not configured (CARE_GITHUB_DISPATCH_TOKEN and CARE_GITHUB_REPO).' }
  try {
    const base = process.env.CARE_GITHUB_API_BASE || 'https://api.github.com'
    const r = await fetch(`${base}/repos/${repo}/actions/workflows/website-care-checks.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: process.env.CARE_GITHUB_REF || 'main' }),
      signal: AbortSignal.timeout(8000),
    })
    return r.ok ? { ok: true } : { ok: false, error: `GitHub answered ${r.status}.` }
  } catch (e) {
    return { ok: false, error: `Could not reach GitHub: ${String((e as Error).message || e).slice(0, 120)}` }
  }
}

/**
 * One dispatch attempt for a queued run. The attempt is claimed first (an
 * optimistic update on the attempt count), so two callers can't both count
 * or both send. After the last allowed attempt the run is marked blocked and
 * the owner is notified once; the paid review and its queued run are kept.
 */
export async function dispatchRun(runId: string, actor = 'system'): Promise<'dispatched' | 'failed' | 'blocked' | 'not_needed' | 'busy'> {
  const run = (await db.from('care_scan_runs').select('*').eq('id', runId).maybeSingle()).data
  if (!run) return 'not_needed'
  if (run.status !== 'queued') {
    if (['pending', 'failed'].includes(run.dispatch_status)) await db.from('care_scan_runs').update({ dispatch_status: 'not_needed' }).eq('id', runId)
    return 'not_needed'
  }
  const n = run.dispatch_attempts + 1
  const claim = await db.from('care_scan_runs').update({ dispatch_attempts: n, next_dispatch_at: new Date(Date.now() + 2 * 60_000).toISOString() })
    .eq('id', runId).eq('dispatch_attempts', run.dispatch_attempts).eq('status', 'queued').select('id')
  if (!claim.data?.length) return 'busy'
  const r = await dispatchRunner()
  const now = new Date()
  if (r.ok) {
    await db.from('care_scan_runs').update({ dispatch_status: 'dispatched', dispatched_at: now.toISOString(), dispatch_error: null }).eq('id', runId)
    await logActivity({ site_id: run.site_id, cycle_id: run.cycle_id, actor, action: 'scan_dispatched', detail: { run_id: runId, attempt: n } })
    return 'dispatched'
  }
  const blocked = n >= DISPATCH_MAX_ATTEMPTS
  const wait = DISPATCH_BACKOFF_MIN[Math.min(n - 1, DISPATCH_BACKOFF_MIN.length - 1)]
  await db.from('care_scan_runs').update({
    dispatch_status: blocked ? 'blocked' : 'failed', dispatch_error: r.error || 'Dispatch failed.',
    next_dispatch_at: new Date(now.getTime() + wait * 60_000).toISOString(),
  }).eq('id', runId)
  await logActivity({ site_id: run.site_id, cycle_id: run.cycle_id, actor, action: blocked ? 'scan_dispatch_blocked' : 'scan_dispatch_failed', detail: { run_id: runId, attempt: n, error: r.error } })
  if (blocked) await queueDispatchBlocked(runId, r.error || 'Dispatch failed.')
  return blocked ? 'blocked' : 'failed'
}

/**
 * Recovery (cron): dispatch queued runs whose dispatch is pending or failed and
 * due again, and runs that were dispatched but never picked up. Bounded per
 * run by DISPATCH_MAX_ATTEMPTS.
 */
export async function dispatchPending(now = new Date()) {
  const due = (await db.from('care_scan_runs').select('id, site_id, cycle_id, dispatch_status, dispatch_attempts, dispatched_at, next_dispatch_at').eq('status', 'queued').lte('available_at', now.toISOString())
    .in('dispatch_status', ['pending', 'failed', 'dispatched']).limit(50)).data || []
  const out: Record<string, number> = {}
  for (const r of due) {
    const stale = r.dispatch_status === 'dispatched' && r.dispatched_at && now.getTime() - new Date(r.dispatched_at).getTime() > DISPATCH_STALE_MIN * 60_000
    const retry = (r.dispatch_status === 'pending' || r.dispatch_status === 'failed') && new Date(r.next_dispatch_at) <= now
    if (!stale && !retry) continue
    if (r.dispatch_attempts >= DISPATCH_MAX_ATTEMPTS) {
      // Out of attempts (for example dispatched every time but never picked up): stop and tell the owner.
      const upd = await db.from('care_scan_runs').update({ dispatch_status: 'blocked', dispatch_error: stale ? 'Dispatched but no runner picked the check up.' : 'No dispatch attempts left.' })
        .eq('id', r.id).eq('status', 'queued').select('id')
      if (upd.data?.length) {
        await logActivity({ site_id: r.site_id, cycle_id: r.cycle_id, actor: 'scheduler', action: 'scan_dispatch_blocked', detail: { run_id: r.id } })
        await queueDispatchBlocked(r.id, stale ? 'The runner was asked to start but never picked the check up.' : 'No dispatch attempts left.')
      }
      out.blocked = (out.blocked || 0) + 1
      continue
    }
    const res = await dispatchRun(r.id, 'scheduler')
    out[res] = (out[res] || 0) + 1
  }
  return out
}

/** Owner action: try a blocked or failed dispatch again with a fresh set of attempts. */
export async function retryDispatch(cycleId: string, actor: string) {
  const run = (await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).eq('status', 'queued').maybeSingle()).data
  if (!run) throw new CareError('No check is waiting to start for this review.', 409)
  await db.from('care_scan_runs').update({ dispatch_attempts: 0, dispatch_status: 'pending', next_dispatch_at: new Date().toISOString() }).eq('id', run.id)
  await logActivity({ site_id: run.site_id, cycle_id: cycleId, actor, action: 'scan_dispatch_retry', detail: { run_id: run.id } })
  return dispatchRun(run.id, actor)
}
