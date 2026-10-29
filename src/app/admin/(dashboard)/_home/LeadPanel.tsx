'use client'
/** Details panel for a booked discovery call or a lead that hasn't booked yet. */
import { ADMIN_INK } from '@/lib/admin-theme'
import { useTheme } from '../_components/theme'
import { countdown, fmtDate, fmtRelative, fmtTime } from '../_lib/format'
import { detailFields, leadSteps } from '../_lib/leads'
import type { Booking, Submission } from '../_lib/types'

function LeadProgress({ s, booked }: { s: Submission | null | undefined; booked: boolean }) {
  const { d } = useTheme()
  return (
    <ol aria-label="Lead progress" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
      {leadSteps(s, booked).map((step) => (
        <li key={step.label} style={{ fontSize: 12, letterSpacing: '0.04em', padding: '3px 8px', borderRadius: 999, background: step.done ? d.accent : d.white, color: step.done ? ADMIN_INK : d.text3, border: '1px solid ' + (step.done ? d.accent : d.border) }}>
          {step.done ? '✓ ' : ''}{step.label}{!step.done && step.optional ? ' (skipped)' : ''}
        </li>
      ))}
    </ol>
  )
}

function Fields({ s }: { s: Submission | null | undefined }) {
  const { d } = useTheme()
  const rows = [
    { label: 'Project', val: s?.project_type },
    { label: 'Description', val: s?.description },
    { label: 'Budget', val: s?.budget || 'Not provided' },
    { label: 'Timeline', val: s?.timeline || 'Not provided' },
    ...(s?.priority ? [{ label: 'Priority', val: s.priority }] : []),
    ...(s?.notes ? [{ label: 'Notes', val: s.notes }] : []),
    { label: 'Found via', val: s?.heard_from },
    ...detailFields(s),
  ]
  return (
    <div className="rp-fields">
      {rows.map((f, i) => <div key={i}><div className="rf-label">{f.label}</div><div className="rf-val" style={{ color: d.text }}>{f.val}</div></div>)}
    </div>
  )
}

export function BookingPanel({ b, onAddToPipeline }: { b: Booking; onAddToPipeline: () => void }) {
  const { d } = useTheme()
  const s = b.intake_submissions
  return (
    <>
      <div className="rp-card" style={{ background: d.sand }}>
        <div className="rp-eyebrow">Discovery Call</div>
        <div className="rp-name" style={{ color: d.text }}>{s?.name}</div>
        <div className="rp-meta" style={{ color: d.text2 }}>{s?.email}</div>
        {s?.business && <div className="rp-meta" style={{ color: d.text2 }}>{s.business}</div>}
        <div className="rp-time-badge" style={{ background: d.white }}>
          <div>
            <div style={{ fontSize: 12, color: d.text }}>{fmtDate(b.scheduled_at)}</div>
            <div style={{ fontSize: 12, color: d.text2, marginTop: 1 }}>{fmtTime(b.scheduled_at)}</div>
          </div>
          <div className="rtb-cd">{countdown(b.scheduled_at)}</div>
        </div>
        <LeadProgress s={s} booked />
      </div>
      <Fields s={s} />
      <div className="rp-actions">
        {b.zoom_host_url && <a href={b.zoom_host_url} target="_blank" rel="noreferrer" className="ra-btn fill">Start Zoom Call</a>}
        <button className="ra-btn" style={{ background: d.surface, color: d.text2, border: '1px solid ' + d.border }} onClick={onAddToPipeline}>Add to Pipeline</button>
      </div>
    </>
  )
}

export function SubmissionPanel({ s }: { s: Submission }) {
  const { d } = useTheme()
  return (
    <>
      <div className="rp-card" style={{ background: d.linen }}>
        <div className="rp-eyebrow">{s.stage === 'inquiry' ? 'Short Note, No Details Yet' : 'Details Completed, No Call Yet'}</div>
        <div className="rp-name" style={{ color: d.text }}>{s.name}</div>
        <div className="rp-meta" style={{ color: d.text2 }}>{s.email}</div>
        {s.business && <div className="rp-meta" style={{ color: d.text2 }}>{s.business}</div>}
        <div style={{ marginTop: 10, fontSize: 12, color: d.text3 }}>Submitted {fmtRelative(s.submitted_at)}{s.details_completed_at ? ' · Details ' + fmtRelative(s.details_completed_at) : ''}</div>
        <LeadProgress s={s} booked={false} />
      </div>
      <Fields s={s} />
    </>
  )
}

export function NothingSelected() {
  const { d } = useTheme()
  return (
    <div className="rp-empty">
      <div className="rp-empty-icon">✦</div>
      <div className="rp-empty-text" style={{ color: d.text3 }}>Select a call or submission<br />to see the details here</div>
    </div>
  )
}
