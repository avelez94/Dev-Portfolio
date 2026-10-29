/**
 * Monthly health reports: the draft, its frozen client snapshot, approval, and
 * invalidation. The snapshot is the single source for the preview, the PDF, and
 * the approval hash, so what was approved is exactly what is sent.
 *
 * Client facing copy rule: no dashes.
 */
import { createHash } from 'node:crypto'
import { db, must, CareError, logActivity, getSettings, putObject, REPORTS_BUCKET, type Row } from './db'
import { plan as planInfo, type PlanId } from './plans'
import { CHECK_LABELS, ISSUE, diffFindings, type FindingRow, type FindingStatus } from './findings'
import { formatDateOnly } from './schedule'

export const CONTENT_FIELDS = ['summary', 'investigated', 'fixes', 'outstanding', 'next_steps', 'proposed_work', 'estimate', 'client_notes'] as const
export type ContentField = (typeof CONTENT_FIELDS)[number]
export type ReportContent = Partial<Record<ContentField, string>>

export const MANUAL_STATUSES = ['passed', 'failed', 'needs_review', 'could_not_check', 'not_applicable', 'not_checked'] as const

export const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  needs_review: 'Needs manual review',
  could_not_check: 'Could not check',
  not_applicable: 'Not applicable',
  not_checked: 'Not checked',
}

export const DISCLAIMERS = [
  'Automated checks are read only. They open pages and links but never submit forms, send messages, book appointments, make payments, or sign in.',
  'A booking or checkout page opening only shows that the page loads. It does not confirm that booking or payment works.',
  'This report covers the agreed pages and checklist for this month. It is not a security, accessibility, or legal compliance certification, and it does not test every feature.',
  'Some services block automated visitors. When that happens the item is listed as could not check, which is not the same as a problem with your site.',
]

export async function loadBundle(cycleId: string) {
  const cycle = must(await db.from('care_cycles').select('*').eq('id', cycleId).single(), 'Review cycle')
  const site = must(await db.from('care_sites').select('*').eq('id', cycle.site_id).single(), 'Website')
  const client = (await db.from('clients').select('id, name, email, business').eq('id', site.client_id).maybeSingle()).data
  const runs = (await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).order('created_at', { ascending: false })).data || []
  const latest = runs.find((r: { status: string }) => r.status === 'succeeded' || r.status === 'partial') || null
  const findings = latest ? (await db.from('care_findings').select('*').eq('run_id', latest.id).order('check_key').order('url')).data || [] : []
  // Comparison: the run before this one in the same cycle (a rerun), else the previous cycle's final run.
  const earlierHere = latest ? runs.find((r: { status: string; created_at: string }) => (r.status === 'succeeded' || r.status === 'partial') && r.created_at < latest.created_at) : null
  let previousRun = earlierHere || null
  let previousLabel = earlierHere ? 'the earlier check this month' : ''
  if (!previousRun) {
    const prevCycle = (await db.from('care_cycles').select('id, period_start').eq('site_id', site.id).lt('period_start', cycle.period_start).order('period_start', { ascending: false }).limit(1).maybeSingle()).data
    if (prevCycle) {
      previousRun = (await db.from('care_scan_runs').select('*').eq('cycle_id', prevCycle.id).in('status', ['succeeded', 'partial']).order('created_at', { ascending: false }).limit(1).maybeSingle()).data
      previousLabel = 'last month'
    }
  }
  const previousFindings = previousRun ? (await db.from('care_findings').select('fingerprint, status, check_key, url, viewport, observed').eq('run_id', previousRun.id)).data || [] : []
  const manual = (await db.from('care_manual_results').select('*').eq('cycle_id', cycleId).order('category').order('label')).data || []
  const report = must(await db.from('care_reports').select('*').eq('cycle_id', cycleId).single(), 'Report')
  const approvals = (await db.from('care_report_approvals').select('id, version, snapshot_hash, pdf_path, pdf_sha256, approved_by, approved_at, invalidated_at, invalidated_reason').eq('report_id', report.id).order('version', { ascending: false })).data || []
  const sends = (await db.from('care_report_sends').select('*').eq('report_id', report.id).order('created_at', { ascending: false })).data || []
  return { cycle, site, client, runs, latest, findings, previousRun, previousLabel, previousFindings, manual, report, approvals, sends }
}

export type Bundle = Awaited<ReturnType<typeof loadBundle>>

export async function buildSnapshot(b: Bundle) {
  const settings = await getSettings()
  const tz = settings.timezone
  const content: ReportContent = b.report.content || {}
  const p = planInfo(b.cycle.plan as PlanId)
  const visible = b.findings.filter((f: { client_visible: boolean }) => f.client_visible)
  const auto = visible.map((f: Row) => ({
    check: f.check_key, label: CHECK_LABELS[f.check_key] || f.check_key, url: f.url, viewport: f.viewport, status: f.status as FindingStatus,
    observed: f.observed, explanation: f.explanation, possible_cause: f.possible_cause, next_action: f.next_action, checked_at: f.checked_at,
    evidence: { http_status: f.evidence?.http_status ?? null, error_code: f.evidence?.error_code ?? null, final_url: f.evidence?.final_url ?? null, screenshot: f.evidence?.screenshot ?? null },
  }))
  const manual = b.manual.map((m: Row) => ({ label: m.label, category: m.category, status: m.status || null, note: m.note || '', reason: m.reason || '' }))

  // What was checked: grouped automated checks plus confirmed manual items.
  const groups = new Map<string, { label: string; total: number; passed: number }>()
  for (const f of auto) {
    if (f.check === 'screenshot') continue
    const g = groups.get(f.check) || { label: f.label, total: 0, passed: 0 }
    g.total++
    if (f.status === 'passed') g.passed++
    groups.set(f.check, g)
  }
  const checked = [
    ...[...groups.values()].map((g) => `${g.label}: ${g.passed} of ${g.total} passed`),
    ...manual.filter((m) => m.status === 'passed').map((m) => `${m.label}: passed (checked by hand)`),
    ...manual.filter((m) => m.status === 'not_applicable').map((m) => `${m.label}: not applicable`),
  ]
  const attention = [
    ...auto.filter((f) => ISSUE.includes(f.status)),
    ...manual.filter((m) => m.status === 'failed' || m.status === 'needs_review').map((m) => ({ check: 'manual', label: m.label, url: null, viewport: null, status: m.status as FindingStatus, observed: m.note || STATUS_LABEL[m.status!], explanation: '', possible_cause: null, next_action: null, checked_at: null, evidence: {} })),
  ]
  const couldNot = [
    ...auto.filter((f) => f.status === 'could_not_check').map((f) => ({ label: f.label, url: f.url, why: f.observed })),
    ...manual.filter((m) => m.status === 'could_not_check' || m.status === 'not_checked').map((m) => ({ label: m.label, url: null, why: m.reason })),
  ]
  const diff = b.previousRun ? diffFindings(b.previousFindings as FindingRow[], visible as FindingRow[]) : null
  const shots = auto.filter((f) => f.check === 'screenshot' && f.evidence.screenshot).slice(0, 2).map((f) => ({ viewport: f.viewport, url: f.url, path: f.evidence.screenshot }))

  return {
    schema: 1,
    report_id: b.report.id,
    cycle_id: b.cycle.id,
    version: b.report.version,
    client: { name: b.client?.name || '', business: b.client?.business || '' },
    recipient: { name: b.site.recipient_name || b.client?.name || '', email: b.site.recipient_email || '' },
    site: { label: b.site.label, url: b.site.site_url },
    plan: { id: p.id, name: p.name, includedMinutes: p.includedMinutes },
    period: { start: formatDateOnly(b.cycle.period_start, tz), end: formatDateOnly(b.cycle.period_end, tz), label: new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', year: 'numeric' }).format(new Date(b.cycle.period_start)) },
    review_date: b.latest?.finished_at ? formatDateOnly(b.latest.finished_at, tz) : null,
    scope: {
      pages: (b.latest?.config?.pages || b.site.pages || []).map((x: { label: string; url: string }) => ({ label: x.label, url: x.url })),
      destinations: (b.latest?.config?.destinations || b.site.destinations || []).map((x: { label: string; url: string; kind: string }) => ({ label: x.label, url: x.url, kind: x.kind })),
      checklist: manual.map((m) => m.label),
      features: b.site.features || '',
    },
    scan: b.latest ? { status: b.latest.status, finished: formatDateOnly(b.latest.finished_at, tz), counts: b.latest.summary?.counts || {} } : null,
    automated: auto,
    manual,
    sections: {
      checked,
      attention: attention.map((a) => ({ label: a.label, url: a.url, viewport: a.viewport, status: a.status, observed: a.observed, explanation: a.explanation, possible_cause: a.possible_cause, next_action: a.next_action })),
      outstanding: content.outstanding || '',
      fixed: content.fixes || '',
      needs_approval: content.proposed_work || '',
      estimate: content.estimate || '',
    },
    could_not_check: couldNot,
    comparison: diff
      ? { against: b.previousLabel, new_issues: diff.newIssues.map((f) => `${CHECK_LABELS[f.check_key] || f.check_key}: ${f.url || ''}`.trim()), resolved: diff.resolved.map((f) => `${CHECK_LABELS[f.check_key] || f.check_key}: ${f.url || ''}`.trim()), not_rechecked: diff.notSeen.length }
      : null,
    summary: content.summary || '',
    investigated: content.investigated || '',
    next_steps: content.next_steps || '',
    client_notes: content.client_notes || '',
    screenshots: shots,
    disclaimers: DISCLAIMERS,
  }
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>

export function hashSnapshot(s: Snapshot): string {
  return createHash('sha256').update(JSON.stringify(s)).digest('hex')
}

/** What has to be true before a report can be marked ready or approved. */
export function readinessProblems(b: Bundle): string[] {
  const p: string[] = []
  const c: ReportContent = b.report.content || {}
  if (!c.summary || c.summary.trim().length < 10) p.push('Write the client summary.')
  if (!b.latest) p.push('There is no completed automated check for this month. Run or retry the check first.')
  for (const m of b.manual) {
    if (!m.status) p.push(`Choose a result for "${m.label}".`)
    else if (m.status === 'needs_review') p.push(`"${m.label}" still says needs manual review. Record the result, or mark it not checked with a reason.`)
    else if ((m.status === 'not_checked' || m.status === 'could_not_check') && (!m.reason || m.reason.trim().length < 3)) p.push(`Give a reason "${m.label}" wasn't checked.`)
  }
  if (!b.site.recipient_email) p.push('Add the report recipient email in the website settings.')
  if (b.runs.some((r: { status: string }) => r.status === 'queued' || r.status === 'running')) p.push('A check is still running. Wait for it to finish.')
  return p
}

/** Any client visible change returns an approved or ready report to draft. */
export async function invalidateApproval(cycleId: string, reason: string, actor: string) {
  const r = (await db.from('care_reports').select('*').eq('cycle_id', cycleId).maybeSingle()).data
  if (!r) return
  const now = new Date().toISOString()
  if (r.current_approval_id) {
    await db.from('care_report_approvals').update({ invalidated_at: now, invalidated_reason: reason }).eq('id', r.current_approval_id).is('invalidated_at', null)
  }
  // A draft stays the same version while it's edited; leaving ready, approved, or
  // sent starts a new version, so every approved or sent version stays distinct.
  if (r.status === 'draft') return
  await db.from('care_reports').update({ status: 'draft', version: r.version + 1, current_approval_id: null, ready_at: null, updated_at: now }).eq('id', r.id)
  await logActivity({ cycle_id: cycleId, actor, action: 'approval_invalidated', detail: { from: r.status, reason } })
}

export async function updateContent(reportId: string, body: { content?: Record<string, unknown>; internal_notes?: string; base_version?: number }, actor: string) {
  const r = must(await db.from('care_reports').select('*').eq('id', reportId).single(), 'Report')
  if (typeof body.base_version === 'number' && body.base_version !== r.version) {
    throw new CareError('This report changed in another window. Reload to see the latest version before editing.', 409)
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.internal_notes === 'string') patch.internal_notes = body.internal_notes.slice(0, 8000)
  let changedClient = false
  if (body.content && typeof body.content === 'object') {
    const next: ReportContent = { ...(r.content || {}) }
    for (const k of CONTENT_FIELDS) {
      const v = (body.content as Record<string, unknown>)[k]
      if (typeof v === 'string' && v !== (next[k] || '')) {
        next[k] = v.slice(0, 6000)
        changedClient = true
      }
    }
    patch.content = next
  }
  await db.from('care_reports').update(patch).eq('id', reportId)
  if (changedClient) await invalidateApproval(r.cycle_id, 'The report text was edited after approval.', actor)
  return must(await db.from('care_reports').select('*').eq('id', reportId).single(), 'Report')
}

export async function updateManual(cycleId: string, itemId: string, body: Record<string, unknown>, actor: string) {
  const m = must(await db.from('care_manual_results').select('*').eq('cycle_id', cycleId).eq('item_id', itemId).single(), 'Checklist item')
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let changedClient = false
  if ('status' in body) {
    const st = body.status === null || body.status === '' ? null : String(body.status)
    if (st !== null && !(MANUAL_STATUSES as readonly string[]).includes(st)) throw new CareError('Unknown result.', 400)
    if (st !== m.status) { patch.status = st; patch.confirmed_at = st ? new Date().toISOString() : null; changedClient = true }
  }
  for (const k of ['note', 'reason'] as const) {
    if (typeof body[k] === 'string' && body[k] !== (m[k] || '')) { patch[k] = (body[k] as string).slice(0, 2000); changedClient = true }
  }
  if (typeof body.internal_note === 'string') patch.internal_note = body.internal_note.slice(0, 2000)
  await db.from('care_manual_results').update(patch).eq('id', m.id)
  const all = (await db.from('care_manual_results').select('status').eq('cycle_id', cycleId)).data || []
  const done = all.every((x: { status: string | null }) => x.status && x.status !== 'needs_review')
  const any = all.some((x: { status: string | null }) => x.status)
  await db.from('care_cycles').update({ manual_state: done ? 'done' : any ? 'in_progress' : 'not_started', updated_at: new Date().toISOString() }).eq('id', cycleId)
  if (changedClient) await invalidateApproval(cycleId, 'A manual checklist result changed after approval.', actor)
}

export async function updateFinding(findingId: string, body: Record<string, unknown>, actor: string) {
  const f = must(await db.from('care_findings').select('id, cycle_id, client_visible, internal_note').eq('id', findingId).single(), 'Finding')
  const patch: Record<string, unknown> = {}
  if (typeof body.internal_note === 'string') patch.internal_note = body.internal_note.slice(0, 2000)
  const visChange = typeof body.client_visible === 'boolean' && body.client_visible !== f.client_visible
  if (visChange) patch.client_visible = body.client_visible
  if (Object.keys(patch).length) await db.from('care_findings').update(patch).eq('id', findingId)
  if (visChange) await invalidateApproval(f.cycle_id, 'A finding was shown or hidden after approval.', actor)
}

export async function markReady(cycleId: string, actor: string) {
  const b = await loadBundle(cycleId)
  const problems = readinessProblems(b)
  if (problems.length) throw new CareError(problems.join(' '), 422)
  if (b.report.status !== 'draft') throw new CareError(`The report is already ${b.report.status}.`, 409)
  await db.from('care_reports').update({ status: 'ready', ready_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', b.report.id).eq('version', b.report.version)
  await logActivity({ cycle_id: cycleId, site_id: b.site.id, actor, action: 'report_ready', detail: { version: b.report.version } })
}

export async function approve(cycleId: string, body: { snapshot_hash?: string; signoff?: boolean; approver?: string }, actor: string) {
  const b = await loadBundle(cycleId)
  if (b.report.status !== 'ready') throw new CareError('Mark the report ready for review first.', 409)
  const problems = readinessProblems(b)
  if (problems.length) throw new CareError(problems.join(' '), 422)
  if (body.signoff !== true) throw new CareError('Tick the sign off box to approve.', 422)
  const approver = String(body.approver || '').trim().slice(0, 80)
  if (approver.length < 2) throw new CareError('Type your name to sign off.', 422)
  const snap = await buildSnapshot(b)
  const hash = hashSnapshot(snap)
  if (body.snapshot_hash !== hash) throw new CareError('The report changed since you previewed it. Review the latest preview, then approve.', 409)
  const { reportPdf } = await import('./report-pdf')
  const pdf = await reportPdf(snap)
  const pdfSha = createHash('sha256').update(pdf).digest('hex')
  const path = `${b.report.id}/v${b.report.version}-${hash.slice(0, 12)}.pdf`
  await putObject(REPORTS_BUCKET, path, pdf, 'application/pdf').catch(async (e) => {
    // Same version and hash already stored (a retried approval): keep the original file.
    const exists = (await db.from('care_report_approvals').select('id').eq('report_id', b.report.id).eq('version', b.report.version).maybeSingle()).data
    if (!exists) throw e
  })
  const ins = await db.from('care_report_approvals').insert({
    report_id: b.report.id, version: b.report.version, snapshot: snap, snapshot_hash: hash, pdf_path: path, pdf_sha256: pdfSha, approved_by: `${approver} (${actor})`,
  }).select('id').single()
  if (ins.error) {
    if (ins.error.code === '23505') throw new CareError('This version is already approved.', 409)
    throw new CareError(ins.error.message, 500)
  }
  const upd = await db.from('care_reports').update({ status: 'approved', current_approval_id: ins.data.id, updated_at: new Date().toISOString() })
    .eq('id', b.report.id).eq('version', b.report.version).eq('status', 'ready').select('id')
  if (!upd.data?.length) {
    await db.from('care_report_approvals').update({ invalidated_at: new Date().toISOString(), invalidated_reason: 'The report changed during approval.' }).eq('id', ins.data.id)
    throw new CareError('The report changed during approval. Review it again.', 409)
  }
  await logActivity({ cycle_id: cycleId, site_id: b.site.id, actor, action: 'report_approved', detail: { version: b.report.version, approver, hash: hash.slice(0, 12) } })
  return { approval_id: ins.data.id, version: b.report.version, hash }
}
