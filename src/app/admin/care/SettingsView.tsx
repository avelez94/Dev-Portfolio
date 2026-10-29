'use client'
import { useEffect, useState } from 'react'
import { useLoad, careApi, Badge, Field, Loading, ErrorBox, Action } from './ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SettingsView() {
  const { data, error, reload, setData } = useLoad<Row>('settings')
  const [f, setF] = useState<Row | null>(null)
  const [feed, setFeed] = useState<string | null>(null)
  const [policyNote, setPolicyNote] = useState('')
  const [policyOk, setPolicyOk] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (data) setF({ ...data, work_start: String(data.work_start).slice(0, 5), work_end: String(data.work_end).slice(0, 5) }) }, [data]) // eslint-disable-line react-hooks/set-state-in-effect
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data || !f) return <div className="care-panel"><Loading lines={6} /></div>
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v })
  const save = (keys: string[]) => careApi<Row>('settings', { method: 'PUT', json: Object.fromEntries(keys.map((k) => [k, f[k] === '' ? null : f[k]])) })

  return (
    <>
      {msg && <div className="care-okmsg" role="status">{msg}</div>}
      <section className="care-panel" aria-labelledby="sch-h">
        <h2 id="sch-h">Scheduling and reminders</h2>
        <p className="care-muted" style={{ margin: '4px 0 12px' }}>Used for new review cycles. Each review is due a set number of days after its payment, so clients spread out by their subscription anniversary.</p>
        <div className="care-grid">
          <div className="care-two">
            <Field label="Your time zone" id="s-tz"><input id="s-tz" value={f.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="America/New_York" /></Field>
            <Field label="Send owner emails to" id="s-ne" hint="Empty uses the studio address."><input id="s-ne" type="email" value={f.notify_email || ''} onChange={(e) => set('notify_email', e.target.value)} /></Field>
          </div>
          <fieldset className="care-sub" style={{ border: '1px solid var(--border)' }}>
            <legend className="care-label">Working days</legend>
            <div className="care-row">{DAYS.map((d, i) => (
              <label key={d} className="care-row" style={{ gap: 4 }}><input type="checkbox" checked={f.working_days.includes(i + 1)} onChange={(e) => set('working_days', e.target.checked ? [...f.working_days, i + 1] : f.working_days.filter((x: number) => x !== i + 1))} />{d}</label>
            ))}</div>
          </fieldset>
          <div className="care-two">
            <Field label="Workday starts" id="s-ws"><input id="s-ws" type="time" value={f.work_start} onChange={(e) => set('work_start', e.target.value)} /></Field>
            <Field label="Workday ends (deadlines land here)" id="s-we"><input id="s-we" type="time" value={f.work_end} onChange={(e) => set('work_end', e.target.value)} /></Field>
          </div>
          <div className="care-two">
            <Field label="Review deadline (days after payment)" id="s-rw"><input id="s-rw" inputMode="numeric" value={f.review_window_days} onChange={(e) => set('review_window_days', e.target.value)} /></Field>
            <Field label="Start reminder (working days before deadline)" id="s-ld"><input id="s-ld" inputMode="numeric" value={f.lead_days} onChange={(e) => set('lead_days', e.target.value)} /></Field>
          </div>
          <div className="care-two">
            <Field label="Typical review length (minutes)" id="s-rm" hint="Shown for planning only; no time is blocked."><input id="s-rm" inputMode="numeric" value={f.review_minutes} onChange={(e) => set('review_minutes', e.target.value)} /></Field>
            <label className="care-row" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!f.start_reminder} onChange={(e) => set('start_reminder', e.target.checked)} /> Email and calendar reminder when it’s time to start</label>
          </div>
          <div className="care-two">
            <Field label="Overdue reminder every (hours)" id="s-oh"><input id="s-oh" inputMode="numeric" value={f.overdue_reminder_hours} onChange={(e) => set('overdue_reminder_hours', e.target.value)} /></Field>
            <Field label="At most this many overdue reminders" id="s-om"><input id="s-om" inputMode="numeric" value={f.overdue_reminder_max} onChange={(e) => set('overdue_reminder_max', e.target.value)} /></Field>
          </div>
          <div><Action tone="primary" label="Save scheduling" run={() => save(['timezone', 'notify_email', 'working_days', 'work_start', 'work_end', 'review_window_days', 'lead_days', 'review_minutes', 'start_reminder', 'overdue_reminder_hours', 'overdue_reminder_max'])} done={(r) => { setData(r as Row); setMsg('Scheduling saved.') }} /></div>
        </div>
      </section>

      <section className="care-panel" aria-labelledby="cal-h">
        <h2 id="cal-h">Calendar</h2>
        <p className="care-muted" style={{ margin: '4px 0 12px' }}>
          No personal calendar provider is connected, and the discovery call booking calendar is never used for this. Reviews live in the dashboard queue and reminder emails. For your own calendar, subscribe to a private feed: each review shows as an all day item on its due date (plus a start reminder), updates in place when dates change, never blocks time, and never invites anyone. To have work blocks placed in free time, a calendar connection (for example Google Calendar) would be needed.
        </p>
        <div className="care-row">
          <Badge tone={data.calendar_feed ? 'ok' : 'info'}>{data.calendar_feed ? 'Private feed is on' : 'No feed yet'}</Badge>
          <Action label={data.calendar_feed ? 'Create a new feed link (turns off the old one)' : 'Create private feed link'} confirmText={data.calendar_feed ? 'Yes, replace the link' : undefined} run={() => careApi<Row>('settings/calendar-token', { method: 'POST', json: {} })} done={(r) => { setFeed((r as Row).url); reload() }} />
        </div>
        {feed && <div className="care-sub" style={{ marginTop: 10 }}><div className="care-label">Your private feed link (shown once)</div><input readOnly value={feed} onFocus={(e) => e.target.select()} aria-label="Calendar feed link" /><small className="care-muted">In Google Calendar: Other calendars, From URL. In Apple Calendar: File, New Calendar Subscription. Keep this link private.</small></div>}
      </section>

      <section className="care-panel" aria-labelledby="pol-h">
        <div className="care-between"><h2 id="pol-h">Billing policy (proposed)</h2><Badge tone={data.policy_approved_at ? 'ok' : 'warn'}>{data.policy_approved_at ? `Approved ${new Date(data.policy_approved_at).toLocaleDateString()}` : 'Needs your approval before production'}</Badge></div>
        <p className="care-muted" style={{ margin: '4px 0 12px' }}>These decide how the dashboard reacts. None of them charge, refund, cancel, or pause anything in Stripe. Changing one clears an earlier approval.</p>
        <div className="care-grid">
          <div className="care-two">
            <Field label="Flag billing attention after this many failed payments" id="p-af"><input id="p-af" inputMode="numeric" value={f.billing_attention_after_failures} onChange={(e) => set('billing_attention_after_failures', e.target.value)} /></Field>
            <Field label="Grace period after a failed payment (days)" id="p-g" hint="Empty means not decided yet. Reviews only ever start for paid periods."><input id="p-g" inputMode="numeric" value={f.grace_days ?? ''} onChange={(e) => set('grace_days', e.target.value)} /></Field>
          </div>
          <div className="care-two">
            <Field label="When a payment is refunded" id="p-r"><select id="p-r" value={f.refund_handling} onChange={(e) => set('refund_handling', e.target.value)}><option value="flag_for_review">Flag the review for me to decide</option></select></Field>
            <Field label="When a payment is disputed" id="p-d"><select id="p-d" value={f.dispute_handling} onChange={(e) => set('dispute_handling', e.target.value)}><option value="flag_for_review">Flag the review for me to decide</option></select></Field>
          </div>
          <Field label="When a subscription is canceled immediately" id="p-c"><select id="p-c" value={f.immediate_cancel_handling} onChange={(e) => set('immediate_cancel_handling', e.target.value)}><option value="keep_paid_cycles">Keep the open review and flag it for me to decide</option></select></Field>
          <p className="care-muted">Not set by this system: proration, refunds, trials, and cancellation terms. Those stay in Stripe’s settings and your care agreement. Cancel at period end always honors the paid period.</p>
          <div><Action label="Save policy settings" run={() => save(['billing_attention_after_failures', 'grace_days', 'refund_handling', 'dispute_handling', 'immediate_cancel_handling'])} done={(r) => { setData(r as Row); setMsg('Policy settings saved. They need approval again.') }} /></div>
          {!data.policy_approved_at && (
            <div className="care-sub">
              <label className="care-row"><input type="checkbox" checked={policyOk} onChange={(e) => setPolicyOk(e.target.checked)} /> I approve these billing policies for production.</label>
              <Field label="Where the policy is written down" id="p-n"><input id="p-n" value={policyNote} onChange={(e) => setPolicyNote(e.target.value)} placeholder="Care agreement v1, section 4" /></Field>
              <div style={{ marginTop: 8 }}><Action tone="primary" disabled={!policyOk} label="Record approval" run={() => careApi<Row>('settings/approve-policy', { method: 'POST', json: { confirm: policyOk, note: policyNote } })} done={(r) => { setData(r as Row); setMsg('Approval recorded.') }} /></div>
            </div>
          )}
          {data.policy_approved_note && <p className="care-muted">Approval note: {data.policy_approved_note}</p>}
        </div>
      </section>
    </>
  )
}
