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
import { groupFindings } from './report-model'
import { verificationNote, manualSuggestion, needsConfirmation } from './field-suggest'
import { buildReport, modelProblems, type Snapshot, type ModelInput, type FindingIn, type ManualIn, type IssueNoteIn, type WorkEntryIn, type EstimateIn } from './report-model'
import { formatDateOnly } from './schedule'
import { DRAFT_FIELDS, draftReportText, draftSource, type DraftField } from './report-draft'

// Larger work and its prices live in estimates (care_estimates), and completed work in the ledger, not in report text.
export const CONTENT_FIELDS = ['summary', 'investigated', 'fixes', 'outstanding', 'next_steps', 'client_notes'] as const
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


export async function loadBundle(cycleId: string) {
  const cycle = must(await db.from('care_cycles').select('*').eq('id', cycleId).single(), 'Review cycle')
  const site = must(await db.from('care_sites').select('*').eq('id', cycle.site_id).single(), 'Website')
  const client = (await db.from('clients').select('id, name, email, business').eq('id', site.client_id).maybeSingle()).data
  const runs = (await db.from('care_scan_runs').select('*').eq('cycle_id', cycleId).order('created_at', { ascending: false })).data || []
  const done = runs.filter((r: { status: string }) => r.status === 'succeeded' || r.status === 'partial')
  const latest = done[0] || null
  const findings = latest ? (await db.from('care_findings').select('*').eq('run_id', latest.id).order('check_key').order('url')).data || [] : []
  // Earlier checks this month: lets a fix be verified by a clean recheck.
  const earlierIds = done.slice(1).map((r: { id: string }) => r.id)
  const earlierFindings = earlierIds.length ? (await db.from('care_findings').select('*').in('run_id', earlierIds)).data || [] : []
  const previousRun = done[1] || null
  const manual = (await db.from('care_manual_results').select('*').eq('cycle_id', cycleId).order('category').order('label')).data || []
  const notes = (await db.from('care_issue_notes').select('*').eq('cycle_id', cycleId)).data || []
  const report = must(await db.from('care_reports').select('*').eq('cycle_id', cycleId).single(), 'Report')
  const approvals = (await db.from('care_report_approvals').select('id, version, snapshot_hash, pdf_path, pdf_sha256, approved_by, approved_at, invalidated_at, invalidated_reason').eq('report_id', report.id).order('version', { ascending: false })).data || []
  const sends = (await db.from('care_report_sends').select('*').eq('report_id', report.id).order('created_at', { ascending: false })).data || []
  // The period's work ledger and estimates: recorded work appears in the report without retyping it.
  const workEntries = (await db.from('care_work_entries').select('*').eq('cycle_id', cycleId).is('voided_at', null).order('recorded_at').order('line_no')).data || []
  const estimates = (await db.from('care_estimates').select('*').eq('cycle_id', cycleId).in('status', ['draft', 'approved', 'completed']).order('created_at')).data || []
  const allowance = ((await db.rpc('care_period_allowance', { p_cycle: cycleId })).data || [])[0] || null
  return { cycle, site, client, runs, latest, findings, earlierFindings, previousRun, manual, notes, report, approvals, sends, workEntries, estimates, allowance }
}

export type Bundle = Awaited<ReturnType<typeof loadBundle>>

/** The agreed price for this period: the cycle's own, else the website's while the plan matches. Never the advertised price. */
export function agreedPrice(b: Pick<Bundle, 'cycle' | 'site'>): number | null {
  if (typeof b.cycle.agreed_price === 'number') return b.cycle.agreed_price
  if (b.site.plan === b.cycle.plan && typeof b.site.agreed_monthly_price === 'number') return b.site.agreed_monthly_price
  return null
}

/** "October 1 to November 1, 2026", the service period as Stripe bills it. */
export function periodRange(start: string, end: string, tz: string) {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(new Date(d))
  const sy = f(start, { year: 'numeric' })
  const ey = f(end, { year: 'numeric' })
  return `${f(start, { month: 'long', day: 'numeric', ...(sy === ey ? {} : { year: 'numeric' }) })} to ${f(end, { month: 'long', day: 'numeric', year: 'numeric' })}`
}

async function modelInput(b: Bundle): Promise<ModelInput> {
  const tz = (await getSettings()).timezone
  const p = planInfo(b.cycle.plan as PlanId)
  const cfg = b.latest?.config || { pages: b.site.pages, destinations: b.site.destinations }
  return {
    reportId: b.report.id, cycleId: b.cycle.id, version: b.report.version,
    client: { name: b.client?.name || '', business: b.client?.business || '' },
    recipient: { name: b.site.recipient_name || b.client?.name || '', email: b.site.recipient_email || '' },
    site: { label: b.site.label, url: b.site.site_url },
    plan: { id: p.id, name: p.name, includedMinutes: typeof b.cycle.included_minutes === 'number' ? b.cycle.included_minutes : p.includedMinutes, monthlyPrice: agreedPrice(b) },
    work: b.allowance ? { ...b.allowance, confirmed: !!b.cycle.work_log_confirmed_at, entries: b.workEntries as WorkEntryIn[], estimates: b.estimates as EstimateIn[] } : null,
    period: {
      start: formatDateOnly(b.cycle.period_start, tz), end: formatDateOnly(b.cycle.period_end, tz),
      label: new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', year: 'numeric' }).format(new Date(b.cycle.period_start)),
      range: periodRange(b.cycle.period_start, b.cycle.period_end, tz),
    },
    reviewDate: b.latest?.finished_at ? formatDateOnly(b.latest.finished_at, tz) : null,
    scanStatus: b.latest?.status || null,
    // Scope comes from the run that was actually checked, not the current settings.
    pages: (cfg.pages || []).map((x: Row) => ({ label: x.label, url: x.url })),
    destinations: (cfg.destinations || []).map((x: Row) => ({ label: x.label, url: x.url, kind: x.kind })),
    findings: b.findings as FindingIn[],
    earlierFindings: b.earlierFindings as FindingIn[],
    manual: b.manual as ManualIn[],
    notes: b.notes as IssueNoteIn[],
    content: b.report.content || {},
  }
}

export async function buildSnapshot(b: Bundle): Promise<Snapshot> {
  return buildReport(await modelInput(b))
}

export type { Snapshot }

export function hashSnapshot(s: Snapshot): string {
  return createHash('sha256').update(JSON.stringify(s)).digest('hex')
}

/** What has to be true before a report can be marked ready or approved. */
export async function readinessProblems(b: Bundle): Promise<string[]> {
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
  const input = await modelInput(b)
  p.push(...modelProblems(input, buildReport(input)))
  return p
}

export const RESOLUTIONS = ['fixed', 'client_input', 'approval', 'investigating', 'not_an_issue'] as const

/** Your decision on a grouped issue. Client visible changes clear an approval. */
/**
 * The issue group a decision belongs to, with whether a later automated check
 * cleared it. Used to check suggested verification text before it's saved.
 */
async function issueContext(cycleId: string, groupKey: string) {
  const b = await loadBundle(cycleId)
  const cfg = b.latest?.config || { pages: b.site.pages || [], destinations: b.site.destinations || [] }
  const latest = groupFindings(b.findings.map((f: Row) => ({ ...f, client_visible: true })) as FindingIn[], cfg.pages || [], cfg.destinations || [])
  const earlier = groupFindings(b.earlierFindings.map((f: Row) => ({ ...f, client_visible: true })) as FindingIn[], cfg.pages || [], cfg.destinations || [])
  let g: { title: string; pages?: string[]; devices?: string[] } | undefined = latest.find((x) => x.key === groupKey)
  const cleared = !g && earlier.some((x) => x.key === groupKey)
  if (!g) g = earlier.find((x) => x.key === groupKey)
  if (!g && groupKey.startsWith('manual:')) {
    const m = b.manual.find((x: Row) => `manual:${x.item_id}` === groupKey)
    if (m) g = { title: m.label, pages: [], devices: [] }
  }
  const settings = await getSettings()
  return { g, cleared, recheckedOn: b.latest?.finished_at ? formatDateOnly(b.latest.finished_at, settings.timezone) : null }
}

export async function updateIssueNote(cycleId: string, groupKey: string, body: Record<string, unknown>, actor: string) {
  if (!/^[a-z_]+:[\w-]{1,60}$/.test(groupKey)) throw new CareError('Unknown issue.', 400)
  const cur = (await db.from('care_issue_notes').select('*').eq('cycle_id', cycleId).eq('group_key', groupKey).maybeSingle()).data
  // A suggested hand check verification is saved only once you confirm you checked it yourself.
  if (typeof body.verification_note === 'string' && body.verification_note.trim() && body.verification_note.trim() !== String(cur?.verification_note || '').trim() && body.confirm_checked !== true) {
    const ctx = await issueContext(cycleId, groupKey)
    const res = 'resolution' in body ? (body.resolution as string | null) : cur?.resolution
    if (ctx.g && needsConfirmation(body.verification_note, [verificationNote(ctx.g, res, { clearedOnRecheck: ctx.cleared, recheckedOn: ctx.recheckedOn })])) {
      throw new CareError('That verification says you checked the fix by hand. Tick “I checked this myself” to save it, or write what you actually did.', 422)
    }
  }
  const next: Record<string, unknown> = { cycle_id: cycleId, group_key: groupKey, updated_at: new Date().toISOString() }
  let changedClient = false
  if ('resolution' in body) {
    const r = body.resolution === '' || body.resolution === null ? null : String(body.resolution)
    if (r !== null && !(RESOLUTIONS as readonly string[]).includes(r)) throw new CareError('Unknown decision.', 400)
    next.resolution = r
    if (r !== (cur?.resolution ?? null)) changedClient = true
  }
  for (const k of ['client_note', 'verification_note'] as const) {
    if (typeof body[k] === 'string') { next[k] = (body[k] as string).slice(0, 600); if (next[k] !== (cur?.[k] || '')) changedClient = true }
  }
  if (typeof body.internal_note === 'string') next.internal_note = body.internal_note.slice(0, 2000)
  const up = await db.from('care_issue_notes').upsert(next, { onConflict: 'cycle_id,group_key' })
  if (up.error) throw new CareError(up.error.message, 500)
  if (changedClient) await invalidateApproval(cycleId, 'An issue decision changed after approval.', actor)
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

/** The agreed price for one period. It appears in the report, so a change clears an approval. */
export async function updatePlanTime(cycleId: string, body: Record<string, unknown>, actor: string) {
  const c = must(await db.from('care_cycles').select('id, site_id, agreed_price').eq('id', cycleId).single(), 'Cycle')
  if (!('agreed_price' in body)) return
  const v = body.agreed_price
  const n = v === null || v === '' ? null : Number(v)
  if (n !== null && (!Number.isInteger(n) || n < 0 || n > 100000)) throw new CareError('The agreed monthly price must be a whole number from 0 to 100000.', 422)
  if (n === c.agreed_price) return
  await db.from('care_cycles').update({ agreed_price: n, updated_at: new Date().toISOString() }).eq('id', cycleId)
  await logActivity({ cycle_id: cycleId, site_id: c.site_id, actor, action: 'plan_price_changed', detail: { agreed_price: n } })
  await invalidateApproval(cycleId, 'The plan price changed after approval.', actor)
}

export async function updateManual(cycleId: string, itemId: string, body: Record<string, unknown>, actor: string) {
  const m = must(await db.from('care_manual_results').select('*').eq('cycle_id', cycleId).eq('item_id', itemId).single(), 'Checklist item')
  // A suggested note that says you checked this by hand is saved only once you confirm you did.
  if (typeof body.note === 'string' && body.note.trim() && body.note.trim() !== String(m.note || '').trim() && body.confirm_checked !== true) {
    const status = 'status' in body ? (body.status as string | null) : m.status
    if (needsConfirmation(body.note, [manualSuggestion({ label: m.label, status }).note])) {
      throw new CareError('That note says you checked this by hand. Tick “I checked this myself” to save it, or write what you actually did.', 422)
    }
  }
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
  const problems = await readinessProblems(b)
  if (problems.length) throw new CareError(problems.join(' '), 422)
  if (b.report.status !== 'draft') throw new CareError(`The report is already ${b.report.status}.`, 409)
  await db.from('care_reports').update({ status: 'ready', ready_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', b.report.id).eq('version', b.report.version)
  await logActivity({ cycle_id: cycleId, site_id: b.site.id, actor, action: 'report_ready', detail: { version: b.report.version } })
}

export async function approve(cycleId: string, body: { snapshot_hash?: string; signoff?: boolean; approver?: string }, actor: string) {
  const b = await loadBundle(cycleId)
  if (b.report.status !== 'ready') throw new CareError('Mark the report ready for review first.', 409)
  const problems = await readinessProblems(b)
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

/* ---------------------------- suggested text ---------------------------- */

/**
 * What the generator last wrote, per field (applied), the replacements it
 * proposes for fields you changed (pending), when, and a fingerprint of the
 * facts it used (source).
 */
export type Suggestions = { generated_at?: string; source?: string; mode?: string; applied?: Partial<Record<DraftField, string>>; pending?: Partial<Record<DraftField, string>> }

const sourceHash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24)
const manualResults = (b: Bundle) => b.manual.map((m: Row) => ({ label: m.label, status: m.status }))

async function draftFor(b: Bundle) {
  const snap = await buildSnapshot(b)
  const manual = manualResults(b)
  return { draft: draftReportText(snap, manual), source: sourceHash(draftSource(snap, manual)) }
}

/** For the review screen: the suggestions, and whether the facts changed since they were generated. */
export async function suggestionState(b: Bundle) {
  const sug = (b.report.suggestions || {}) as Suggestions
  if (!sug.generated_at) return { generated_at: null, outdated: false, pending: {} }
  const { source } = await draftFor(b)
  return { generated_at: sug.generated_at, mode: sug.mode || null, outdated: source !== sug.source, pending: sug.pending || {} }
}

/**
 * Writes suggested text. A field you haven't touched (empty, or still exactly
 * what was last suggested) is refreshed; a field you edited keeps your words
 * and gets a proposed replacement you can accept or dismiss.
 *
 * mode 'auto' (after a check finishes) only changes a report that is still a
 * draft; otherwise everything becomes a proposal. mode 'manual' ("Update
 * suggested text") goes through the normal edit path, so changing an
 * approved report returns it to draft and needs approval again, and a sent
 * version stays exactly as sent. Nothing here approves or sends anything.
 */
export async function refreshSuggestions(cycleId: string, mode: 'auto' | 'manual', actor: string) {
  const b = await loadBundle(cycleId)
  const r = b.report
  const { draft, source } = await draftFor(b)
  const prev = (r.suggestions || {}) as Suggestions
  const content = { ...(r.content || {}) } as ReportContent
  const applied = { ...(prev.applied || {}) }
  const pending = { ...(prev.pending || {}) }
  const canApply = mode === 'manual' || r.status === 'draft'
  const changes: ReportContent = {}
  for (const k of DRAFT_FIELDS) {
    const cur = content[k] || ''
    const next = draft[k]
    // Untouched: still exactly what was last suggested, or never suggested and still empty.
    // A field you cleared after a suggestion counts as edited.
    const untouched = applied[k] !== undefined ? cur === applied[k] : cur === ''
    if (next === cur) { delete pending[k]; applied[k] = next; continue }
    if (untouched && canApply) {
      changes[k] = next
      applied[k] = next
      delete pending[k]
    } else if (next) pending[k] = next
    else delete pending[k]
  }
  const suggestions: Suggestions = { generated_at: new Date().toISOString(), source, mode, applied, pending }
  await db.from('care_reports').update({ suggestions, updated_at: new Date().toISOString() }).eq('id', r.id)
  if (Object.keys(changes).length) await updateContent(r.id, { content: { ...content, ...changes } }, actor)
  await logActivity({ cycle_id: cycleId, site_id: b.site.id, actor, action: 'report_text_suggested', detail: { mode, applied: Object.keys(changes), proposed: Object.keys(pending) } })
  return { applied: Object.keys(changes), proposed: Object.keys(pending) }
}

/** Uses one proposed replacement. Your other fields stay as they are. */
export async function acceptSuggestion(cycleId: string, field: string, actor: string) {
  if (!(DRAFT_FIELDS as readonly string[]).includes(field)) throw new CareError('Unknown field.', 422)
  const k = field as DraftField
  const r = must(await db.from('care_reports').select('*').eq('cycle_id', cycleId).single(), 'Report')
  const sug = (r.suggestions || {}) as Suggestions
  const text = sug.pending?.[k]
  if (text === undefined) throw new CareError('That suggestion is no longer available. Update suggested text to get a fresh one.', 409)
  const pending = { ...(sug.pending || {}) }
  delete pending[k]
  await db.from('care_reports').update({ suggestions: { ...sug, pending, applied: { ...(sug.applied || {}), [k]: text } } }).eq('id', r.id)
  await updateContent(r.id, { content: { ...(r.content || {}), [k]: text } }, actor)
}

/** Keeps your text and drops the proposed replacement. */
export async function dismissSuggestion(cycleId: string, field: string) {
  const r = must(await db.from('care_reports').select('*').eq('cycle_id', cycleId).single(), 'Report')
  const sug = (r.suggestions || {}) as Suggestions
  const pending = { ...(sug.pending || {}) }
  delete pending[field as DraftField]
  await db.from('care_reports').update({ suggestions: { ...sug, pending } }).eq('id', r.id)
}
