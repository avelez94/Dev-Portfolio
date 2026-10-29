'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLoad, careApi, Badge, BillingBadge, Field, Loading, ErrorBox, Empty, Action, fmt, workStatus, STATUS_TEXT, statusTone } from './ui'
import ReportView from '@/components/care/ReportView'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Go = (n: { view?: 'sites'; site?: string | null; cycle?: string | null }) => void

const CHECK_TEXT: Record<string, string> = {
  page_load: 'Pages open', redirects: 'Redirects', https: 'Secure connection', images: 'Images', overflow: 'Screen fit', screenshot: 'Screenshots',
  internal_links: 'Links within the site', destination: 'Destinations', scan: 'Automated check',
}
const FIELDS: [string, string, string][] = [
  ['summary', 'Client summary (required)', 'Two or three sentences. Don’t say everything is fine while issues or unverified items remain.'],
  ['fixes', 'What I fixed', 'Only fixes you made and confirmed.'],
  ['investigated', 'What I looked into', ''],
  ['outstanding', 'Still open', 'Anything unresolved that isn’t already an issue above.'],
  ['proposed_work', 'Additional work needing approval', 'Outside the plan. Nothing starts until the client approves.'],
  ['estimate', 'Estimate (optional)', 'For example: about 2 hours, $200'],
  ['extra_work_reason', 'Why this is extra work (required when asking for approval)', 'Why it’s outside the included care scope, and whether any remaining included time applies. Use your agreed plan terms.'],
  ['next_steps', 'Anything else for next month', ''],
  ['client_notes', 'Note for the client', ''],
]
const RESOLUTIONS: [string, string][] = [
  ['', 'Choose what happens next'],
  ['fixed', 'Fixed (verify with a recheck or a note)'],
  ['client_input', 'Needs client input'],
  ['approval', 'Needs approval for more work'],
  ['investigating', 'I’m looking into it'],
  ['not_an_issue', 'Not an issue (hide from the report)'],
]

/** Collapsible section with a heading and counts in the summary row. */
function Section({ id, title, counts, open, children }: { id: string; title: string; counts?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="care-sect" open={open} id={id}>
      <summary><h2>{title}</h2><span className="care-row" style={{ gap: 6 }}>{counts}</span></summary>
      <div className="care-sect-body">{children}</div>
    </details>
  )
}

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
  const sentOk = data.sends.find((s: Row) => s.status === 'accepted')
  const sc = data.statusCounts as Record<string, number>
  const issueGroups = (data.groups as Row[]).filter((g) => g.severity === 'issue')
  const unverifiedGroups = (data.groups as Row[]).filter((g) => g.severity === 'unverified')
  const manualDone = data.manual.filter((m: Row) => m.status).length
  return (
    <>
      <button className="care-btn small" onClick={() => go({ site: site.id })} style={{ marginBottom: 12 }}>← {site.label}</button>
      <div className="care-who" aria-label="Active review">
        <div className="care-between">
          <div>
            <div className="care-label">Monthly review for</div>
            <h2>{client?.business || client?.name || 'Unknown client'}</h2>
            <div>{site.label} · <a href={site.site_url} target="_blank" rel="noreferrer noopener">{site.site_url}</a></div>
            <div className="care-muted">Report goes to {site.recipient_name || 'no name'} &lt;<b style={{ color: 'var(--text)' }}>{site.recipient_email || 'no email set'}</b>&gt;</div>
            <div className="care-muted">Service period {fmt(cycle.period_start, tz, false)} to {fmt(cycle.period_end, tz, false)} · {data.plan.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Badge tone={tone}>{work}</Badge>
            <div className="care-muted" style={{ marginTop: 4 }}>{new Date(cycle.review_due_at) < new Date() && !cycle.completed_at ? <Badge tone="bad">Overdue</Badge> : 'Due'} {fmt(cycle.review_due_at, tz)}</div>
            {sentOk && <div className="care-muted">Sent {fmt(sentOk.finished_at, tz)}</div>}
          </div>
        </div>
        <div className="care-steps">
          <div className="care-step"><span>Billing</span>{cycle.billing_flag ? <Badge tone="bad">{cycle.billing_flag.replace(/_/g, ' ')}</Badge> : cycle.source === 'manual' ? <Badge>Billed outside Stripe</Badge> : <Badge tone="ok">Period paid</Badge>} <BillingBadge state={site.billing_state} /></div>
          <div className="care-step"><span>Automated check</span><Badge tone={cycle.scan_state === 'done' ? 'ok' : cycle.scan_state === 'failed' ? 'bad' : cycle.scan_state === 'partial' ? 'warn' : 'info'}>{cycle.scan_state.replace(/_/g, ' ')}</Badge></div>
          <div className="care-step"><span>Manual review</span><Badge tone={cycle.manual_state === 'done' ? 'ok' : 'warn'}>{manualDone} of {data.manual.length} recorded</Badge></div>
          <div className="care-step"><span>Report</span><Badge tone={report.status === 'sent' ? 'ok' : report.status === 'approved' ? 'coral' : 'info'}>{report.status} v{report.version}</Badge></div>
        </div>
      </div>

      {cycle.hold_reason === 'enrollment' && (
        <div className="care-sub" style={{ marginBottom: 16 }}><b>Waiting for setup confirmation.</b> This period is paid, but no check runs until you confirm the website setup. <button className="care-btn small" onClick={() => go({ site: site.id })}>Confirm setup</button></div>
      )}

      <ScanSummary data={data} reload={reload} />

      {data.latest && (
        <>
          <Section id="sec-issues" title="Issues found" open counts={<><Badge tone={issueGroups.length + data.manualIssues.length ? 'bad' : 'ok'}>{issueGroups.length + data.manualIssues.length} {issueGroups.length + data.manualIssues.length === 1 ? 'issue' : 'issues'}</Badge><span className="care-muted">grouped from {sc.failed || 0} failed automated results{data.manualIssues.length ? ` and ${data.manualIssues.length} hand check` : ''}</span></>}>
            {issueGroups.length === 0 && data.manualIssues.length === 0 ? <Empty>No failed results in the latest check.</Empty> : (
              <div className="care-grid">
                {issueGroups.map((g) => <GroupCard key={g.key} g={g} cycleId={cycle.id} tz={tz} reload={reload} />)}
                {data.manualIssues.map((m: Row) => <GroupCard key={m.key} g={{ key: m.key, title: m.title, severity: 'issue', what: 'Failed when checked by hand.', why: '', pages: [], devices: [], count: 1, note: m.note, items: [] }} cycleId={cycle.id} tz={tz} reload={reload} />)}
              </div>
            )}
          </Section>
          {data.cleared.length > 0 && (
            <Section id="sec-cleared" title="Cleared on recheck" open counts={<Badge tone="ok">{data.cleared.length}</Badge>}>
              <p className="care-muted" style={{ marginBottom: 8 }}>An earlier check this month found these, and the latest check no longer does. Mark one Fixed if you fixed it, and the report shows “Fixed and verified”. Otherwise it simply counts as passing.</p>
              <div className="care-grid">{data.cleared.map((g: Row) => <GroupCard key={g.key} g={g} cycleId={cycle.id} tz={tz} reload={reload} />)}</div>
            </Section>
          )}
          <Section id="sec-unverified" title="Not verified" counts={<><Badge tone={unverifiedGroups.length ? 'warn' : 'ok'}>{unverifiedGroups.length} {unverifiedGroups.length === 1 ? 'group' : 'groups'}</Badge><span className="care-muted">{sc.needs_review || 0} needs review, {sc.could_not_check || 0} could not check</span></>}>
            {unverifiedGroups.length === 0 ? <Empty>Everything the check reached gave a clear result.</Empty> : (
              <div className="care-grid">{unverifiedGroups.map((g) => <GroupCard key={g.key} g={g} cycleId={cycle.id} tz={tz} reload={reload} />)}</div>
            )}
          </Section>
          <Section id="sec-passed" title="Passed" counts={<Badge tone="ok">{sc.passed || 0} results</Badge>}>
            <PassedList findings={data.findings} />
          </Section>
          <Section id="sec-shots" title="Screenshots" counts={<span className="care-muted">{data.findings.filter((f: Row) => f.evidence?.screenshot).length} captured · admin only</span>}>
            <Shots findings={data.findings} />
          </Section>
        </>
      )}

      <Section id="sec-manual" title="Manual checklist" open={manualDone < data.manual.length} counts={<Badge tone={manualDone === data.manual.length ? 'ok' : 'warn'}>{manualDone} of {data.manual.length} recorded</Badge>}>
        <p className="care-muted" style={{ marginBottom: 10 }}>Every item needs a result before approval. Use Not checked with a reason if you couldn’t do it. Only Passed shows as passed in the report.</p>
        {data.manual.length === 0 ? <Empty>No checklist items. Add them in the website settings.</Empty> : (
          <div className="care-grid">{data.manual.map((m: Row) => <ManualItem key={m.id} m={m} cycleId={cycle.id} reload={reload} />)}</div>
        )}
      </Section>

      <Section id="sec-text" title="Report text" open={report.status === 'draft' && !report.content?.summary} counts={<span className="care-muted">version {report.version} · {report.status}</span>}>
        <ReportEditor data={data} reload={reload} />
      </Section>

      <Section id="sec-approve" title="Preview and approve" open={report.status === 'ready' || report.status === 'draft'} counts={<><Badge tone={report.status === 'approved' || report.status === 'sent' ? 'ok' : report.status === 'ready' ? 'coral' : 'info'}>{report.status === 'draft' ? 'Draft' : report.status === 'ready' ? 'Ready for review' : report.status === 'approved' ? 'Approved' : 'Sent'}</Badge>{data.problems.length > 0 && report.status === 'draft' && <Badge tone="warn">{data.problems.length} to do</Badge>}</>}>
        <ApprovePanel data={data} reload={reload} />
      </Section>

      {(report.status === 'approved' || report.status === 'sent' || data.sends.length > 0) && (
        <Section id="sec-send" title="Send" open={report.status === 'approved'} counts={<DeliveryBadge sends={data.sends} />}>
          <SendPanel data={data} reload={reload} />
        </Section>
      )}

      <Section id="sec-more" title="Runs, due date, and history" counts={<span className="care-muted">{data.runs.length} run(s) · {data.notifications.length} email(s) to you</span>}>
        <RunTable data={data} />
        {!cycle.completed_at && <DuePanel data={data} reload={reload} />}
        <div className="care-two" style={{ marginTop: 14 }}>
          <div>
            <div className="care-label">Emails to you</div>
            {data.notifications.length === 0 ? <p className="care-muted">None yet.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>{data.notifications.map((n: Row) => <li key={n.id}>{n.kind.replace(/_/g, ' ')}: <Badge tone={n.status === 'sent' ? 'ok' : n.status === 'failed' ? 'bad' : 'warn'}>{n.status}</Badge> {n.error && <span className="care-muted">{n.error}</span>} {n.status !== 'sent' && <Action small label="Retry" run={() => careApi(`notifications/${n.id}/retry`, { method: 'POST', json: {} })} done={reload} />}</li>)}</ul>
            )}
          </div>
          <div>
            <div className="care-label">History</div>
            <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 260, overflow: 'auto' }}>{data.activity.map((a: Row) => <li key={a.id}><span className="care-muted">{fmt(a.created_at, tz)}</span> {a.action.replace(/_/g, ' ')}</li>)}</ul>
          </div>
        </div>
      </Section>
    </>
  )
}

function DeliveryBadge({ sends }: { sends: Row[] }) {
  const s = sends.find((x) => x.status === 'accepted')
  if (!s) return sends.some((x) => x.status === 'failed') ? <Badge tone="bad">Send failed</Badge> : <span className="care-muted">Not sent</span>
  if (s.delivery_status === 'delivered') return <Badge tone="ok">Delivered</Badge>
  if (s.delivery_status === 'bounced' || s.delivery_status === 'complained') return <Badge tone="bad">Delivery failed ({s.delivery_status})</Badge>
  return <Badge tone="info">Accepted by provider, delivery not confirmed</Badge>
}

function ScanSummary({ data, reload }: { data: Row; reload: () => void }) {
  const { runs, cycle, timezone: tz, site, scope, latest } = data
  const current = runs.find((r: Row) => r.status === 'queued' || r.status === 'running')
  const sc = data.statusCounts as Record<string, number>
  return (
    <section className="care-panel" aria-labelledby="scan-h">
      <div className="care-between">
        <div>
          <h2 id="scan-h">Automated check</h2>
          <p className="care-muted">{latest ? `Last finished ${fmt(latest.finished_at, tz)} (${latest.status === 'partial' ? 'partly finished' : 'finished'})` : 'No completed check yet.'}</p>
        </div>
        {current ? <Action label={current.status === 'queued' ? 'Cancel queued check' : 'Stop check'} run={() => careApi(`cycles/${cycle.id}/cancel-scan`, { method: 'POST', json: {} })} done={reload} />
          : site.enrollment_status === 'confirmed' && <Action label={runs.length ? 'Run the check again' : 'Run check now'} run={() => careApi(`cycles/${cycle.id}/rerun`, { method: 'POST', json: {} })} done={reload} />}
      </div>
      {current && (
        <div className="care-sub" role="status" aria-live="polite" style={{ margin: '10px 0' }}>
          <b>{current.status === 'queued' ? 'Queued' : 'Running'}</b> (attempt {current.attempts || 1} of {current.max_attempts}) {current.progress?.total ? `· ${current.progress.done} of ${current.progress.total} · ${current.progress.step}` : current.status === 'queued' ? `· waiting for the runner (from ${fmt(current.available_at, tz)})` : ''}
          {current.cancel_requested && <div className="care-muted">Stop requested; the runner stops after its current step.</div>}
        </div>
      )}
      {latest && (
        <div className="care-cards" style={{ margin: '12px 0 8px' }}>
          <a className="care-card" href="#sec-passed" style={{ textDecoration: 'none', color: 'inherit' }}><span className="care-muted">Passed</span><b style={{ color: 'var(--greenText)' }}>{sc.passed || 0}</b></a>
          <a className="care-card" href="#sec-issues" style={{ textDecoration: 'none', color: 'inherit' }}><span className="care-muted">Failed</span><b style={{ color: sc.failed ? 'var(--redText)' : undefined }}>{sc.failed || 0}</b></a>
          <a className="care-card" href="#sec-unverified" style={{ textDecoration: 'none', color: 'inherit' }}><span className="care-muted">Needs review</span><b style={{ color: sc.needs_review ? 'var(--amberText)' : undefined }}>{sc.needs_review || 0}</b></a>
          <a className="care-card" href="#sec-unverified" style={{ textDecoration: 'none', color: 'inherit' }}><span className="care-muted">Could not check</span><b style={{ color: sc.could_not_check ? 'var(--amberText)' : undefined }}>{sc.could_not_check || 0}</b></a>
        </div>
      )}
      {latest && (
        <details>
          <summary className="care-muted">Checked in this run: {scope.checked.pages.length} page(s), {scope.checked.destinations.length} destination(s)</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, wordBreak: 'break-all' }}>
            {[...scope.checked.pages, ...scope.checked.destinations].map((u: string) => <li key={u}>{u}</li>)}
          </ul>
        </details>
      )}
      {scope?.setupChangedSinceCheck && <p style={{ marginTop: 8, color: 'var(--amberText)' }}>The website setup changed after this check. The report lists only what this check covered; run the check again to include the new pages.</p>}
      {cycle.scan_state === 'failed' && <p style={{ marginTop: 8, color: 'var(--redText)' }}>The check failed, so nothing was confirmed this month. Retry it, or check the site by hand and record it in the checklist.</p>}
      {data.diff && <p className="care-muted" style={{ marginTop: 6 }}>Compared with the earlier check this month: {data.diff.newIssues.length} new, {data.diff.resolved.length} cleared, {data.diff.notSeen.length} not rechecked (not counted as fixed).</p>}
    </section>
  )
}

function GroupCard({ g, cycleId, tz, reload }: { g: Row; cycleId: string; tz: string; reload: () => void }) {
  const n = g.note || {}
  const [s, setS] = useState({ resolution: n.resolution || '', client_note: n.client_note || '', verification_note: n.verification_note || '', internal_note: n.internal_note || '' })
  const dirty = s.resolution !== (n.resolution || '') || s.client_note !== (n.client_note || '') || s.verification_note !== (n.verification_note || '') || s.internal_note !== (n.internal_note || '')
  const red = g.severity === 'issue'
  const cleared = g.severity === 'cleared'
  return (
    <article className={`care-finding ${cleared ? 'passed' : red ? 'failed' : 'needs_review'}`}>
      <div className="care-between">
        <div><b>{g.title}</b> <span className="care-muted">· {g.count} result{g.count === 1 ? '' : 's'}{g.devices?.length ? ` · ${g.devices.join(' and ')}` : ''}</span></div>
        <Badge tone={cleared ? 'ok' : red ? 'bad' : 'warn'}>{cleared ? 'Cleared on recheck' : red ? 'Issue' : 'Not verified'}</Badge>
      </div>
      <p style={{ marginTop: 4 }}>{g.what}{g.evidence ? ` (${g.evidence})` : ''}</p>
      {g.pages?.length > 0 && <p className="care-muted" style={{ wordBreak: 'break-word' }}>Where: {g.pages.join(', ')}</p>}
      <div className="care-two" style={{ marginTop: 8 }}>
        <Field label={red ? 'What happens next (required)' : 'What happens next (optional)'} id={`gr-${g.key}`}>
          <select id={`gr-${g.key}`} value={s.resolution} onChange={(e) => setS({ ...s, resolution: e.target.value })}>
            {RESOLUTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label={s.resolution === 'client_input' ? 'What you need from the client' : s.resolution === 'approval' ? 'The work needing approval' : 'Note for the client (optional)'} id={`gc-${g.key}`}>
          <input id={`gc-${g.key}`} value={s.client_note} onChange={(e) => setS({ ...s, client_note: e.target.value })} />
        </Field>
      </div>
      {s.resolution === 'fixed' && !cleared && (
        <Field label="How you verified the fix" id={`gv-${g.key}`} hint="Required unless a rerun shows it’s gone. Shown to the client as “Verified: …”.">
          <input id={`gv-${g.key}`} value={s.verification_note} onChange={(e) => setS({ ...s, verification_note: e.target.value })} placeholder="Rechecked on desktop and phone after the change" />
        </Field>
      )}
      <div className="care-row" style={{ marginTop: 6, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}><Field label={s.resolution === 'not_an_issue' ? 'Private reason (required)' : 'Private note'} id={`gi-${g.key}`}><input id={`gi-${g.key}`} value={s.internal_note} onChange={(e) => setS({ ...s, internal_note: e.target.value })} placeholder="Only you see this" /></Field></div>
        <Action small tone={dirty ? 'primary' : undefined} disabled={!dirty} label="Save" run={() => careApi(`cycles/${cycleId}/issue`, { method: 'PUT', json: { group_key: g.key, ...s } })} done={reload} />
      </div>
      {g.items?.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="care-muted">Show {g.items.length} individual result{g.items.length === 1 ? '' : 's'}</summary>
          <div className="care-grid" style={{ marginTop: 8 }}>{g.items.map((f: Row) => <RawResult key={f.id} f={f} tz={tz} reload={reload} />)}</div>
        </details>
      )}
    </article>
  )
}

function RawResult({ f, tz, reload }: { f: Row; tz: string; reload: () => void }) {
  const ev = f.evidence || {}
  return (
    <div className="care-sub" style={{ fontSize: 13 }}>
      <div className="care-between"><span><b>{CHECK_TEXT[f.check_key] || f.check_key}</b>{f.viewport ? ` · ${f.viewport}` : ''} {!f.client_visible && <Badge>Hidden from client</Badge>}</span><Badge tone={statusTone(f.status)}>{STATUS_TEXT[f.status]}</Badge></div>
      {f.url && <div className="care-muted" style={{ wordBreak: 'break-all' }}>{f.url}</div>}
      <div>Observed: {f.observed}</div>
      {f.possible_cause && <div>Possible cause (not confirmed): {f.possible_cause}</div>}
      <div className="care-muted">Checked {fmt(f.checked_at, tz)}{ev.http_status ? ` · HTTP ${ev.http_status}` : ''}{ev.error_code ? ` · ${ev.error_code}` : ''}{ev.found_on ? ` · found on ${ev.found_on}` : ''}{ev.redirect_chain?.length ? ` · via ${ev.redirect_chain.join(' → ')}` : ''}</div>
      <div className="care-row" style={{ marginTop: 4 }}>
        {ev.screenshot && <a href={`/api/care/admin/evidence?path=${encodeURIComponent(ev.screenshot)}`} target="_blank" rel="noreferrer">Screenshot</a>}
        <Action small label={f.client_visible ? 'Leave out of client report' : 'Include in client report'} run={() => careApi(`findings/${f.id}`, { method: 'PUT', json: { client_visible: !f.client_visible } })} done={reload} />
      </div>
    </div>
  )
}

function PassedList({ findings }: { findings: Row[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const f of findings) if (f.status === 'passed' && f.check_key !== 'screenshot') m.set(f.check_key, [...(m.get(f.check_key) || []), f])
    return [...m.entries()]
  }, [findings])
  if (!groups.length) return <Empty>No passed results.</Empty>
  return (
    <div className="care-grid">
      {groups.map(([k, fs]) => (
        <details key={k} className="care-sub">
          <summary><b>{CHECK_TEXT[k] || k}</b> <span className="care-muted">· {fs.length} passed</span></summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>{fs.map((f) => <li key={f.id} style={{ wordBreak: 'break-word' }}>{f.url}{f.viewport ? ` (${f.viewport})` : ''}: {f.observed}</li>)}</ul>
        </details>
      ))}
    </div>
  )
}

function Shots({ findings }: { findings: Row[] }) {
  const shots = findings.filter((f) => f.evidence?.screenshot)
  if (!shots.length) return <Empty>No screenshots in this check.</Empty>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
      {shots.map((f) => (
        <a key={f.id} href={`/api/care/admin/evidence?path=${encodeURIComponent(f.evidence.screenshot)}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text2)', fontSize: 12, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="care-shot" loading="lazy" src={`/api/care/admin/evidence?path=${encodeURIComponent(f.evidence.screenshot)}`} alt={`${f.viewport} screenshot of ${f.url}`} style={{ aspectRatio: f.viewport === 'mobile' ? '390/844' : '1366/900', objectFit: 'cover', objectPosition: 'top', width: '100%', maxHeight: 200 }} />
          <div>{f.viewport} · {f.url}</div>
        </a>
      ))}
    </div>
  )
}

function RunTable({ data }: { data: Row }) {
  const { runs, timezone: tz } = data
  if (!runs.length) return <Empty>No checks have run for this period yet.</Empty>
  return (
    <div className="care-scroll" tabIndex={0}><table className="care-table">
      <thead><tr><th>Started</th><th>Why</th><th>Result</th><th>Results by status</th></tr></thead>
      <tbody>{runs.map((r: Row) => (
        <tr key={r.id}>
          <td>{fmt(r.started_at || r.created_at, tz)}</td>
          <td>{r.trigger === 'rerun' ? 'Rerun' : 'Scheduled'}</td>
          <td><Badge tone={r.status === 'succeeded' ? 'ok' : r.status === 'failed' ? 'bad' : r.status === 'partial' || r.status === 'canceled' ? 'warn' : 'info'}>{r.status}</Badge></td>
          <td className="care-muted">{r.summary?.counts ? ['passed', 'failed', 'needs_review', 'could_not_check', 'not_applicable'].filter((k) => r.summary.counts[k]).map((k) => `${r.summary.counts[k]} ${STATUS_TEXT[k].toLowerCase()}`).join(', ') : ''}{r.error ? ` ${r.error}` : ''}</td>
        </tr>
      ))}</tbody>
    </table></div>
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
    <div>
      {locked && <p className="care-sub" style={{ margin: '0 0 8px' }}>Editing now returns the report to draft{report.status === 'approved' ? ' and clears the approval' : report.status === 'sent' ? ' as a new version; the sent version is kept exactly as sent' : ''}.</p>}
      {msg && <div className="care-okmsg" role="status">{msg}</div>}
      <div className="care-grid">
        <div className="care-two">
          {FIELDS.map(([k, label, hint]) => (
            <Field key={k} label={label} id={`rc-${k}`} hint={hint || undefined}>
              {k === 'estimate' ? <input id={`rc-${k}`} value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} /> : <textarea id={`rc-${k}`} value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} style={{ minHeight: k === 'summary' ? 96 : 70 }} />}
            </Field>
          ))}
        </div>
        <Field label="Private notes (never in the report)" id="rc-int"><textarea id="rc-int" value={internal} onChange={(e) => setInternal(e.target.value)} style={{ borderColor: 'var(--amberText)', minHeight: 60 }} /></Field>
        <div><Action tone="primary" label="Save report text" run={() => careApi(`cycles/${cycle.id}/report`, { method: 'PUT', json: { content: c, internal_notes: internal, base_version: report.version } })} done={() => { setMsg('Saved.'); reload() }} /></div>
      </div>
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
    <div>
      <p className="care-muted" style={{ marginBottom: 10 }}>Draft → Ready for review → Approved → Sent. Unresolved issues can be approved when the report discloses them.</p>
      {problems.length > 0 && report.status === 'draft' && (
        <div className="care-sub" style={{ marginBottom: 12 }}><b>Before this can be marked ready:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{problems.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
      )}
      <div className="care-row">
        {report.status === 'draft' && <Action tone="primary" disabled={problems.length > 0} label="Mark ready for review" run={() => careApi(`cycles/${cycle.id}/ready`, { method: 'POST', json: {} })} done={reload} />}
        {(report.status === 'ready' || report.status === 'approved') && <Action label="Return to draft" run={() => careApi(`cycles/${cycle.id}/draft`, { method: 'POST', json: {} })} done={reload} />}
      </div>
      <details style={{ marginTop: 14 }} open={report.status === 'ready'} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setViewed(true) }}>
        <summary><b>Client report preview (version {report.version})</b></summary>
        <div style={{ marginTop: 10 }}>
          <ReportView s={snapshot} />
          <div className="care-row" style={{ marginTop: 10 }}>
            <a className="care-btn" href={`/api/care/admin/cycles/${cycle.id}/pdf`} target="_blank" rel="noreferrer" onClick={() => setViewed(true)}>Open PDF preview</a>
            <a className="care-btn" href={`/api/care/admin/cycles/${cycle.id}/pdf?download=1`}>Download preview PDF</a>
          </div>
        </div>
      </details>
      {report.status === 'ready' && (
        <div className="care-sub" style={{ marginTop: 14 }}>
          <div className="care-label" style={{ marginBottom: 6 }}>Sign off</div>
          <label className="care-row"><input type="checkbox" checked={signoff} onChange={(e) => setSignoff(e.target.checked)} disabled={!viewed} /> I reviewed the client report and PDF for version {report.version}, and everything it marks passed, fixed, or checked by hand is confirmed.</label>
          {!viewed && <p className="care-muted">Open the preview above or the PDF first.</p>}
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
    </div>
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
    <div>
      <p className="care-muted" style={{ marginBottom: 8 }}>Three separate states: <b>Approved</b> (you signed off), <b>Accepted by the email provider</b> (Resend took the message; this completes the review and its calendar item), and <b>Delivered</b> (only shown when Resend’s signed delivery event arrives). Without that event, delivery stays “not confirmed”.</p>
      {report.status === 'approved' && (
        pv.error ? <ErrorBox error={pv.error} onRetry={pv.reload} /> : !p ? <Loading /> : (
          <div className="care-grid" style={{ marginTop: 10 }}>
            <div className="care-who" style={{ margin: 0 }}>
              <div className="care-label">Sending to</div>
              <div style={{ fontSize: 18 }}><b>{p.recipient_name || 'No name'}</b></div>
              <div style={{ fontSize: 18, wordBreak: 'break-all' }}><b>{p.recipient_email}</b></div>
              <div className="care-muted">Attachment: {p.filename} (approved version {p.version}, fingerprint {String(p.pdf_sha256).slice(0, 12)}) · approved by {p.approved_by}. The email summary comes from the same approved version.</div>
              {!p.allowed.ok && <div className="care-err" style={{ marginTop: 8 }}>{p.allowed.reason}</div>}
            </div>
            <Field label="Subject" id="s-sub"><input id="s-sub" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Field label="Message" id="s-msg"><textarea id="s-msg" value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 120 }} /></Field>
            <Field label={`Type the recipient address to confirm (${p.recipient_email})`} id="s-conf"><input id="s-conf" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" /></Field>
            <div className="care-row">
              <Action tone="primary" disabled={confirmEmail.trim().toLowerCase() !== String(p.recipient_email).toLowerCase() || !p.allowed.ok} label="Send Report" run={() => careApi(`cycles/${cycle.id}/send`, { method: 'POST', json: { approval_id: p.approval_id, confirm_email: confirmEmail, subject, message } })} done={reload} />
              <a className="care-btn" href={`/api/care/admin/cycles/${cycle.id}/pdf?version=${p.version}&download=1`}>Download without sending</a>
            </div>
          </div>
        )
      )}
      {sends.length > 0 && (
        <div className="care-scroll" tabIndex={0} style={{ marginTop: 12 }}><table className="care-table">
          <thead><tr><th>When</th><th>To</th><th>Version</th><th>Provider</th><th>Delivery</th></tr></thead>
          <tbody>{sends.map((s: Row) => {
            const v = data.approvals.find((a: Row) => a.id === s.approval_id)?.version
            return (
              <tr key={s.id}>
                <td>{fmt(s.created_at, tz)}</td><td style={{ wordBreak: 'break-all' }}>{s.recipient_email}</td><td>v{v}</td>
                <td>{s.status === 'accepted' ? <Badge tone="ok">Accepted</Badge> : s.status === 'failed' ? <><Badge tone="bad">Failed</Badge> <span className="care-muted">{s.error}</span></> : <Badge tone="warn">Sending, result unknown</Badge>}</td>
                <td>{s.status !== 'accepted' ? <span className="care-muted">n/a</span> : s.delivery_status === 'delivered' ? <Badge tone="ok">Delivered</Badge> : s.delivery_status === 'bounced' || s.delivery_status === 'complained' ? <Badge tone="bad">{s.delivery_status}</Badge> : s.delivery_status === 'delayed' ? <Badge tone="warn">Delayed</Badge> : <span className="care-muted">Not confirmed</span>}</td>
              </tr>
            )
          })}</tbody>
        </table></div>
      )}
      {sends.some((s: Row) => s.status === 'failed') && report.status === 'approved' && <p className="care-muted" style={{ marginTop: 6 }}>A failed send keeps the approved report. Fix the cause and send again; the checks don’t need to run again.</p>}
    </div>
  )
}

function DuePanel({ data, reload }: { data: Row; reload: () => void }) {
  const { cycle } = data
  const [d, setD] = useState('')
  return (
    <div className="care-row" style={{ alignItems: 'flex-end', marginTop: 12 }}>
      <Field label="Move the due date" id="due-d" hint="Updates the same calendar item and resets overdue reminders."><input id="due-d" type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
      <Action label="Change due date" disabled={!d} run={() => careApi(`cycles/${cycle.id}/due`, { method: 'PUT', json: { date: d } })} done={reload} />
    </div>
  )
}
