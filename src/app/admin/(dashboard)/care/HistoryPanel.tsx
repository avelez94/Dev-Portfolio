'use client'
/**
 * Review history for one website: every billing period with its automated
 * checks (each check's stored results can be opened), manual review,
 * findings and decisions, recorded work and estimates, and the report (every
 * approved version and send, with the stored PDF). Each website has its own
 * history; a client with several websites sees one per website.
 */
import { useEffect, useState } from 'react'
import { useLoad, Badge, Empty, ErrorBox, Loading, fmt, workStatus, STATUS_TEXT, statusTone } from './ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const countText = (c: Record<string, number> | null) => (c ? ['passed', 'failed', 'needs_review', 'could_not_check', 'not_applicable'].filter((k) => c[k]).map((k) => `${c[k]} ${STATUS_TEXT[k].toLowerCase()}`).join(', ') : '')
const RUN_TONE = (s: string) => (s === 'succeeded' ? 'ok' : s === 'failed' ? 'bad' : s === 'partial' || s === 'canceled' ? 'warn' : 'info') as 'ok' | 'bad' | 'warn' | 'info'

/** One check's stored results, read only. Used here and in the review's run list. */
export function RunResults({ runId, tz }: { runId: string; tz: string }) {
  const r = useLoad<Row>(`runs/${runId}`, [runId])
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />
  if (!r.data) return <Loading lines={2} />
  const { run, groups, findings } = r.data
  return (
    <div className="care-sub" data-testid="run-results" style={{ marginTop: 8 }}>
      <div className="care-label">{run.trigger === 'rerun' ? 'Rerun' : 'Paid period check'} on {fmt(run.at, tz)}: <Badge tone={RUN_TONE(run.status)}>{run.status}</Badge> <span className="care-muted">{countText(run.counts)}</span></div>
      {run.error && <p className="care-muted">{run.error}</p>}
      {groups.length === 0 ? <p className="care-muted" style={{ margin: '6px 0' }}>No issues in this check.</p> : (
        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>{groups.map((g: Row) => <li key={g.key}><b>{g.title}</b> <span className="care-muted">{g.severity === 'issue' ? 'issue' : 'not verified'} · {g.pages.join(', ')}{g.devices.length ? ` · ${g.devices.join(', ')}` : ''}</span></li>)}</ul>
      )}
      <details><summary>All {findings.length} results</summary>
        <div className="care-scroll" tabIndex={0}><table className="care-table">
          <thead><tr><th>Check</th><th>Page</th><th>Result</th><th>What was seen</th></tr></thead>
          <tbody>{findings.map((f: Row) => <tr key={f.id}><td>{f.check_key.replace(/_/g, ' ')}{f.viewport ? ` (${f.viewport})` : ''}</td><td style={{ overflowWrap: 'anywhere' }}>{f.url || ''}</td><td><Badge tone={statusTone(f.status)}>{STATUS_TEXT[f.status] || f.status}</Badge>{!f.client_visible && <span className="care-muted"> hidden from report</span>}</td><td className="care-muted">{f.observed}</td></tr>)}</tbody>
        </table></div>
      </details>
    </div>
  )
}

export default function HistoryPanel({ siteId, tz, cycles, reports, version, go }: { siteId: string; tz: string; cycles: Row[]; reports: Row[]; version: unknown; go: (p: Record<string, string>) => void }) {
  const h = useLoad<Row>(`sites/${siteId}/history`, [siteId, version])
  const [oldestFirst, setOldestFirst] = useState(false)
  const [openRun, setOpenRun] = useState<string | null>(null)
  useEffect(() => {
    if (h.data && typeof window !== 'undefined' && window.location.hash === '#review-history') document.getElementById('review-history')?.scrollIntoView()
  }, [h.data])
  const periods: Row[] = h.data ? (oldestFirst ? [...h.data.periods].reverse() : h.data.periods) : []
  return (
    <section className="care-panel" aria-labelledby="hist-h" id="review-history" data-testid="review-history">
      <div className="care-between">
        <h2 id="hist-h">Review history</h2>
        {periods.length > 1 && <button type="button" className="care-btn small" onClick={() => setOldestFirst(!oldestFirst)}>{oldestFirst ? 'Newest first' : 'Oldest first'}</button>}
      </div>
      <p className="care-muted" style={{ margin: '4px 0 10px' }}>Every billing period for this website, {oldestFirst ? 'oldest' : 'newest'} first: its automated checks, manual review, findings, recorded work and report. Open any earlier check’s results or report version as it was.</p>
      {h.error ? <ErrorBox error={h.error} onRetry={h.reload} /> : !h.data ? <Loading lines={3} /> : periods.length === 0 ? <Empty>No service periods yet. The first appears when the first payment succeeds.</Empty> : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {periods.map((p) => {
            const c = cycles.find((x) => x.id === p.cycle_id) || p
            const [label, tone] = workStatus(c, reports.find((x) => x.cycle_id === p.cycle_id) as { status: string } | undefined)
            const sent = p.report?.sends.find((s: Row) => s.status === 'accepted')
            return (
              <li key={p.cycle_id} className="care-sub" data-testid="history-period">
                <div className="care-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div><b>{fmt(p.period_start, tz, false)} to {fmt(p.period_end, tz, false)}</b> <span className="care-muted">{p.source === 'manual' ? 'Added by hand' : 'Stripe'}{p.paid_at ? `, paid ${fmt(p.paid_at, tz, false)}` : ''}{p.billing_flag ? ` · ${String(p.billing_flag).replace(/_/g, ' ')}` : ''}</span></div>
                  <div className="care-row"><Badge tone={tone}>{label}</Badge><button className="care-btn small" onClick={() => go({ cycle: p.cycle_id })}>Open review</button></div>
                </div>
                <dl className="care-dl" style={{ marginTop: 8 }}>
                  <dt>Automated checks</dt>
                  <dd>{p.checks.runs.length === 0 ? 'None yet' : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>{p.checks.runs.map((r: Row) => (
                      <li key={r.id}>
                        {r.trigger === 'rerun' ? 'Rerun' : 'Paid period check'}, {fmt(r.at, tz)}: <Badge tone={RUN_TONE(r.status)}>{r.status}</Badge> <span className="care-muted">{countText(r.counts)}{r.error ? ` ${r.error}` : ''}</span>{' '}
                        {r.has_results && <button type="button" className="care-btn small" aria-expanded={openRun === r.id} onClick={() => setOpenRun(openRun === r.id ? null : r.id)}>{openRun === r.id ? 'Hide results' : 'View results'}</button>}
                        {openRun === r.id && <RunResults runId={r.id} tz={tz} />}
                      </li>
                    ))}</ul>
                  )}</dd>
                  <dt>Findings</dt>
                  <dd>{p.checks.latest_run_id ? <>{p.findings.issues} issue{p.findings.issues === 1 ? '' : 's'}, {p.findings.unverified} not verified, {p.findings.decided} with a decision{p.findings.fixed ? `, ${p.findings.fixed} fixed` : ''}{p.findings.titles.length ? <span className="care-muted"> · {p.findings.titles.join('; ')}</span> : null}</> : 'No completed check'}</dd>
                  <dt>Manual review</dt>
                  <dd>{p.manual.total === 0 ? 'No checklist items' : `${p.manual.recorded} of ${p.manual.total} recorded: ${p.manual.passed} passed, ${p.manual.failed} need attention, ${p.manual.skipped} not checked`}</dd>
                  <dt>Work recorded</dt>
                  <dd>{p.work.entries === 0 ? 'None' : `${p.work.entries} entr${p.work.entries === 1 ? 'y' : 'ies'}, ${p.work.minutes} minutes (${p.work.applied} of ${p.work.included} included applied${p.work.additional ? `, ${p.work.additional} additional` : ''})`}{p.work.estimates.length > 0 && <span className="care-muted"> · Estimates: {p.work.estimates.map((e: Row) => `${e.title} (${e.status})`).join('; ')}</span>}</dd>
                  <dt>Report</dt>
                  <dd>{!p.report ? 'Not started' : <>
                    <span style={{ textTransform: 'capitalize' }}>{p.report.status}</span> <span className="care-muted">v{p.report.version}</span>
                    {sent && <> · sent {fmt(sent.at, tz)} to {sent.to} <span className="care-muted">({sent.delivery === 'unknown' ? 'delivery not confirmed' : sent.delivery})</span> {sent.pdf && <a href={sent.pdf}>Sent PDF</a>}</>}
                    {p.report.approvals.length > 0 && (
                      <details style={{ marginTop: 4 }}><summary>Approved versions ({p.report.approvals.length}) and sends ({p.report.sends.length})</summary>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                          {p.report.approvals.map((a: Row) => <li key={`a${a.version}`}>v{a.version} approved by {a.approved_by}, {fmt(a.approved_at, tz)}{a.replaced ? ` (replaced: ${a.replaced})` : ''} <a href={a.pdf}>Download PDF</a></li>)}
                          {p.report.sends.map((s: Row, i: number) => <li key={`s${i}`}>Send{s.version ? ` of v${s.version}` : ''}, {fmt(s.at, tz)} to {s.to}: {s.status === 'accepted' ? 'accepted by the email provider' : s.status}</li>)}
                        </ul>
                      </details>
                    )}
                  </>}</dd>
                </dl>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
