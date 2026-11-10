'use client'
/**
 * Everything for one client: stage actions, email, invoices, meetings, notes,
 * and files. The client comes from the address (?client=) and the parent
 * remounts this panel when it changes, so a half filled form can never be
 * submitted for a different person.
 */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { nyOffset } from '@/lib/time'
import { useTheme } from '../../_components/theme'
import { Field } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import type { PendingPreview } from '../../_components/PreviewDialog'
import { MY_EMAIL, postJson } from '../../_lib/api'
import { useRows } from '../../_lib/useRows'
import { fmtMoney, fmtShort } from '../../_lib/format'
import { PIPELINE_STAGES, STAGE_LABELS } from '../../_lib/leads'
import { invoiceStatusLabel, markInvoicePaid, markMilestonePaid, sendInvoiceEmail, sendMilestoneEmail } from '../../_lib/invoices'
import { milestonePDF } from '../../_lib/pdf'
import ClientDocuments from '../../_components/ClientDocuments'
import CareLinks from '../../_components/CareLinks'
import type { Client, Invoice, InvoiceMilestone, Meeting } from '../../_lib/types'
import ClientInvoiceForm from './ClientInvoiceForm'
import EmailDialog from './EmailDialog'
import InvoiceDialog from '../../revenue/_parts/InvoiceDialog'

const miniLabel = { fontSize: 12, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8 }

export default function ClientPanel({ client, onAdvance, onLost, onSaved, onPreview }: {
  client: Client
  onAdvance: (c: Client) => void
  onLost: (c: Client) => void
  onSaved: () => Promise<unknown>
  onPreview: (p: PendingPreview) => void
}) {
  const { d, inputStyle } = useTheme()
  const [showInvoice, setShowInvoice] = useState(false)
  const [showMeeting, setShowMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ title: 'Project Check-in', date: '', time: '' })
  const [scheduling, setScheduling] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(client.notes || '')
  const [sending, setSending] = useState(false)
  const [viewing, setViewing] = useState<Invoice | null>(null)
  useUnsaved(Boolean((showMeeting && (meetingForm.date || meetingForm.time)) || (editingNotes && notes !== (client.notes || ''))))

  const invoices = useRows<Invoice>(() => supabase.from('invoices').select('*').eq('client_id', client.id).order('created_at', { ascending: false }), [client.id])
  const msIds = invoices.rows.filter((i) => i.invoice_type === 'milestone').map((i) => i.id)
  const milestones = useRows<InvoiceMilestone>(() => (msIds.length ? supabase.from('invoice_milestones').select('*').in('invoice_id', msIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null })), [msIds.join(',')])
  const meetings = useRows<Meeting>(() => supabase.from('meetings').select('*').eq('client_id', client.id).order('scheduled_at', { ascending: false }), [client.id])
  const loadError = invoices.error || meetings.error || milestones.error

  async function scheduleMeeting() {
    if (!meetingForm.date || !meetingForm.time) return
    setScheduling(true)
    const scheduledAt = new Date(meetingForm.date + 'T' + meetingForm.time + ':00' + nyOffset(meetingForm.date)).toISOString() // Eastern Time, correct offset in winter too
    try {
      await postJson('/api/meetings/schedule', { clientId: client.id, clientName: client.name, clientEmail: client.email, scheduledAt, title: meetingForm.title, cc: MY_EMAIL })
      setMeetingForm({ title: 'Project Check-in', date: '', time: '' })
      setShowMeeting(false)
      await meetings.reload()
    } catch (e) { console.error(e) }
    setScheduling(false)
  }

  async function saveNotes() {
    await supabase.from('clients').update({ notes }).eq('id', client.id)
    setEditingNotes(false)
    await onSaved()
  }

  const open = client.pipeline_stage !== 'closed' && client.pipeline_stage !== 'lost'
  const first = client.name.split(' ')[0]
  return (
    <>
      <div className="rp-card" style={{ background: d.pebble }}>
        <div className="rp-eyebrow">{STAGE_LABELS[client.pipeline_stage]}{client.platform && client.platform !== 'direct' ? ' · ' + client.platform : ''}</div>
        <div className="rp-name" style={{ color: d.text }}>{client.name}</div>
        <div className="rp-meta" style={{ color: d.text2 }}>{client.email}</div>
        {client.business && <div className="rp-meta" style={{ color: d.text2 }}>{client.business}</div>}
      </div>
      <div className="rp-actions" style={{ marginBottom: 16 }}>
        {open && <button className="ra-btn fill" onClick={() => onAdvance(client)}>Advance to {STAGE_LABELS[PIPELINE_STAGES[PIPELINE_STAGES.indexOf(client.pipeline_stage) + 1]]}</button>}
        {open && <button className="ra-btn" style={{ background: d.red, color: d.redText, border: '1px solid ' + d.redText + '44' }} onClick={() => onLost(client)}>Mark as Lost</button>}
        {client.pipeline_stage === 'lost' && <button className="ra-btn" style={{ background: d.surface, color: d.text2, border: '1px solid ' + d.border }} onClick={() => onAdvance(client)}>Reactivate</button>}
        <button className="ra-btn" style={{ background: d.surface, color: d.text2, border: '1px solid ' + d.border }} onClick={() => setShowEmail(true)}>Email {first}</button>
        <button className="ra-btn" style={{ background: d.accentBg, color: d.accent, border: '1px solid ' + d.border2 }} onClick={() => setShowInvoice(!showInvoice)}>Create Invoice</button>
        <button className="ra-btn" style={{ background: d.surface, color: d.text2, border: '1px solid ' + d.border }} onClick={() => setShowMeeting(!showMeeting)}>Schedule Meeting</button>
      </div>
      {loadError && <div role="alert" style={{ fontSize: 12, color: d.redText, background: d.red, borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>Couldn’t load everything for {client.name}: {loadError}</div>}
      {showInvoice && <ClientInvoiceForm client={client} onClose={() => setShowInvoice(false)} onSaved={() => { void invoices.reload() }} onPreview={onPreview} />}
      {showMeeting && (
        <div className="form-card" style={{ background: d.surface, borderColor: d.border, marginBottom: 16 }}>
          <div className="form-title" style={{ color: d.text }}>Schedule a meeting with {client.name}</div>
          <div style={{ fontSize: 13, color: d.text2, marginBottom: 10 }}>Invite goes to {client.email}</div>
          <Field label="Meeting title" style={{ marginBottom: 10 }}><input style={inputStyle} value={meetingForm.title} onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })} placeholder="Project Check-in" /></Field>
          <div className="form-grid">
            <Field label="Date"><input style={inputStyle} type="date" value={meetingForm.date} onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })} /></Field>
            <Field label="Time (Eastern)"><input style={inputStyle} type="time" value={meetingForm.time} onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })} /></Field>
          </div>
          <div className="form-actions">
            <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={() => setShowMeeting(false)}>Cancel</button>
            <button className="btn-save" disabled={scheduling || !meetingForm.date || !meetingForm.time} onClick={scheduleMeeting}>{scheduling ? 'Scheduling...' : 'Schedule and Email Client'}</button>
          </div>
        </div>
      )}
      {meetings.rows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...miniLabel, color: d.text3 }}>Meetings</div>
          {meetings.rows.map((m) => {
            const isPast = new Date(m.scheduled_at) < new Date()
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: d.surface, borderRadius: 10, marginBottom: 4, opacity: isPast ? 0.6 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: d.text, fontWeight: 500 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: d.text2 }}>{fmtShort(m.scheduled_at)} · {new Date(m.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })}</div>
                </div>
                {!isPast && m.zoom_host_url && <a href={m.zoom_host_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: d.accent, textDecoration: 'none', fontWeight: 500 }}>Start</a>}
                {isPast && <span style={{ fontSize: 12, color: d.text3 }}>Done</span>}
              </div>
            )
          })}
        </div>
      )}
      {invoices.rows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...miniLabel, color: d.text3 }}>Invoices</div>
          {invoices.rows.map((inv) => {
            const colors: Record<string, { bg: string; text: string }> = {
              paid: { bg: d.green, text: d.greenText }, deposit_paid: { bg: d.amber, text: d.amberText },
              awaiting_deposit: { bg: d.surface2, text: d.text3 }, pending: { bg: d.amber, text: d.amberText },
            }
            const sc = colors[inv.status] || { bg: d.surface2, text: d.text3 }
            const nextAction = inv.status === 'awaiting_deposit' ? 'Mark Deposit Paid' : inv.status === 'deposit_paid' ? 'Mark Final Paid' : inv.status === 'pending' ? 'Mark Paid' : null
            if (inv.invoice_type === 'milestone') {
              const ms = milestones.rows.filter((m) => m.invoice_id === inv.id)
              return (
                <div key={inv.id} className="inv-row" style={{ background: d.surface }}>
                  <div style={{ fontSize: 12, color: d.text, fontWeight: 500, width: '100%' }}>#{inv.invoice_number} · Milestone Schedule</div>
                  <div style={{ fontSize: 12, color: d.text2, width: '100%' }}>{inv.service_desc} · {ms.length} payments · nothing is charged automatically</div>
                  {ms.map((m, idx) => {
                    const mc = m.status === 'paid' ? { bg: d.green, text: d.greenText } : m.status === 'invoiced' ? { bg: d.accentBg, text: d.accent } : { bg: d.amber, text: d.amberText }
                    return (
                      <div key={m.id} style={{ width: '100%', background: d.surface2, borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: d.text, fontWeight: 500 }}>{m.name}</div>
                            {m.deliverables && <div style={{ fontSize: 12, color: d.text3, marginTop: 1 }}>{m.deliverables}</div>}
                            {m.due_date && <div style={{ fontSize: 12, color: d.text3 }}>Due {fmtShort(m.due_date)}</div>}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: d.accent, fontWeight: 500 }}>{fmtMoney(m.fee)}</div>
                            <span className="status-pill" style={{ background: mc.bg, color: mc.text, marginTop: 3, display: 'inline-flex' }}>{m.status === 'paid' ? 'Paid' : m.status === 'invoiced' ? 'Invoiced' : 'Not invoiced'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <button className="cr-btn" style={{ background: d.surface, color: d.text2, fontSize: 12, padding: '3px 8px' }} onClick={() => milestonePDF(client.name, client.email, m, inv.invoice_number, ms.length, idx)}>Download PDF</button>
                          {m.status !== 'paid' && <button className="cr-btn" style={{ background: d.surface, color: d.text2, fontSize: 12, padding: '3px 8px' }} onClick={async () => { await sendMilestoneEmail(client, m, inv.invoice_number, ms.length, idx, () => window.confirm('This payment was already invoiced. Send the same invoice again as a reminder? Nothing is charged.')); await milestones.reload() }}>{m.status === 'invoiced' ? 'Resend reminder' : 'Send invoice'}</button>}
                          {m.status !== 'paid' && <button className="cr-btn" style={{ background: d.accentBg, color: d.accent, fontSize: 12, padding: '3px 8px' }} onClick={async () => { await markMilestonePaid(m); await Promise.all([milestones.reload(), invoices.reload()]) }}>Record payment</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
            return (
              <div key={inv.id} className="inv-row" style={{ background: d.surface }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: d.text, fontWeight: 500 }}>#{inv.invoice_number}{inv.invoice_type === 'revision' ? ' · Revision' : inv.invoice_type === 'fixed_fee' ? ' · Fixed Fee' : ''}</div>
                    <div style={{ fontSize: 12, color: d.text2 }}>{fmtMoney(inv.total_fee || inv.amount)}{inv.due_date ? ' · Due ' + fmtShort(inv.due_date) : ''}</div>
                  </div>
                  <span className="status-pill" style={{ background: sc.bg, color: sc.text }}>{invoiceStatusLabel(inv.status)}</span>
                </div>
                {inv.invoice_type === 'project' && inv.status !== 'paid' && (
                  <div style={{ fontSize: 12, color: d.text3, paddingLeft: 2 }}>
                    {inv.status === 'awaiting_deposit' && 'Deposit: ' + fmtMoney(inv.deposit_amount || inv.total_fee * 0.5) + ' · Balance: ' + fmtMoney((inv.total_fee || 0) - (inv.deposit_amount || inv.total_fee * 0.5))}
                    {inv.status === 'deposit_paid' && 'Deposit received · Balance due: ' + fmtMoney((inv.total_fee || 0) - (inv.deposit_amount || 0))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="cr-btn" style={{ background: d.surface, color: d.text2, fontSize: 12, padding: '4px 10px' }} onClick={() => setViewing(inv)}>View</button>
                  {nextAction && <button className="cr-btn" style={{ background: d.accentBg, color: d.accent, fontSize: 12, padding: '4px 10px' }} onClick={async () => { await markInvoicePaid(inv); await invoices.reload() }}>{nextAction}</button>}
                  {inv.status !== 'paid' && <button className="cr-btn" style={{ background: d.surface, color: d.text2, fontSize: 12, padding: '4px 10px' }} onClick={async () => { setSending(true); await sendInvoiceEmail(client, inv); setSending(false) }}>{sending ? 'Sending...' : 'Resend'}</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...miniLabel, color: d.text3, display: 'flex', alignItems: 'center', gap: 8 }}>
          Notes
          <button className="icon-btn" style={{ color: d.accent, fontSize: 12 }} onClick={() => { setEditingNotes(!editingNotes); setNotes(client.notes || '') }}>{editingNotes ? 'cancel' : 'edit'}</button>
        </div>
        {editingNotes ? (
          <div>
            <textarea className="form-input" style={{ background: d.surface, borderColor: d.border, color: d.text, marginBottom: 8 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes from discovery call, client preferences, anything relevant..." />
            <button className="btn-save" onClick={saveNotes}>Save Notes</button>
          </div>
        ) : (
          <div className="notes-box" role="button" tabIndex={0} style={{ background: d.surface, borderColor: d.border, color: client.notes ? d.text : d.text3 }} onClick={() => setEditingNotes(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingNotes(true) } }}>
            {client.notes || 'Click to add notes...'}
          </div>
        )}
      </div>
      <ClientDocuments client={client} links={<CareLinks clientId={client.id} />} />
      {showEmail && <EmailDialog client={client} onClose={() => setShowEmail(false)} />}
      {viewing && <InvoiceDialog invoice={viewing} client={client} onClose={() => setViewing(null)} />}
    </>
  )
}
