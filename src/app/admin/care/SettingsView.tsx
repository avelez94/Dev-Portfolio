'use client'
import { useEffect, useState } from 'react'
import { useLoad, careApi, Badge, Field, Loading, ErrorBox, Action } from './ui'
import { CARE_TERMS_VERSION, CARE_TERMS_PATH, CARE_QUEUED_LINE } from '@/content/care-terms'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const APPROVED: [string, string][] = [
  ['Billing', 'Care plans are billed monthly in advance. Successful payment starts the paid service period.'],
  ['Automatic check', `${CARE_QUEUED_LINE} The verified payment queues and starts the scan; the scheduled tick only recovers missed or failed starts.`],
  ['Refunds', 'Non-refundable after successful payment, except where required by law. Refunds made in Stripe are flagged for you; none are issued automatically.'],
  ['Cancellation', 'Clients cancel future renewals before the next billing date. It takes effect at the end of the paid period; the plan stays available until then. No prorated refund. The Stripe billing portal is set to cancel at period end with no proration.'],
  ['Billing errors', 'Duplicate or incorrect charges are always investigated and corrected; the refund policy never blocks that. Possible duplicates and payments with no linked review are flagged to you.'],
  ['Service not provided', 'Paid periods that can’t be checked (setup not confirmed, paused, ended, or ended early by Stripe) are kept and flagged for your review.'],
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SettingsView() {
  const { data, error, reload, setData } = useLoad<Row>('settings')
  const [f, setF] = useState<Row | null>(null)
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
          <Field label="Keep screenshots for (days)" id="s-ret" hint="Older screenshots are deleted to keep storage small. Reports, approved PDFs, and results are always kept."><input id="s-ret" inputMode="numeric" value={f.evidence_retention_days} onChange={(e) => set('evidence_retention_days', e.target.value)} /></Field>
          <div><Action tone="primary" label="Save scheduling" run={() => save(['timezone', 'notify_email', 'working_days', 'work_start', 'work_end', 'review_window_days', 'lead_days', 'review_minutes', 'start_reminder', 'overdue_reminder_hours', 'overdue_reminder_max', 'evidence_retention_days'])} done={(r) => { setData(r as Row); setMsg('Scheduling saved.') }} /></div>
        </div>
      </section>

      <section className="care-panel" aria-labelledby="cal-h">
        <h2 id="cal-h">Calendar</h2>
        <p className="care-muted" style={{ margin: '4px 0 0' }}>
          Each monthly review appears in your admin Schedule calendar on its due date, marked as a care review, and updates as the work moves along. Care reviews never block discovery call availability, never create Zoom meetings, and never invite anyone.
        </p>
      </section>

      <section className="care-panel" aria-labelledby="apr-h">
        <div className="care-between"><h2 id="apr-h">Billing policy: approved</h2><Badge tone="ok">{data.refund_policy_approved_at ? `Approved ${new Date(data.refund_policy_approved_at).toLocaleDateString()}` : 'Approved'} · terms {CARE_TERMS_VERSION}</Badge></div>
        <p className="care-muted" style={{ margin: '4px 0 12px' }}>Published in the <a href={CARE_TERMS_PATH} target="_blank" rel="noreferrer">care terms</a>, the Website Care FAQ, the checkout invitation and Stripe Checkout. Changing any of these needs a new terms version, so they can’t be edited here.</p>
        <dl className="care-grid" style={{ margin: 0 }}>
          {APPROVED.map(([k, v]) => <div key={k} className="care-sub"><dt className="care-label">{k}</dt><dd style={{ margin: '4px 0 0' }}>{v}</dd></div>)}
        </dl>
      </section>

      <section className="care-panel" aria-labelledby="pol-h">
        <div className="care-between"><h2 id="pol-h">Billing policy: still to decide</h2><Badge tone={data.policy_approved_at ? 'ok' : 'warn'}>{data.policy_approved_at ? `Approved ${new Date(data.policy_approved_at).toLocaleDateString()}` : 'Not approved: live checkout stays off'}</Badge></div>
        <p className="care-muted" style={{ margin: '4px 0 12px' }}>The grace period and dispute handling aren’t approved yet. Until they are, the dashboard only flags these for you; nothing charges, refunds, cancels or pauses anything in Stripe, and live checkout stays off. Changing one clears an earlier approval.</p>
        <div className="care-grid">
          <div className="care-two">
            <Field label="Flag billing attention after this many failed payments" id="p-af"><input id="p-af" inputMode="numeric" value={f.billing_attention_after_failures} onChange={(e) => set('billing_attention_after_failures', e.target.value)} /></Field>
            <Field label="Grace period after a failed payment (days)" id="p-g" hint="Not decided yet. Reviews only ever start for paid periods."><input id="p-g" inputMode="numeric" value={f.grace_days ?? ''} onChange={(e) => set('grace_days', e.target.value)} /></Field>
          </div>
          <div className="care-two">
            <Field label="When a payment is disputed" id="p-d" hint="Not decided yet."><select id="p-d" value={f.dispute_handling} onChange={(e) => set('dispute_handling', e.target.value)}><option value="flag_for_review">Flag the review for me to decide (no automatic response)</option></select></Field>
            <Field label="When Stripe ends a subscription before the paid period ends" id="p-c"><select id="p-c" value={f.immediate_cancel_handling} onChange={(e) => set('immediate_cancel_handling', e.target.value)}><option value="flag_for_review">Keep the open review and flag it for me (nothing is refunded)</option></select></Field>
          </div>
          <div><Action label="Save these settings" run={() => save(['billing_attention_after_failures', 'grace_days', 'dispute_handling', 'immediate_cancel_handling'])} done={(r) => { setData(r as Row); setMsg('Policy settings saved. They need approval again.') }} /></div>
          {!data.policy_approved_at && (
            <div className="care-sub">
              <label className="care-row"><input type="checkbox" checked={policyOk} onChange={(e) => setPolicyOk(e.target.checked)} /> I approve the grace period and dispute handling above for production.</label>
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
