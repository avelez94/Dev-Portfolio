/**
 * The payment to scan pipeline for one paid period, as shown in the admin:
 * payment received, scan queued (with dispatch state), running, and completed
 * or failed. Pure, so the review screen, site page and calendar agree.
 */
import type { Row } from './db'

export type Step = { key: 'payment' | 'queued' | 'running' | 'result'; label: string; state: 'done' | 'active' | 'waiting' | 'problem'; at: string | null; detail?: string }

const HOLD: Record<string, string> = {
  enrollment: 'On hold: setup not confirmed',
  setup_changed: 'On hold: setup changed, confirm it again',
  paused: 'On hold: care is paused',
  ended: 'On hold: care has ended',
}

export function pipeline(cycle: Row, runs: Row[]): Step[] {
  const initial = runs.filter((r) => r.trigger === 'scheduled').sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
  const current = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
  const run = current || initial || null
  const paid = cycle.source === 'stripe' ? 'Payment received' : 'Paid period recorded'
  const amount = cycle.amount_paid != null ? `${(cycle.amount_paid / 100).toFixed(2)} ${String(cycle.currency || '').toUpperCase()}`.trim() : undefined
  const steps: Step[] = [{ key: 'payment', label: paid, state: 'done', at: cycle.paid_at || cycle.created_at, detail: amount }]
  if (cycle.hold_reason) {
    steps.push({ key: 'queued', label: HOLD[cycle.hold_reason] || 'On hold', state: 'problem', at: cycle.hold_flagged_at, detail: 'The paid review is kept. Nothing is scanned until the scope is confirmed.' })
    steps.push({ key: 'running', label: 'Running', state: 'waiting', at: null })
    steps.push({ key: 'result', label: 'Completed', state: 'waiting', at: null })
    return steps
  }
  if (!run) {
    steps.push({ key: 'queued', label: 'Scan not queued yet', state: 'active', at: null })
    steps.push({ key: 'running', label: 'Running', state: 'waiting', at: null })
    steps.push({ key: 'result', label: 'Completed', state: 'waiting', at: null })
    return steps
  }
  const dispatch: Record<string, string> = {
    pending: 'starting the runner', dispatched: 'runner started', failed: `runner start failed, retrying (attempt ${run.dispatch_attempts})`,
    blocked: 'runner could not be started, you were notified', not_needed: 'picked up by the runner',
  }
  const queuedState = run.status === 'queued' ? (run.dispatch_status === 'blocked' || run.dispatch_status === 'failed' ? 'problem' : 'active') : 'done'
  steps.push({ key: 'queued', label: 'Scan queued', state: queuedState, at: run.created_at, detail: run.dispatch_status === 'dispatched' && run.status !== 'queued' ? 'runner started' : dispatch[run.dispatch_status] || run.dispatch_status })
  const running = run.status === 'running'
  steps.push({ key: 'running', label: 'Running', state: running ? 'active' : run.started_at ? 'done' : 'waiting', at: run.started_at, detail: running && run.progress?.step ? String(run.progress.step) : undefined })
  const result: Record<string, [string, Step['state']]> = {
    succeeded: ['Completed', 'done'], partial: ['Completed with gaps', 'problem'], failed: ['Failed', 'problem'], canceled: ['Canceled', 'problem'],
  }
  const [label, state] = result[run.status] || ['Completed', 'waiting']
  steps.push({ key: 'result', label, state, at: run.finished_at, detail: run.status === 'failed' ? run.error || undefined : run.trigger === 'rerun' ? 'latest rerun' : undefined })
  return steps
}
