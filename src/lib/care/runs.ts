/**
 * Results coming back from the check runner. The runner is trusted only as far
 * as its token: everything it sends is validated, trimmed, and checked against
 * the run's own scope before it is stored.
 */
import { db, must, CareError, logActivity } from './db'
import { invalidateApproval } from './report'
import { queueScanNotification } from './notify'
import { STATUSES, CHECK_LABELS, fingerprint, type FindingStatus } from './findings'
export { CHECK_LABELS, STATUSES, ISSUE, diffFindings, fingerprint } from './findings'
export type { FindingStatus, FindingRow } from './findings'

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max))

export type RunnerFinding = {
  check_key: string
  url?: string
  viewport?: string
  status: FindingStatus
  observed: string
  explanation: string
  possible_cause?: string
  next_action?: string
  evidence?: Record<string, unknown>
  checked_at?: string
}

const EVIDENCE_KEYS = ['http_status', 'final_url', 'error_code', 'screenshot', 'redirect_chain', 'load_ms', 'overflow_px', 'found_on', 'request_url', 'blocked_reason', 'content_type']

function cleanEvidence(e: unknown, prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!e || typeof e !== 'object') return out
  for (const k of EVIDENCE_KEYS) {
    const v = (e as Record<string, unknown>)[k]
    if (v === undefined || v === null) continue
    if (k === 'screenshot') {
      const p = s(v, 300)
      if (p.startsWith(prefix) && !p.includes('..')) out[k] = p
    } else if (k === 'redirect_chain') {
      if (Array.isArray(v)) out[k] = v.slice(0, 12).map((x) => s(x, 400))
    } else if (typeof v === 'number') out[k] = Number.isFinite(v) ? v : null
    else out[k] = s(v, 400)
  }
  return out
}

export async function evidencePrefix(runId: string) {
  const run = must(await db.from('care_scan_runs').select('id, site_id, cycle_id').eq('id', runId).single(), 'Run')
  return `${run.site_id}/${run.cycle_id}/${run.id}/`
}

export async function requireRunningRun(runId: string, owner: string) {
  const run = must(await db.from('care_scan_runs').select('*').eq('id', runId).single(), 'Run')
  if (run.status !== 'running' || run.lease_owner !== owner) throw new CareError('This run is not leased to this runner.', 409)
  return run
}

type Completion = { outcome: 'succeeded' | 'partial' | 'failed' | 'canceled'; error?: string; retryable?: boolean; findings?: RunnerFinding[]; notes?: string }

export async function completeRun(runId: string, owner: string, body: Completion) {
  const run = await requireRunningRun(runId, owner)
  const outcome = ['succeeded', 'partial', 'failed', 'canceled'].includes(body.outcome) ? body.outcome : 'failed'
  const now = new Date().toISOString()

  if (outcome === 'failed' && body.retryable && run.attempts < run.max_attempts) {
    await db.from('care_scan_runs').update({
      status: 'queued', lease_owner: null, lease_expires_at: null, error: s(body.error, 500) || 'The check could not finish; retrying.',
      available_at: new Date(Date.now() + 5 * 60_000 * run.attempts).toISOString(), updated_at: now,
    }).eq('id', runId).eq('lease_owner', owner)
    await db.from('care_cycles').update({ scan_state: 'queued', updated_at: now }).eq('id', run.cycle_id)
    await logActivity({ site_id: run.site_id, cycle_id: run.cycle_id, actor: 'runner', action: 'scan_retry_scheduled', detail: { run_id: runId, attempt: run.attempts } })
    return { status: 'queued' }
  }

  const prefix = `${run.site_id}/${run.cycle_id}/${run.id}/`
  const rows = (Array.isArray(body.findings) ? body.findings : []).slice(0, 600).flatMap((f) => {
    if (!f || !STATUSES.includes(f.status) || !CHECK_LABELS[f.check_key]) return []
    let url = s(f.url, 600)
    if (url) {
      try { new URL(url) } catch { url = '' }
    }
    return [{
      run_id: runId, cycle_id: run.cycle_id, site_id: run.site_id, check_key: f.check_key, fingerprint: fingerprint({ check_key: f.check_key, url, viewport: f.viewport }),
      url: url || null, viewport: f.viewport === 'mobile' || f.viewport === 'desktop' ? f.viewport : null, status: f.status,
      observed: s(f.observed, 1000) || 'No details recorded.', explanation: s(f.explanation, 1000) || 'No explanation recorded.',
      possible_cause: s(f.possible_cause, 600) || null, next_action: s(f.next_action, 600) || null,
      evidence: cleanEvidence(f.evidence, prefix), checked_at: f.checked_at && !isNaN(Date.parse(f.checked_at)) ? f.checked_at : now,
    }]
  })
  if (outcome === 'failed' && rows.length === 0) {
    rows.push({
      run_id: runId, cycle_id: run.cycle_id, site_id: run.site_id, check_key: 'scan', fingerprint: 'scan|-|', url: run.config?.site_url || null, viewport: null,
      status: 'could_not_check', observed: s(body.error, 600) || 'The automated check did not finish.', explanation: 'The automated check did not run to completion, so nothing was confirmed this time.',
      possible_cause: null, next_action: 'Retry the check from the review page. If it keeps failing, check the website manually.', evidence: {}, checked_at: now,
    })
  }
  for (let i = 0; i < rows.length; i += 200) {
    const ins = await db.from('care_findings').insert(rows.slice(i, i + 200))
    if (ins.error) throw new CareError(`Could not save findings: ${ins.error.message}`, 500)
  }
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1
  const summary = { counts, total: rows.length, notes: s(body.notes, 500) || null }
  const fin = await db.from('care_scan_runs').update({
    status: outcome, finished_at: now, lease_owner: null, lease_expires_at: null, summary, error: outcome === 'failed' || outcome === 'partial' ? s(body.error, 500) || null : null, updated_at: now,
  }).eq('id', runId).eq('lease_owner', owner).select('id')
  if (!fin.data?.length) throw new CareError('The run changed while saving.', 409)
  const scanState = outcome === 'succeeded' ? 'done' : outcome
  await db.from('care_cycles').update({ scan_state: scanState, updated_at: now }).eq('id', run.cycle_id)
  if (outcome === 'succeeded' || outcome === 'partial') await invalidateApproval(run.cycle_id, 'New automated check results replaced the ones in the approved report.', 'runner')
  await logActivity({ site_id: run.site_id, cycle_id: run.cycle_id, actor: 'runner', action: `scan_${outcome}`, detail: { run_id: runId, counts } })
  if (outcome !== 'canceled') await queueScanNotification(runId)
  return { status: outcome, summary }
}

