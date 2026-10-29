/**
 * Review cycles and scan jobs.
 * - One cycle per paid service period per website (unique site + period start,
 *   and unique Stripe invoice), so retries and duplicate events can't add more.
 * - A cycle for a website that isn't confirmed yet waits (hold_reason
 *   'enrollment'); payment never starts a scan on its own.
 * - Reruns add a scan run to the same cycle. They never create a billing cycle.
 */
import { after } from 'next/server'
import { db, must, CareError, getSettings, logActivity, type Row } from './db'
import { cycleDates } from './schedule'
import { scanConfig } from './sites'
import type { PlanId } from './plans'

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
  actor: string
}

export async function createCycle(i: CycleInput): Promise<{ cycle: Row; created: boolean }> {
  const site = must(await db.from('care_sites').select('*').eq('id', i.siteId).single(), 'Website')
  if (site.enrollment_status === 'ended') throw new CareError('Care for this website has ended.', 409)
  const settings = await getSettings()
  const dates = cycleDates(i.periodStart, settings, site.review_window_days)
  const held = site.enrollment_status !== 'confirmed'
  const row = {
    site_id: i.siteId,
    source: i.source,
    stripe_invoice_id: i.invoiceId ?? null,
    stripe_subscription_id: i.subscriptionId ?? null,
    period_start: i.periodStart.toISOString(),
    period_end: i.periodEnd.toISOString(),
    plan: i.plan,
    paid_at: i.paidAt ? i.paidAt.toISOString() : null,
    amount_paid: i.amountPaid ?? null,
    currency: i.currency ?? null,
    scan_after: dates.scanAfter.toISOString(),
    review_start_at: dates.reviewStartAt.toISOString(),
    review_due_at: dates.reviewDueAt.toISOString(),
    hold_reason: held ? 'enrollment' : null,
  }
  const ins = await db.from('care_cycles').insert(row).select('*').single()
  if (ins.error) {
    if (ins.error.code === '23505') {
      // Already have this period (or this invoice): return the existing cycle.
      const q = i.invoiceId
        ? await db.from('care_cycles').select('*').or(`stripe_invoice_id.eq.${i.invoiceId},and(site_id.eq.${i.siteId},period_start.eq.${row.period_start})`).limit(1).maybeSingle()
        : await db.from('care_cycles').select('*').eq('site_id', i.siteId).eq('period_start', row.period_start).maybeSingle()
      if (q.data) return { cycle: q.data, created: false }
    }
    throw new CareError(`Could not create the review cycle: ${ins.error.message}`, 500)
  }
  const cycle = ins.data
  await seedCycleWork(cycle, site)
  await db.from('care_sites').update({ next_review_due: cycle.review_due_at, updated_at: new Date().toISOString() }).eq('id', i.siteId)
  await logActivity({ site_id: i.siteId, cycle_id: cycle.id, actor: i.actor, action: 'cycle_created', detail: { source: i.source, period_start: row.period_start, held } })
  if (!held) await enqueueScan(cycle.id, 'scheduled', i.actor)
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

/** Queues a scan. The partial unique index allows only one active run per cycle. */
export async function enqueueScan(cycleId: string, trigger: 'scheduled' | 'rerun', actor: string) {
  const cycle = must(await db.from('care_cycles').select('*').eq('id', cycleId).single(), 'Cycle')
  const site = must(await db.from('care_sites').select('*').eq('id', cycle.site_id).single(), 'Website')
  if (site.enrollment_status !== 'confirmed') throw new CareError('Confirm the website setup before running checks.', 409)
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
    }
    throw new CareError(`Could not queue the check: ${ins.error.message}`, 500)
  }
  await db.from('care_cycles').update({ scan_state: 'queued', hold_reason: null, updated_at: new Date().toISOString() }).eq('id', cycleId)
  await logActivity({ site_id: site.id, cycle_id: cycleId, actor, action: trigger === 'rerun' ? 'rerun_queued' : 'scan_queued', detail: { run_id: ins.data.id } })
  try {
    after(() => dispatchRunner())
  } catch {
    await dispatchRunner()
  }
  return { run: ins.data, created: true }
}

/** After confirmation, cycles that were waiting on setup get their scan queued. */
export async function releaseHeldCycles(siteId: string, actor: string) {
  const held = await db.from('care_cycles').select('id').eq('site_id', siteId).eq('hold_reason', 'enrollment')
  for (const c of held.data || []) await enqueueScan(c.id, 'scheduled', actor)
  return (held.data || []).length
}

export async function cancelScan(cycleId: string, actor: string) {
  const run = await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).in('status', ['queued', 'running']).maybeSingle()
  if (!run.data) throw new CareError('No check is queued or running for this review.', 409)
  if (run.data.status === 'queued') {
    await db.from('care_scan_runs').update({ status: 'canceled', finished_at: new Date().toISOString(), error: 'Canceled before it started.', updated_at: new Date().toISOString() }).eq('id', run.data.id).eq('status', 'queued')
    await db.from('care_cycles').update({ scan_state: 'canceled', updated_at: new Date().toISOString() }).eq('id', cycleId)
  } else {
    await db.from('care_scan_runs').update({ cancel_requested: true, updated_at: new Date().toISOString() }).eq('id', run.data.id)
  }
  await logActivity({ cycle_id: cycleId, site_id: run.data.site_id, actor, action: 'scan_cancel_requested', detail: { run_id: run.data.id } })
  return run.data.id
}

/**
 * Asks GitHub to start the check workflow now (optional). Without a token the
 * workflow's own schedule picks queued checks up on its next run.
 */
export async function dispatchRunner(): Promise<'dispatched' | 'skipped' | 'failed'> {
  const token = process.env.CARE_GITHUB_DISPATCH_TOKEN
  const repo = process.env.CARE_GITHUB_REPO
  if (!token || !repo) return 'skipped'
  try {
    const base = process.env.CARE_GITHUB_API_BASE || 'https://api.github.com'
    const r = await fetch(`${base}/repos/${repo}/actions/workflows/website-care-checks.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: process.env.CARE_GITHUB_REF || 'main' }),
      signal: AbortSignal.timeout(8000),
    })
    return r.ok ? 'dispatched' : 'failed'
  } catch {
    return 'failed'
  }
}
