'use client'
import { useEffect, useMemo, useState } from 'react'
import { useLoad, careApi, Badge, BillingBadge, Field, Loading, ErrorBox, Empty, Action, fmt, workStatus, STATUS_TEXT, statusTone } from './ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Go = (n: { view?: 'sites'; site?: string | null; cycle?: string | null }) => void

const CHECK_TEXT: Record<string, string> = {
  page_load: 'Page loads', redirects: 'Redirects', https: 'Secure connection', images: 'Images', overflow: 'Fits the screen', screenshot: 'Screenshot',
  internal_links: 'Links within the site', destination: 'Destination opens', scan: 'Automated check',
}
const FIELDS: [string, string, string][] = [
  ['summary', 'Client summary (required)', 'A few sentences in plain language: how the site is doing this month.'],
  ['investigated', 'Issues I looked into', 'What you investigated and what you found.'],
  ['fixes', 'What I fixed', 'Only fixes you actually made and confirmed. Leave empty if none.'],
  ['outstanding', 'Still open', 'Findings that remain unresolved, disclosed clearly.'],
  ['next_steps', 'Recommended next steps', ''],
  ['proposed_work', 'Needs client approval or more work', 'Work outside the plan. Nothing starts until they approve.'],
  ['estimate', 'Estimate (optional)', 'For example: about 2 hours, $200'],
  ['client_notes', 'Notes for the client', ''],
]

export default function CycleView({ id, go }: { id: string; go: Go }) {
  const { data, error, reload } = useLoad<Row>(`cycles/${id}`)
  const active = data?.runs?.some((r: Row) => r.status === 'queued' || r.status === 'running')
  useEffect(() => {
    if (!active) return
    const t = setInterval(reload, 5000)
    return () => clearInterval(t)
  }, [active, reload])
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <div className="care-panel"><Loading lines={8} /></div>
  const { cycle, site, client, report, timezone: tz } = data
  const [work, tone] = workStatus(cycle, report)
  const latestRun = data.runs[0]
  const sentOk = data.sends.find((s: Row) => s.status === 'accepted')
  return (
    <>
      <button className="care-btn small" onClick={() => go({ site: site.id })} style={{ marginBottom: 12 }}>← {site.label}</button>
      <div className="care-who" aria-label="Active review">
        <div className="care-label">Monthly review for</div>
        <h2>{client?.business || client?.name || 'Unknown client'}</h2>
        <div>{site.label} · <a href={site.site_url} target="_blank" rel="noreferrer noopener">{site.site_url}</a></div>
        <div className="care-muted">Report goes to {site.recipient_name || 'no name'} &lt;<b style={{ color: 'var(--text)' }}>{site.recipient_email || 'no email set'}</b>&gt;</div>
        <div className="care-muted">Service period {fmt(cycle.period_start, tz, false)} to {fmt(cycle.period_end, tz, false)} · {data.plan.name}{data.plan.includedMinutes ? ` · ${data.plan.includedMinutes} min included (checks and report don’t use it)` : ''}</div>
        <div className="care-steps">
          <div className="care-step"><span>Subscription</span>{cycle.billing_flag ? <Badge tone="bad">{cycle.billing_flag.replace(/_/g, ' ')}</Badge> : cycle.source === 'manual' ? <Badge>Billed outside Stripe</Badge> : <Badge tone="ok">Period paid</Badge>} <BillingBadge state={site.billing_state} /></div>
          <div className="care-step"><span>Automated check</span><Badge tone={cycle.scan_state === 'done' ? 'ok' : cycle.scan_state === 'failed' ? 'bad' : cycle.scan_state === 'partial' ? 'warn' : 'info'}>{cycle.scan_state.replace(/_/g, ' ')}</Badge></div>
          <div className="care-step"><span>Manual review</span><Badge tone={cycle.manual_state === 'done' ? 'ok' : 'warn'}>{cycle.manual_state.replace(/_/g, ' ')}</Badge></div>
          <div className="care-step"><span>Report</span><Badge tone={report.status === 'sent' ? 'ok' : report.status === 'approved' ? 'coral' : 'info'}>{report.status} v{report.version}</Badge></div>
          <div className="care-step"><span>Due</span>{new Date(cycle.review_due_at) < new Date() && !cycle.completed_at ? <Badge tone="bad">Overdue</Badge> : null} {fmt(cycle.review_due_at, tz)}</div>
        </div>
        <div style={{ marginTop: 8 }}><Badge tone={tone}>{work}</Badge> {sentOk && <span className="care-muted">Sent {fmt(sentOk.finished_at, tz)}</span>}</div>
      </div>

      {cycle.hold_reason === 'enrollment' && (
        <div className="care-sub" style={{ marginBottom: 16 }}><b>Waiting for setup confirmation.</b> This period is paid, but no check runs until you confirm the website setup. <button className="care-btn small" onClick={() => go({ site: site.id })}>Confirm setup</button></div>
      )}

      <ScanPanel data={data} reload={reload} />
      <FindingsPanel data={data} reload={reload} />
      <ManualPanel data={data} reload={reload} />
      <ReportEditor data={data} reload={reload} />
      <ApprovePanel data={data} reload={reload} />
      {(report.status === 'approved' || report.status === 'sent' || data.sends.length > 0) && <SendPanel data={data} reload={reload} />}
      <DuePanel data={data} reload={reload} />
      <section className="care-panel">
        <h2 style={{ marginBottom: 8 }}>Notifications and history</h2>
        <div className="care-two">
          <div>
            <div className="care-label">Emails to you</div>
            {data.notifications.length === 0 ? <p className="care-muted">None yet.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>{data.notifications.map((n: Row) => <li key={n.id}>{n.kind.replace(/_/g, ' ')}: <Badge tone={n.status === 'sent' ? 'ok' : n.status === 'failed' ? 'bad' : 'warn'}>{n.status}</Badge> {n.error && <span className="care-muted">{n.error}</span>} {n.status !== 'sent' && <Action small label="Retry" run={() => careApi(`notifications/${n.id}/retry`, { method: 'POST', json: {} })} done={reload} />}</li>)}</ul>
            )}
            <p className="care-muted" style={{ marginTop: 6 }}>Calendar: listed in your private calendar feed when it’s turned on in settings. No personal calendar is connected, so no time is blocked or claimed as free.</p>
          </div>
          <div>
            <div className="care-label">History</div>
            <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 260, overflow: 'auto' }}>{data.activity.map((a: Row) => <li key={a.id}><span className="care-muted">{fmt(a.created_at, tz)}</span> {a.action.replace(/_/g, ' ')}</li>)}</ul>
          </div>
        </div>
      </section>
      {latestRun?.error && <span className="care-sr">{latestRun.error}</span>}
    </>
  )
}

function ScanPanel({ data, reload }: { data: Row; reload: () => void }) {
  const { runs, cycle, timezone: tz, site } = data
  const current = runs.find((r: Row) => r.status === 'queued' || r.status === 'running')
  return (
    <section className="care-panel" aria-labelledby="scan-h">
      <div className="care-between">
        <h2 id="scan-h">Automated check</h2>
        <div className="care-row">
          {current ? <Action label={current.status === 'queued' ? 'Cancel queued check' : 'Stop check'} run={() => careApi(`cycles/${cycle.id}/cancel-scan`, { method: 'POST', json: {} })} done={reload} />
            : site.enrollment_status === 'confirmed' && <Action label={runs.length ? 'Run the check again' : 'Run check now'} run={() => careApi(`cycles/${cycle.id}/rerun`, { method: 'POST', json: {} })} done={reload} />}
        </div>
      </div>
      <p className="care-muted" style={{ margin: '4px 0 10px' }}>Read only: pages are opened, never filled in or submitted. A rerun stays in this month’s review and never creates a new billing period.</p>
      {current && (
        <div className="care-sub" role="status" aria-live="polite" style={{ marginBottom: 10 }}>
          <b>{current.status === 'queued' ? 'Queued' : 'Running'}</b> (attempt {current.attempts || 1} of {current.max_attempts}) {current.progress?.total ? `· ${current.progress.done} of ${current.progress.total} · ${current.progress.step}` : current.status === 'queued' ? `· waiting for the runner (from ${fmt(current.available_at, tz)})` : ''}
          {current.cancel_requested && <div className="care-muted">Stop requested; the runner stops after its current step.</div>}
          {current.error && <div className="care-muted">{current.error}</div>}
        </div>
      )}
      {runs.length === 0 ? <Empty>No checks have run for this period yet.</Empty> : (
        <div className="care-scroll"><table className="care-table">
          <thead><tr><th>Started</th><th>Why</th><th>Result</th><th>Details</th></tr></thead>
          <tbody>{runs.map((r: Row) => (
            <tr key={r.id}>
              <td>{fmt(r.started_at || r.created_at, tz)}</td>
              <td>{r.trigger === 'rerun' ? 'Rerun' : 'Scheduled'}</td>
              <td><Badge tone={r.status === 'succeeded' ? 'ok' : r.status === 'failed' ? 'bad' : r.status === 'partial' || r.status === 'canceled' ? 'warn' : 'info'}>{r.status}</Badge></td>
              <td className="care-muted">{r.summary?.counts ? Object.entries(r.summary.counts).map(([k, v]) => `${v} ${STATUS_TEXT[k] || k}`).join(', ') : ''}{r.error ? ` ${r.error}` : ''}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {cycle.scan_state === 'failed' && <p style={{ marginTop: 8, color: 'var(--redText)' }}>The check failed, so nothing was confirmed this month. Retry it, or check the site by hand and mark the checklist accordingly.</p>}
    </section>
  )
}

function FindingsPanel({ data, reload }: { data: Row; reload: () => void }) {
  const [filter, setFilter] = useState<string>('issues')
  const { findings, diff, latest, timezone: tz, previousLabel } = data
  const newSet = useMemo(() => new Set((diff?.newIssues || []).map((f: Row) => f.fingerprint)), [diff])
  if (!latest) return null
  const groups: Record<string, Row[]> = { issues: [], could_not_check: [], passed: [], all: findings }
  for (const f of findings) {
    if (f.status === 'failed' || f.status === 'needs_review') groups.issues.push(f)
    else if (f.status === 'could_not_check') groups.could_not_check.push(f)
    else groups.passed.push(f)
  }
  const shown = groups[filter] || []
  return (
    <section className="care-panel" aria-labelledby="find-h">
      <div className="care-between"><h2 id="find-h">Findings</h2><span className="care-muted">From the check on {fmt(latest.finished_at, tz)}</span></div>
      {diff && <p className="care-muted" style={{ margin: '4px 0 8px' }}>Compared with {previousLabel}: {diff.newIssues.length} new, {diff.resolved.length} no longer showing, {diff.changed.length} changed{diff.notSeen.length ? `, ${diff.notSeen.length} not rechecked (not counted as fixed)` : ''}.</p>}
      <div className="care-row" role="tablist" aria-label="Filter findings" style={{ margin: '8px 0 12px' }}>
        {[['issues', 'Needs attention'], ['could_not_check', 'Could not check'], ['passed', 'Passed'], ['all', 'All']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} className="care-btn small" style={filter === k ? { background: 'var(--accentBg)', borderColor: 'var(--accent)' } : undefined} onClick={() => setFilter(k)}>{l} ({groups[k].length})</button>
        ))}
      </div>
      {shown.length === 0 ? <Empty>{filter === 'issues' ? 'Nothing failed or needs review in the automated check.' : 'None.'}</Empty> : (
        <div className="care-grid">{shown.map((f: Row) => <Finding key={f.id} f={f} tz={tz} isNew={newSet.has(f.fingerprint)} reload={reload} />)}</div>
      )}
    </section>
  )
}

function Finding({ f, tz, isNew, reload }: { f: Row; tz: string; isNew: boolean; reload: () => void }) {
  const [note, setNote] = useState(f.internal_note || '')
  const ev = f.evidence || {}
  return (
    <article className={`care-finding ${f.status}`}>
      <div className="care-between">
        <div><b>{CHECK_TEXT[f.check_key] || f.check_key}</b>{f.viewport && <span className="care-muted"> · {f.viewport}</span>} {isNew && <Badge tone="coral">New this time</Badge>} {!f.client_visible && <Badge>Hidden from client</Badge>}</div>
        <Badge tone={statusTone(f.status)}>{STATUS_TEXT[f.status]}</Badge>
      </div>
      {f.url && <div className="care-muted" style={{ wordBreak: 'break-all' }}>{f.url}</div>}
      <div style={{ marginTop: 6 }}><span className="care-label">Observed</span> {f.observed}</div>
      <div><span className="care-label">What it means</span> {f.explanation}</div>
      {f.possible_cause && <div><span className="care-label">Possible cause (not confirmed)</span> {f.possible_cause}</div>}
      {f.next_action && <div><span className="care-label">Suggested next step</span> {f.next_action}</div>}
      <div className="care-muted" style={{ fontSize: 12, marginTop: 4 }}>
        Checked {fmt(f.checked_at, tz)}{ev.http_status ? ` · HTTP ${ev.http_status}` : ''}{ev.error_code ? ` · ${ev.error_code}` : ''}{ev.load_ms ? ` · ${(ev.load_ms / 1000).toFixed(1)}s` : ''}{ev.redirect_chain?.length ? ` · via ${ev.redirect_chain.join(' → ')}` : ''}{ev.found_on ? ` · found on ${ev.found_on}` : ''}
      </div>
      {ev.screenshot && <a href={`/api/care/admin/evidence?path=${encodeURIComponent(ev.screenshot)}`} target="_blank" rel="noreferrer"><img className="care-shot" style={{ maxHeight: 220, marginTop: 6 }} src={`/api/care/admin/evidence?path=${encodeURIComponent(ev.screenshot)}`} alt={`${f.viewport} screenshot of ${f.url}`} loading="lazy" /></a>}
      <div className="care-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}><Field label="Private note" id={`fn-${f.id}`}><input id={`fn-${f.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only you see this" /></Field></div>
        <Action small label="Save note" run={() => careApi(`findings/${f.id}`, { method: 'PUT', json: { internal_note: note } })} done={reload} />
        <Action small label={f.client_visible ? 'Hide from client report' : 'Show in client report'} run={() => careApi(`findings/${f.id}`, { method: 'PUT', json: { client_visible: !f.client_visible } })} done={reload} />
      </div>
    </article>
  )
}

function ManualPanel({ data, reload }: { data: Row; reload: () => void }) {
  const { manual, cycle } = data
  return (
    <section className="care-panel" aria-labelledby="man-h">
      <h2 id="man-h">Manual checklist</h2>
      <p className="care-muted" style={{ margin: '4px 0 12px' }}>Record what you checked by hand. Every item needs a result before approval; use Not checked with a reason if you couldn’t do it.</p>
      {manual.length === 0 ? <Empty>No checklist items. Add them in the website settings.</Empty> : (
        <div className="care-grid">{manual.map((m: Row) => <ManualItem key={m.id} m={m} cycleId={cycle.id} reload={reload} />)}</div>
      )}
    </section>
  )
}

function ManualItem({ m, cycleId, reload }: { m: Row; cycleId: string; reload: () => void }) {
  const [s, setS] = useState({ status: m.status || '', note: m.note || '', reason: m.reason || '', internal_note: m.internal_note || '' })
  const needsReason = s.status === 'not_checked' || s.status === 'could_not_check'
  const dirty = s.status !== (m.status || '') || s.note !== (m.note || '') || s.reason !== (m.reason || '') || s.internal_note !== (m.internal_note || '')
  return (
    <div className={`care-finding ${m.status || ''}`}>
      <div className="care-between"><div><span className="care-muted">{m.category}</span> <b>{m.label}</b></div>{m.status ? <Badge tone={statusTone(m.status)}>{STATUS_TEXT[m.status]}</Badge> : <Badge tone="warn">No result yet</Badge>}</div>
      {m.instructions && <p className="care-muted">{m.instructions}</p>}
      <div className="care-two" style={{ marginTop: 8 }}>
        <Field label="Result" id={`ms-${m.id}`}>
          <select id={`ms-${m.id}`} value={s.status} onChange={(e) => setS({ ...s, status: e.target.value })}>
            <option value="">Choose a result</option>
            {['passed', 'failed', 'needs_review', 'could_not_check', 'not_applicable', 'not_checked'].map((k) => <option key={k} value={k}>{STATUS_TEXT[k]}</option>)}
          </select>
        </Field>
        <Field label="What you found (client sees this)" id={`mn-${m.id}`}><input id={`mn-${m.id}`} value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} /></Field>
      </div>
      {needsReason && <Field label="Reason it wasn’t checked (required)" id={`mr-${m.id}`}><input id={`mr-${m.id}`} value={s.reason} onChange={(e) => setS({ ...s, reason: e.target.value })} /></Field>}
      <div className="care-row" style={{ marginTop: 6, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}><Field label="Private note" id={`mi-${m.id}`}><input id={`mi-${m.id}`} value={s.internal_note} onChange={(e) => setS({ ...s, internal_note: e.target.value })} /></Field></div>
        <Action small tone={dirty ? 'primary' : undefined} disabled={!dirty} label="Save" run={() => careApi(`cycles/${cycleId}/manual/${m.item_id}`, { method: 'PUT', json: s })} done={reload} />
      </div>
    </div>
  )
}

function ReportEditor({ data, reload }: { data: Row; reload: () => void }) {
  const { report, cycle } = data
  const [c, setC] = useState<Row>(report.content || {})
  const [internal, setInternal] = useState(report.internal_notes || '')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { setC(report.content || {}); setInternal(report.internal_notes || '') }, [report.version, report.content, report.internal_notes]) // eslint-disable-line react-hooks/set-state-in-effect
  const locked = report.status === 'approved' || report.status === 'ready' || report.status === 'sent'
  return (
    <section className="care-panel" aria-labelledby="rep-h">
      <div className="care-between"><h2 id="rep-h">Draft report</h2><span className="care-muted">Version {report.version} · {report.status}</span></div>
      {locked && <p className="care-sub" style={{ margin: '8px 0' }}>Editing now returns the report to draft{report.status === 'approved' ? ' and clears the approval' : report.status === 'sent' ? ' as a new version; the sent version is kept exactly as sent' : ''}.</p>}
      {msg && <div className="care-okmsg" role="status">{msg}</div>}
      <div className="care-grid" style={{ marginTop: 10 }}>
        {FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label} id={`rc-${k}`} hint={hint || undefined}>
            {k === 'estimate' ? <input id={`rc-${k}`} value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} /> : <textarea id={`rc-${k}`} value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} />}
          </Field>
        ))}
        <Field label="Private notes (never in the report)" id="rc-int"><textarea id="rc-int" value={internal} onChange={(e) => setInternal(e.target.value)} style={{ borderColor: 'var(--amberText)' }} /></Field>
        <div><Action tone="primary" label="Save draft" run={() => careApi(`cycles/${cycle.id}/report`, { method: 'PUT', json: { content: c, internal_notes: internal, base_version: report.version } })} done={() => { setMsg('Draft saved.'); reload() }} /></div>
      </div>
    </section>
  )
}

function ReportPreview({ s }: { s: Row }) {
  const list = (items: string[]) => items.length ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : null
  return (
    <div className="care-paper" aria-label="Client report preview">
      <div className="sec" style={{ marginTop: 0 }}>Website Care · Monthly health report</div>
      <h2 style={{ fontSize: 24 }}>{s.site.label}, {s.period.label}</h2>
      <p className="muted">Prepared for {[s.recipient.name, s.client.business].filter(Boolean).join(', ')} · {s.site.url}</p>
      <p className="muted">Service period {s.period.start} to {s.period.end} · Checks run {s.review_date || 'not run'} · {s.plan.name}</p>
      <div className="sec">Summary</div><p style={{ whiteSpace: 'pre-wrap' }}>{s.summary || <em>No summary yet.</em>}</p>
      <div className="sec">1. What was checked</div>{list(s.sections.checked) || <p>No checks were completed.</p>}
      <div className="sec">2. What needs attention</div>
      {s.sections.attention.length === 0 && !s.sections.outstanding ? <p>Nothing from this month’s checks needs attention.</p> : (
        <ul>{s.sections.attention.map((a: Row, i: number) => <li key={i}><b>{a.label}{a.viewport ? ` (${a.viewport})` : ''}: {STATUS_TEXT[a.status]}</b>{a.url && <div className="muted" style={{ wordBreak: 'break-all' }}>{a.url}</div>}<div>What I saw: {a.observed}</div>{a.explanation && <div>What it means: {a.explanation}</div>}{a.possible_cause && <div>Possible cause (not confirmed): {a.possible_cause}</div>}{a.next_action && <div>Suggested next step: {a.next_action}</div>}</li>)}</ul>
      )}
      {s.sections.outstanding && <p style={{ whiteSpace: 'pre-wrap' }}><b>Still open:</b> {s.sections.outstanding}</p>}
      <div className="sec">3. What I fixed</div><p style={{ whiteSpace: 'pre-wrap' }}>{s.sections.fixed || 'No fixes were made this month.'}</p>
      <div className="sec">4. Needs your approval or more work</div><p style={{ whiteSpace: 'pre-wrap' }}>{s.sections.needs_approval || 'Nothing needs your approval right now.'}</p>
      {s.sections.estimate && <p><b>Estimate: {s.sections.estimate}.</b> Nothing here starts until you approve it.</p>}
      {s.could_not_check.length > 0 && <><div className="sec">Could not check</div><ul>{s.could_not_check.map((c: Row, i: number) => <li key={i}>{c.label}{c.url ? ` (${c.url})` : ''}: {c.why || 'No reason recorded.'}</li>)}</ul></>}
      {s.comparison && <><div className="sec">Compared with {s.comparison.against}</div><p>{s.comparison.new_issues.length ? `New this time: ${s.comparison.new_issues.join('; ')}. ` : ''}{s.comparison.resolved.length ? `No longer showing: ${s.comparison.resolved.join('; ')}.` : ''}{!s.comparison.new_issues.length && !s.comparison.resolved.length ? 'No change in the automated results.' : ''}</p></>}
      {s.investigated && <><div className="sec">Issues I looked into</div><p style={{ whiteSpace: 'pre-wrap' }}>{s.investigated}</p></>}
      {s.next_steps && <><div className="sec">Recommended next steps</div><p style={{ whiteSpace: 'pre-wrap' }}>{s.next_steps}</p></>}
      {s.client_notes && <><div className="sec">Notes</div><p style={{ whiteSpace: 'pre-wrap' }}>{s.client_notes}</p></>}
      <div className="sec">About these checks</div>{s.disclaimers.map((d: string, i: number) => <p key={i} className="muted" style={{ fontSize: 13 }}>{d}</p>)}
    </div>
  )
}

function ApprovePanel({ data, reload }: { data: Row; reload: () => void }) {
  const { report, cycle, problems, snapshot, snapshotHash } = data
  const [viewed, setViewed] = useState(false)
  const [signoff, setSignoff] = useState(false)
  const [name, setName] = useState('')
  useEffect(() => { setViewed(false); setSignoff(false) }, [snapshotHash]) // eslint-disable-line react-hooks/set-state-in-effect
  const approvals = data.approvals as Row[]
  return (
    <section className="care-panel" aria-labelledby="ap-h">
      <div className="care-between"><h2 id="ap-h">Review and approve</h2><Badge tone={report.status === 'approved' || report.status === 'sent' ? 'ok' : report.status === 'ready' ? 'coral' : 'info'}>{report.status === 'draft' ? 'Draft' : report.status === 'ready' ? 'Ready for review' : report.status === 'approved' ? 'Approved' : 'Sent'}</Badge></div>
      <p className="care-muted" style={{ margin: '4px 0 12px' }}>Draft → Ready for review → Approved → Sent. Unresolved findings can be approved as long as the report discloses them.</p>
      {problems.length > 0 && report.status === 'draft' && (
        <div className="care-sub" style={{ marginBottom: 12 }}><b>Before this can be marked ready:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{problems.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
      )}
      {report.status === 'draft' && <Action tone="primary" disabled={problems.length > 0} label="Mark ready for review" run={() => careApi(`cycles/${cycle.id}/ready`, { method: 'POST', json: {} })} done={reload} />}
      {(report.status === 'ready' || report.status === 'approved') && <Action label="Return to draft" run={() => careApi(`cycles/${cycle.id}/draft`, { method: 'POST', json: {} })} done={reload} />}

      <details style={{ marginTop: 14 }} open={report.status === 'ready'} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setViewed(true) }}>
        <summary><b>Client facing report (version {report.version})</b></summary>
        <div style={{ marginTop: 10 }}>
          <ReportPreview s={snapshot} />
          <div className="care-row" style={{ marginTop: 10 }}>
            <a className="care-btn" href={`/api/care/admin/cycles/${cycle.id}/pdf`} target="_blank" rel="noreferrer" onClick={() => setViewed(true)}>Open PDF preview</a>
            <a className="care-btn" href={`/api/care/admin/cycles/${cycle.id}/pdf?download=1`}>Download preview PDF</a>
          </div>
        </div>
      </details>

      {report.status === 'ready' && (
        <div className="care-sub" style={{ marginTop: 14 }}>
          <div className="care-label" style={{ marginBottom: 6 }}>Sign off</div>
          <label className="care-row"><input type="checkbox" checked={signoff} onChange={(e) => setSignoff(e.target.checked)} disabled={!viewed} /> I reviewed the complete client report and PDF for version {report.version}, and everything it says passed, was fixed, or was checked by hand is confirmed.</label>
          {!viewed && <p className="care-muted">Open the report above or the PDF preview first.</p>}
          <div className="care-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 220 }}><Field label="Your name" id="ap-name"><input id="ap-name" value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
            <Action tone="primary" disabled={!signoff || name.trim().length < 2} label="Approve this version" run={() => careApi(`cycles/${cycle.id}/approve`, { method: 'POST', json: { snapshot_hash: snapshotHash, signoff, approver: name } })} done={reload} />
          </div>
        </div>
      )}
      {approvals.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="care-label">Approved versions</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{approvals.map((a) => (
            <li key={a.id}>v{a.version} by {a.approved_by} on {fmt(a.approved_at, data.timezone)} {a.invalidated_at ? <Badge>Replaced: {a.invalidated_reason}</Badge> : <Badge tone="ok">Current</Badge>} <a href={`/api/care/admin/cycles/${cycle.id}/pdf?version=${a.version}&download=1`}>Download PDF</a></li>
          ))}</ul>
        </div>
      )}
    </section>
  )
}

function SendPanel({ data, reload }: { data: Row; reload: () => void }) {
  const { report, cycle, sends, timezone: tz } = data
  const pv = useLoad<Row>(report.status === 'approved' ? `cycles/${cycle.id}/send-preview` : null, [report.current_approval_id])
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  useEffect(() => { if (pv.data) { setSubject(pv.data.subject); setMessage(pv.data.message) } }, [pv.data]) // eslint-disable-line react-hooks/set-state-in-effect
  const p = pv.data
  return (
    <section className="care-panel" aria-labelledby="send-h">
      <h2 id="send-h">Send to the client</h2>
      {report.status === 'approved' && (
        pv.error ? <ErrorBox error={pv.error} onRetry={pv.reload} /> : !p ? <Loading /> : (
          <div className="care-grid" style={{ marginTop: 10 }}>
            <div className="care-who" style={{ margin: 0 }}>
              <div className="care-label">Sending to</div>
              <div style={{ fontSize: 18 }}><b>{p.recipient_name || 'No name'}</b></div>
              <div style={{ fontSize: 18, wordBreak: 'break-all' }}><b>{p.recipient_email}</b></div>
              <div className="care-muted">Attachment: {p.filename} (approved version {p.version}, fingerprint {String(p.pdf_sha256).slice(0, 12)}) · approved by {p.approved_by}</div>
              {!p.allowed.ok && <div className="care-err" style={{ marginTop: 8 }}>{p.allowed.reason}</div>}
            </div>
            <Field label="Subject" id="s-sub"><input id="s-sub" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Field label="Message" id="s-msg"><textarea id="s-msg" value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 140 }} /></Field>
            <Field label={`Type the recipient address to confirm (${p.recipient_email})`} id="s-conf"><input id="s-conf" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" /></Field>
            <div className="care-row">
              <Action tone="primary" disabled={confirmEmail.trim().toLowerCase() !== String(p.recipient_email).toLowerCase() || !p.allowed.ok} label="Send Report" run={() => careApi(`cycles/${cycle.id}/send`, { method: 'POST', json: { approval_id: p.approval_id, confirm_email: confirmEmail, subject, message } })} done={reload} />
              <a className="care-btn" href={`/api/care/admin/cycles/${cycle.id}/pdf?version=${p.version}&download=1`}>Download without sending</a>
            </div>
          </div>
        )
      )}
      {report.status === 'sent' && <p className="care-okmsg" style={{ marginTop: 10 }}>Sent. The email provider accepted it; that confirms hand off, not inbox delivery.</p>}
      {sends.length > 0 && (
        <div className="care-scroll" style={{ marginTop: 12 }}><table className="care-table">
          <thead><tr><th>When</th><th>To</th><th>Version</th><th>Result</th></tr></thead>
          <tbody>{sends.map((s: Row) => {
            const v = data.approvals.find((a: Row) => a.id === s.approval_id)?.version
            return (
              <tr key={s.id}>
                <td>{fmt(s.created_at, tz)}</td><td style={{ wordBreak: 'break-all' }}>{s.recipient_email}</td><td>v{v}</td>
                <td>{s.status === 'accepted' ? <Badge tone="ok">Accepted by email provider</Badge> : s.status === 'failed' ? <><Badge tone="bad">Failed</Badge> <span className="care-muted">{s.error}</span></> : <Badge tone="warn">Sending, result unknown</Badge>}<div className="care-muted" style={{ fontSize: 12 }}>{s.status === 'accepted' ? `Delivery not confirmed${s.provider_message_id ? ` · id ${s.provider_message_id}` : ''}` : ''}</div></td>
              </tr>
            )
          })}</tbody>
        </table></div>
      )}
      {sends.some((s: Row) => s.status === 'failed') && report.status === 'approved' && <p className="care-muted" style={{ marginTop: 6 }}>A failed send keeps the approved report. Fix the cause and send again; the checks don’t need to run again.</p>}
    </section>
  )
}

function DuePanel({ data, reload }: { data: Row; reload: () => void }) {
  const { cycle } = data
  const [d, setD] = useState('')
  if (cycle.completed_at) return null
  return (
    <section className="care-panel">
      <h2 style={{ marginBottom: 6 }}>Due date</h2>
      <p className="care-muted" style={{ marginBottom: 10 }}>Moving the deadline updates the same calendar item and resets overdue reminders.</p>
      <div className="care-row" style={{ alignItems: 'flex-end' }}>
        <Field label="New due date" id="due-d"><input id="due-d" type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <Action label="Change due date" disabled={!d} run={() => careApi(`cycles/${cycle.id}/due`, { method: 'PUT', json: { date: d } })} done={reload} />
      </div>
    </section>
  )
}
