'use client'
import { useCallback, useEffect, useState } from 'react'
import { CARE_CSS, useLoad, Badge, SiteBilling, workStatus, fmt, Loading, ErrorBox, Empty, Action, careApi } from './ui'
import SiteView from './SiteView'
import CycleView from './CycleView'
import SettingsView from './SettingsView'
import TaskCatalog from './TaskCatalog'

type View = 'overview' | 'queue' | 'sites' | 'catalog' | 'settings' | 'activity'
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

type Status = {
  demo?: boolean
  stripe: { mode: string; webhook: boolean; prices: Record<string, boolean> }
  runner: { token: boolean; dispatch: boolean }
  email: { provider: boolean; clientEmailsLive: boolean; allowlist: string[] }
  calendar: { adminCalendar: boolean; resendWebhook: boolean }
  policyApproved: boolean
}

function readUrl() {
  const p = new URLSearchParams(window.location.search)
  return { view: (p.get('view') as View) || null, site: p.get('site'), cycle: p.get('cycle') }
}

export default function CareApp() {
  const [view, setView] = useState<View>('overview')
  const [site, setSite] = useState<string | null>(null)
  const [cycle, setCycle] = useState<string | null>(null)

  useEffect(() => {
    const u = readUrl()
    /* eslint-disable react-hooks/set-state-in-effect */
    if (u.cycle) setCycle(u.cycle)
    else if (u.site) { setSite(u.site); setView('sites') }
    else if (u.view) setView(u.view)
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPop = () => { const x = readUrl(); setCycle(x.cycle); setSite(x.site); setView(x.view || (x.site ? 'sites' : 'overview')) }
    // The shared admin shell shows the sign in prompt when the session ends.
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((next: { view?: View; site?: string | null; cycle?: string | null }) => {
    const v = next.view ?? (next.site ? 'sites' : 'overview')
    setView(v); setSite(next.site ?? null); setCycle(next.cycle ?? null)
    const q = new URLSearchParams()
    if (next.cycle) q.set('cycle', next.cycle)
    else if (next.site) q.set('site', next.site)
    else if (v !== 'overview') q.set('view', v)
    window.history.pushState(null, '', `/admin/care${q.toString() ? '?' + q : ''}`)
    window.scrollTo(0, 0)
  }, [])

  const status = useLoad<Status>('status')

  const nav: [View, string][] = [['overview', 'Overview'], ['queue', 'Review queue'], ['sites', 'Websites'], ['catalog', 'Task catalog'], ['settings', 'Settings'], ['activity', 'Activity']]
  return (
    <div className="care care-frame">
      <style>{CARE_CSS}</style>
      <header className="care-top">
        <div style={{ marginRight: 'auto' }}>
          <div className="care-label">Admin</div>
          <h1 style={{ fontSize: 20 }}>Website Care</h1>
        </div>
        <nav className="care-nav" aria-label="Website Care">
          {nav.map(([v, label]) => (
            <button key={v} aria-current={!cycle && view === v ? 'page' : undefined} onClick={() => go({ view: v })}>{label}</button>
          ))}
          <a href="/admin/care/guide" className="care-help">Help / Owner’s guide</a>
        </nav>
      </header>
      <main id="admin-main" tabIndex={-1} className="care-main">
        {status.data && <EnvBanner s={status.data} />}
        {cycle ? <CycleView id={cycle} go={go} /> :
          view === 'sites' ? <SiteView id={site} go={go} /> :
          view === 'catalog' ? <TaskCatalog /> :
          view === 'settings' ? <SettingsView /> :
          view === 'activity' ? <Activity /> :
          <Overview go={go} queueOnly={view === 'queue'} />}
      </main>
    </div>
  )
}

function EnvBanner({ s }: { s: Status }) {
  const prices = Object.values(s.stripe.prices).filter(Boolean).length
  if (s.demo) {
    return (
      <div className="care-banner" aria-label="Environment">
        <Badge tone="coral">Demo: Stripe, client and admin emails, and the check runner are simulated</Badge>
        <Badge tone="ok">Calendar: admin Schedule</Badge>
        <Badge tone={s.policyApproved ? 'ok' : 'warn'}>Billing policy: {s.policyApproved ? 'approved' : 'proposed, needs approval'}</Badge>
      </div>
    )
  }
  return (
    <div className="care-banner" aria-label="Environment">
      <Badge tone={s.stripe.mode === 'live' ? 'bad' : s.stripe.mode === 'test' ? 'ok' : 'warn'}>Stripe: {s.stripe.mode === 'missing' ? 'not configured' : `${s.stripe.mode} mode`}{s.stripe.mode !== 'missing' && ` (${prices}/3 prices${s.stripe.webhook ? ', webhook set' : ', no webhook secret'})`}</Badge>
      <Badge tone={s.email.clientEmailsLive ? 'bad' : 'ok'}>Client emails: {s.email.clientEmailsLive ? 'LIVE' : `test allowlist only (${s.email.allowlist.length})`}</Badge>
      <Badge tone={s.runner.token ? 'ok' : 'warn'}>Check runner: {s.runner.token ? (s.runner.dispatch ? 'token and dispatch set' : 'token set, scheduled pickup') : 'not configured'}</Badge>
      <Badge tone="ok">Calendar: admin Schedule</Badge>
      <Badge tone={s.calendar.resendWebhook ? 'ok' : 'info'}>Delivery tracking: {s.calendar.resendWebhook ? 'on' : 'off (provider acceptance only)'}</Badge>
      <Badge tone={s.policyApproved ? 'ok' : 'warn'}>Billing policy: {s.policyApproved ? 'approved' : 'proposed, needs approval'}</Badge>
    </div>
  )
}

function Overview({ go, queueOnly }: { go: (n: { view?: View; site?: string | null; cycle?: string | null }) => void; queueOnly: boolean }) {
  const { data, error, loading, reload } = useLoad<Row>('overview')
  const [now] = useState(() => Date.now())
  useEffect(() => {
    const live = data?.activeRuns?.length
    if (!live) return
    const t = setInterval(reload, 10000)
    return () => clearInterval(t)
  }, [data, reload])
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data || loading && !data) return <div className="care-panel"><Loading lines={5} /></div>
  const tz = data.timezone
  const clientOf = (s: Row) => data.clients.find((c: Row) => c.id === s.client_id)
  const siteOf = (id: string) => data.sites.find((s: Row) => s.id === id)
  const reportOf = (id: string) => data.reports.find((r: Row) => r.cycle_id === id)
  const open = data.cycles.filter((c: Row) => !c.completed_at)
  const overdue = open.filter((c: Row) => new Date(c.review_due_at).getTime() < now)
  const week = open.filter((c: Row) => new Date(c.review_due_at).getTime() >= now && new Date(c.review_due_at).getTime() < now + 7 * 86400_000)
  const billing = data.sites.filter((s: Row) => ['attention', 'past_due', 'unpaid', 'refunded', 'disputed'].includes(s.billing_state))
  const problems = data.failedRuns.length + data.failedNotes.length + data.failedEvents.length + data.stuckSends.filter((s: Row) => s.status === 'sending').length
  const name = (s: Row | undefined) => { const c = s && clientOf(s); return c?.business || c?.name || s?.label || 'Unknown' }

  const queue = (
    <section className="care-panel" aria-labelledby="queue-h">
      <div className="care-between"><h2 id="queue-h">Review queue</h2><span className="care-muted">{open.length} open, {overdue.length} overdue</span></div>
      {open.length === 0 ? <Empty>No open reviews. New ones appear when a paid period starts.</Empty> : (
        <div className="care-scroll" tabIndex={0}><table className="care-table">
          <thead><tr><th>Due</th><th>Client and website</th><th>Work</th><th className="care-hide-sm">Billing</th><th className="care-hide-sm">Period</th></tr></thead>
          <tbody>
            {open.map((c: Row) => {
              const s = siteOf(c.site_id)
              const [label, tone] = workStatus(c, reportOf(c.id))
              const late = new Date(c.review_due_at).getTime() < now
              const run = data.activeRuns.find((r: Row) => r.cycle_id === c.id)
              return (
                <tr key={c.id} className="click" onClick={() => go({ cycle: c.id })}>
                  <td>{late ? <Badge tone="bad">Overdue</Badge> : null} <div>{fmt(c.review_due_at, tz)}</div></td>
                  <td><button className="care-btn small" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text)', textAlign: 'left' }} onClick={(e) => { e.stopPropagation(); go({ cycle: c.id }) }}><b>{name(s)}</b></button><div className="care-muted">{s?.label} · {s?.site_url}</div></td>
                  <td><Badge tone={tone}>{label}</Badge>{run?.progress?.total ? <div className="care-muted">{run.progress.done}/{run.progress.total}: {run.progress.step}</div> : null}</td>
                  <td className="care-hide-sm">{c.billing_flag ? <Badge tone="bad">{c.billing_flag.replace(/_/g, ' ')}</Badge> : <span className="care-muted">{c.source === 'manual' ? 'Billed outside Stripe' : 'Paid'}</span>}</td>
                  <td className="care-hide-sm care-muted">{fmt(c.period_start, tz, false)} to {fmt(c.period_end, tz, false)}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      )}
    </section>
  )
  if (queueOnly) return queue

  return (
    <>
      <div className="care-cards">
        <div className="care-card"><span className="care-muted">Enrolled websites</span><b>{data.sites.filter((s: Row) => s.enrollment_status !== 'ended').length}</b></div>
        <div className="care-card"><span className="care-muted">Due in 7 days</span><b>{week.length}</b></div>
        <div className="care-card"><span className="care-muted">Overdue</span><b style={{ color: overdue.length ? 'var(--redText)' : undefined }}>{overdue.length}</b></div>
        <div className="care-card"><span className="care-muted">Billing attention</span><b style={{ color: billing.length ? 'var(--amberText)' : undefined }}>{billing.length}</b></div>
        <div className="care-card"><span className="care-muted">Failed jobs</span><b style={{ color: problems ? 'var(--redText)' : undefined }}>{problems}</b></div>
      </div>
      {!data.policyApproved && (
        <div className="care-sub" style={{ marginBottom: 16 }}>
          <b>Billing policies are still proposals.</b> Grace period, refund, dispute, and cancellation handling need your approval before production. <button className="care-btn small" onClick={() => go({ view: 'settings' })}>Review in settings</button>
        </div>
      )}
      {(data.workFlags?.unfinished?.length > 0 || data.workFlags?.termsReview?.length > 0) && (
        <section className="care-panel" aria-labelledby="flags-h">
          <h2 id="flags-h" style={{ marginBottom: 10 }}>Plan time: for your review</h2>
          <div className="care-grid">
            {data.workFlags.unfinished.map((e: Row) => (
              <div key={e.id} className="care-sub care-between">
                <div><Badge tone="warn">Unfinished approved work</Badge> <b>{name(siteOf(e.site_id))}</b>: {e.title}<div className="care-muted">{e.reserved_minutes} minutes reserved. The billing period {new Date(e.care_cycles.period_end).getTime() < now ? 'has ended' : 'ends'} {fmt(e.care_cycles.period_end, tz, false)}; reserved minutes never carry into the next period.</div></div>
                <button className="care-btn small" onClick={() => go({ cycle: e.cycle_id })}>Review</button>
              </div>
            ))}
            {data.workFlags.termsReview.map((s: Row) => (
              <div key={s.id} className="care-sub care-between">
                <div><Badge tone="warn">Agreement predates flexible plan time</Badge> <b>{name(s)}</b><div className="care-muted">{s.care_terms_version ? `On ${s.care_terms_version}.` : 'No terms version on file.'} Review before recording work or estimates for this client.</div></div>
                <button className="care-btn small" onClick={() => go({ site: s.id })}>Review</button>
              </div>
            ))}
          </div>
        </section>
      )}
      {problems > 0 && (
        <section className="care-panel" aria-labelledby="att-h">
          <h2 id="att-h" style={{ marginBottom: 10 }}>Needs your attention</h2>
          <div className="care-grid">
            {data.failedRuns.map((r: Row) => (
              <div key={r.id} className="care-sub care-between">
                <div><Badge tone="bad">Check failed</Badge> <b>{name(siteOf(r.site_id))}</b><div className="care-muted">{r.error} · {r.attempts} attempt(s) · {fmt(r.finished_at, tz)}</div></div>
                <button className="care-btn small" onClick={() => go({ cycle: r.cycle_id })}>Open review</button>
              </div>
            ))}
            {data.failedNotes.map((n: Row) => (
              <div key={n.id} className="care-sub care-between">
                <div><Badge tone={n.status === 'failed' ? 'bad' : 'warn'}>Email {n.status === 'failed' ? 'failed' : 'retrying'}</Badge> {n.kind.replace(/_/g, ' ')}<div className="care-muted">{n.error} · {n.attempts} attempt(s)</div></div>
                <Action small label="Retry now" run={() => careApi(`notifications/${n.id}/retry`, { method: 'POST', json: {} })} done={reload} />
              </div>
            ))}
            {data.failedEvents.map((e: Row) => (
              <div key={e.id} className="care-sub"><Badge tone="bad">Stripe event failed</Badge> {e.type} <span className="care-muted">{e.error} · Stripe retries automatically; you can also resend it from the Stripe dashboard.</span></div>
            ))}
            {data.stuckSends.filter((s: Row) => s.status === 'sending').map((s: Row) => (
              <div key={s.id} className="care-sub care-between">
                <div><Badge tone="warn">Send not confirmed</Badge> {s.recipient_email}<div className="care-muted">Started {fmt(s.created_at, tz)}. Check the email provider log before marking it not sent.</div></div>
                <Action small label="Mark not sent" confirmText="Yes, I checked: mark not sent" run={() => careApi(`sends/${s.id}/mark-failed`, { method: 'POST', json: {} })} done={reload} />
              </div>
            ))}
          </div>
        </section>
      )}
      {queue}
      <section className="care-panel" aria-labelledby="sites-h">
        <div className="care-between"><h2 id="sites-h">Websites</h2><button className="care-btn primary" onClick={() => go({ view: 'sites', site: 'new' })}>Enroll a website</button></div>
        <SitesTable data={data} go={go} />
      </section>
    </>
  )
}

export function SitesTable({ data, go }: { data: Row; go: (n: { site?: string | null; cycle?: string | null }) => void }) {
  const tz = data.timezone
  if (!data.sites.length) return <Empty>No websites enrolled yet. Choose Enroll a website to add the first one.</Empty>
  return (
    <div className="care-scroll" tabIndex={0}><table className="care-table">
      <thead><tr><th>Client and website</th><th>Plan</th><th>Billing</th><th>Setup</th><th className="care-hide-sm">Next review due</th><th className="care-hide-sm">Last sent report</th></tr></thead>
      <tbody>
        {data.sites.map((s: Row) => {
          const c = data.clients.find((x: Row) => x.id === s.client_id)
          // The earliest open review, the same one the review queue lists (the stored date goes stale once a report is sent).
          const mine = (data.cycles as Row[]).filter((y) => y.site_id === s.id)
          const next = mine.filter((y) => !y.completed_at).sort((a, b) => String(a.review_due_at).localeCompare(String(b.review_due_at)))[0]
          return (
            <tr key={s.id} className="click" onClick={() => go({ site: s.id })}>
              <td><button className="care-btn small" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text)', textAlign: 'left', minHeight: 0 }} onClick={(e) => { e.stopPropagation(); go({ site: s.id }) }}><b>{c?.business || c?.name || 'Unknown client'}</b></button><div className="care-muted">{s.label} · {s.site_url}</div></td>
              <td style={{ textTransform: 'capitalize' }}>{s.plan}</td>
              <td><SiteBilling site={s} manual={mine.some((y) => y.source === 'manual')} />{s.paid_through && <div className="care-muted">Paid through {fmt(s.paid_through, tz, false)}</div>}</td>
              <td><Badge tone={s.enrollment_status === 'confirmed' ? 'ok' : s.enrollment_status === 'draft' ? 'warn' : 'info'}>{s.enrollment_status === 'confirmed' ? 'Confirmed' : s.enrollment_status === 'draft' ? 'Needs confirmation' : s.enrollment_status === 'ended' ? 'Care ended' : 'Paused'}</Badge></td>
              <td className="care-hide-sm">{next ? fmt(next.review_due_at, tz) : <span className="care-muted">{s.enrollment_status === 'draft' ? 'After setup and first payment' : 'Waits for the next paid period'}</span>}</td>
              <td className="care-hide-sm">{s.last_completed_review_at ? fmt(s.last_completed_review_at, tz, false) : <span className="care-muted">None yet</span>}</td>
            </tr>
          )
        })}
      </tbody>
    </table></div>
  )
}

function Activity() {
  const { data, error, reload } = useLoad<{ activity: Row[] }>('activity')
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <div className="care-panel"><Loading /></div>
  return (
    <section className="care-panel">
      <h2 style={{ marginBottom: 10 }}>Activity</h2>
      {data.activity.length === 0 ? <Empty>Nothing yet.</Empty> : (
        <div className="care-scroll" tabIndex={0}><table className="care-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead><tbody>
          {data.activity.map((a) => (
            <tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.actor}</td><td>{a.action.replace(/_/g, ' ')}</td><td className="care-muted" style={{ fontSize: 12, wordBreak: 'break-word' }}>{JSON.stringify(a.detail)}</td></tr>
          ))}
        </tbody></table></div>
      )}
    </section>
  )
}
