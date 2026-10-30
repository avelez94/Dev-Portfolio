/**
 * A website's review history: one entry per billing period, covering its
 * automated checks (every run, each openable), the manual review, findings
 * and your decisions, recorded work and estimates, and the report (every
 * approved version and every send, each with its stored PDF). Also any run's
 * stored results, so earlier checks can be opened as they were.
 *
 * Always scoped to one website: a client with several websites has a
 * separate history for each.
 */
import { db, must, CareError, type Row } from './db'
import { groupFindings, type FindingIn } from './report-model'

const ISSUE = ['failed', 'needs_review', 'could_not_check']

function counts(findings: Row[]) {
  const c: Record<string, number> = {}
  for (const f of findings) if (f.check_key !== 'screenshot') c[f.status] = (c[f.status] || 0) + 1
  return c
}

export async function siteHistory(siteId: string) {
  const site = must(await db.from('care_sites').select('id, label, client_id, site_url, pages, destinations').eq('id', siteId).single(), 'Website')
  const cycles = ((await db.from('care_cycles').select('id, period_start, period_end, source, plan, paid_at, review_due_at, completed_at, hold_reason, included_minutes, billing_flag').eq('site_id', siteId).order('period_start', { ascending: false })).data || []) as Row[]
  const ids = cycles.map((c) => c.id)
  const none = { data: [] as Row[] }
  const q = async (p: PromiseLike<{ data: Row[] | null }>) => ((await p).data || []) as Row[]
  const [runs, manual, notes, work, estimates, reports] = ids.length ? await Promise.all([
    q(db.from('care_scan_runs').select('id, cycle_id, trigger, status, started_at, finished_at, created_at, error, summary, config').in('cycle_id', ids).order('created_at', { ascending: true })),
    q(db.from('care_manual_results').select('cycle_id, item_id, label, status').in('cycle_id', ids)),
    q(db.from('care_issue_notes').select('cycle_id, group_key, resolution').in('cycle_id', ids)),
    q(db.from('care_work_entries').select('cycle_id, total_minutes, applied_minutes, additional_minutes, voided_at, excluded_reason').in('cycle_id', ids)),
    q(db.from('care_estimates').select('cycle_id, id, title, status').in('cycle_id', ids)),
    q(db.from('care_reports').select('id, cycle_id, status, version').in('cycle_id', ids)),
  ]) : [none.data, none.data, none.data, none.data, none.data, none.data]
  const runIds = runs.filter((r) => r.status === 'succeeded' || r.status === 'partial').map((r) => r.id)
  const findings = runIds.length ? await q(db.from('care_findings').select('run_id, check_key, issue_code, status, url, viewport, evidence, client_visible').in('run_id', runIds)) : []
  const rIds = reports.map((r) => r.id)
  const [approvals, sends] = rIds.length ? await Promise.all([
    q(db.from('care_report_approvals').select('id, report_id, version, approved_by, approved_at, invalidated_at, invalidated_reason').in('report_id', rIds).order('version', { ascending: true })),
    q(db.from('care_report_sends').select('id, report_id, approval_id, recipient_email, status, delivery_status, created_at, finished_at').in('report_id', rIds).order('created_at', { ascending: true })),
  ]) : [none.data, none.data]

  const periods = cycles.map((c) => {
    const cr = runs.filter((r) => r.cycle_id === c.id)
    const done = cr.filter((r) => r.status === 'succeeded' || r.status === 'partial')
    const latest = done.at(-1) || null
    const latestFindings = latest ? findings.filter((f) => f.run_id === latest.id) : []
    const cfg = latest?.config || { pages: site.pages || [], destinations: site.destinations || [] }
    const groups = groupFindings(latestFindings.map((f) => ({ ...f })) as FindingIn[], cfg.pages || [], cfg.destinations || [])
    const cn = notes.filter((n) => n.cycle_id === c.id)
    const cm = manual.filter((m) => m.cycle_id === c.id)
    const cw = work.filter((w) => w.cycle_id === c.id && !w.voided_at)
    const report = reports.find((r) => r.cycle_id === c.id) || null
    const ap = report ? approvals.filter((a) => a.report_id === report.id) : []
    const sd = report ? sends.filter((s) => s.report_id === report.id) : []
    const verOf = (approvalId: string) => ap.find((a) => a.id === approvalId)?.version
    const pdf = (v: number) => `/api/care/admin/cycles/${c.id}/pdf?version=${v}&download=1`
    return {
      cycle_id: c.id, period_start: c.period_start, period_end: c.period_end, source: c.source, paid_at: c.paid_at, review_due_at: c.review_due_at,
      completed_at: c.completed_at, hold_reason: c.hold_reason, billing_flag: c.billing_flag,
      checks: {
        runs: cr.map((r) => {
          const own = findings.filter((f) => f.run_id === r.id)
          return { id: r.id, trigger: r.trigger, status: r.status, at: r.finished_at || r.started_at || r.created_at, counts: r.summary?.counts || (own.length ? counts(own) : null), error: r.error || null, has_results: own.length > 0 }
        }),
        latest_run_id: latest?.id || null,
      },
      findings: {
        issues: groups.filter((g) => g.severity === 'issue').length,
        unverified: groups.filter((g) => g.severity === 'unverified').length,
        decided: groups.filter((g) => cn.some((n) => n.group_key === g.key && n.resolution)).length,
        fixed: cn.filter((n) => n.resolution === 'fixed').length,
        titles: groups.slice(0, 5).map((g) => g.title),
      },
      manual: {
        total: cm.length,
        recorded: cm.filter((m) => m.status).length,
        passed: cm.filter((m) => m.status === 'passed').length,
        failed: cm.filter((m) => m.status === 'failed').length,
        skipped: cm.filter((m) => m.status === 'not_checked' || m.status === 'could_not_check').length,
      },
      work: {
        entries: cw.length,
        minutes: cw.reduce((s, w) => s + (w.total_minutes || 0), 0),
        applied: cw.reduce((s, w) => s + (w.applied_minutes || 0), 0),
        additional: cw.reduce((s, w) => s + (w.additional_minutes || 0), 0),
        included: c.included_minutes || 0,
        estimates: estimates.filter((e) => e.cycle_id === c.id).map((e) => ({ id: e.id, title: e.title, status: e.status })),
      },
      report: report ? {
        status: report.status, version: report.version,
        approvals: ap.map((a) => ({ version: a.version, approved_by: a.approved_by, approved_at: a.approved_at, replaced: a.invalidated_at ? a.invalidated_reason || 'Replaced' : null, pdf: pdf(a.version) })),
        sends: sd.map((s) => ({ at: s.finished_at || s.created_at, to: s.recipient_email, status: s.status, delivery: s.delivery_status, version: verOf(s.approval_id) ?? null, pdf: verOf(s.approval_id) ? pdf(verOf(s.approval_id)!) : null })),
      } : null,
    }
  })
  return { site: { id: site.id, label: site.label, client_id: site.client_id, site_url: site.site_url }, periods }
}

/** One check's stored results, as they were (read only). */
export async function runResults(runId: string) {
  const run = must(await db.from('care_scan_runs').select('id, cycle_id, site_id, trigger, status, started_at, finished_at, created_at, error, summary, config').eq('id', runId).single(), 'Check')
  const findings = ((await db.from('care_findings').select('id, check_key, issue_code, status, url, viewport, observed, explanation, next_action, evidence, client_visible, checked_at').eq('run_id', runId).order('check_key').order('url')).data || []) as Row[]
  if (!['succeeded', 'partial', 'failed', 'canceled'].includes(run.status) && !findings.length) throw new CareError('This check hasn’t finished yet.', 409)
  const cfg = run.config || {}
  const groups = groupFindings(findings as unknown as FindingIn[], cfg.pages || [], cfg.destinations || [])
  return {
    run: { id: run.id, cycle_id: run.cycle_id, site_id: run.site_id, trigger: run.trigger, status: run.status, at: run.finished_at || run.started_at || run.created_at, error: run.error, counts: run.summary?.counts || counts(findings) },
    groups,
    screenshots: findings.filter((f) => f.evidence?.screenshot).map((f) => ({ url: f.url, viewport: f.viewport, path: String(f.evidence.screenshot) })),
    findings: findings.filter((f) => f.check_key !== 'screenshot').map((f) => ({ id: f.id, check_key: f.check_key, status: f.status, url: f.url, viewport: f.viewport, observed: f.observed, explanation: f.explanation, next_action: f.next_action, client_visible: f.client_visible, issue: ISSUE.includes(f.status) })),
    pages: (cfg.pages || []).length,
  }
}
