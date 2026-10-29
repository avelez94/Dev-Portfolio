'use client'
/**
 * The payment schedule for a new proposal or contract: the 50% deposit
 * (calculated) and the milestones you define for the remaining 50%. Each
 * milestone has a name, its deliverable or payment trigger, an amount, and an
 * optional target date. Nothing is split for you; the running total shows
 * what is still to assign.
 */
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { PROJECT_PAYMENT_POLICY } from '@/lib/terms'
import { checkSchedule, fromCents, money, toCents } from '@/lib/payment-schedule'
import { useTheme } from '../../_components/theme'
import { blankMilestone, type MilestoneDraft } from '../../_lib/documents'

export default function MilestoneEditor({ total, milestones, onChange, idPrefix }: { total: number | string; milestones: MilestoneDraft[]; onChange: (v: MilestoneDraft[]) => void; idPrefix: string }) {
  const { d, inputStyle } = useTheme()
  const check = checkSchedule(total, milestones)
  const s = check.schedule
  const assigned = milestones.reduce((sum, m) => sum + (Number.isFinite(toCents(m.fee)) ? toCents(m.fee) : 0), 0)
  const left = Math.round(s.balance * 100) - assigned
  const set = (i: number, patch: Partial<MilestoneDraft>) => onChange(milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const small = { display: 'block' as const, fontSize: 12, color: d.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }
  return (
    <div data-testid={`${idPrefix}-schedule`}>
      <div style={{ fontSize: 12, color: d.text3, marginBottom: 10, lineHeight: 1.6 }}>{PROJECT_PAYMENT_POLICY} You choose each milestone’s amount and what triggers its invoice.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 12 }}>
        {[['Project total', money(s.total)], ['Deposit (50%), before work begins', money(s.deposit)], ['Remaining 50% across milestones', money(s.balance)], [left === 0 ? 'All assigned' : left > 0 ? 'Still to assign' : 'Assigned too much', money(fromCents(Math.abs(left)))]].map(([k, v], i) => (
          <div key={k} style={{ background: d.surface2, borderRadius: 8, padding: '8px 10px', border: i === 3 ? '1px solid ' + (left === 0 ? d.greenText : d.accent) : '1px solid ' + d.border }}>
            <div style={{ fontSize: 11, color: d.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: i === 3 ? (left === 0 ? d.greenText : d.accent) : d.text }} aria-live={i === 3 ? 'polite' : undefined}>{v}</div>
          </div>
        ))}
      </div>
      {milestones.map((m, idx) => (
        <div key={idx} style={{ background: d.white, border: '1px solid ' + d.border, borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 200px', minWidth: 0 }}>
              <label htmlFor={`${idPrefix}-n-${idx}`} style={small}>Milestone {idx + 1} name</label>
              <input id={`${idPrefix}-n-${idx}`} style={inputStyle} value={m.name} onChange={(e) => set(idx, { name: e.target.value })} placeholder="Design approved" />
            </div>
            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
              <label htmlFor={`${idPrefix}-f-${idx}`} style={small}>Amount ($)</label>
              <input id={`${idPrefix}-f-${idx}`} style={{ ...inputStyle, textAlign: 'right' }} type="number" step="0.01" min="0" value={m.fee} onChange={(e) => set(idx, { fee: e.target.value })} placeholder="0" />
            </div>
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <label htmlFor={`${idPrefix}-d-${idx}`} style={small}>Target date (optional)</label>
              <input id={`${idPrefix}-d-${idx}`} style={inputStyle} type="date" value={m.dueDate} onChange={(e) => set(idx, { dueDate: e.target.value })} />
            </div>
            <button aria-label={`Remove milestone ${idx + 1}`} onClick={() => onChange(milestones.filter((_, i) => i !== idx))} style={{ background: 'none', border: '1px solid ' + d.border, borderRadius: 8, color: d.text3, cursor: 'pointer', fontSize: 12, padding: '8px 10px' }}>Remove</button>
          </div>
          <label htmlFor={`${idPrefix}-t-${idx}`} style={small}>Deliverable or payment trigger</label>
          <textarea id={`${idPrefix}-t-${idx}`} className="form-input" style={{ background: d.surface, borderColor: d.border, color: d.text, minHeight: 56 }} value={m.deliverables} onChange={(e) => set(idx, { deliverables: e.target.value })} placeholder="Approval of the homepage design" />
        </div>
      ))}
      <button onClick={() => onChange([...milestones, blankMilestone(milestones.length + 1)])} style={{ background: d.accentBg, border: '1px solid ' + d.border2, color: d.text, fontFamily: ADMIN_FONTS.body, fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', marginBottom: 10 }}>+ Add milestone</button>
      {!check.ok && Number(total) > 0 && (
        <ul role="status" style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12, color: d.accent, lineHeight: 1.6 }}>
          {check.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  )
}
