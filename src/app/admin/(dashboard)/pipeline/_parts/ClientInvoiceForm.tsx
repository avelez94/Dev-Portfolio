'use client'
/**
 * Create an invoice for the client shown in the panel. The client is passed
 * in and never changes while this form is open: the panel remounts the form
 * when a different client is selected.
 */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { useTheme } from '../../_components/theme'
import { Field } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import type { PendingPreview } from '../../_components/PreviewDialog'
import { useRows } from '../../_lib/useRows'
import { blankClientInvoice, blankFixedFee, createClientInvoice, createFixedFeeInvoice, createMilestoneInvoice, invoicePreview, type ClientRef, type InvoiceType } from '../../_lib/invoices'
import type { Row } from '../../_lib/types'

export default function ClientInvoiceForm({ client, onClose, onSaved, onPreview }: { client: ClientRef; onClose: () => void; onSaved: () => void; onPreview: (p: PendingPreview) => void }) {
  const { d, inputStyle } = useTheme()
  const [type, setType] = useState<InvoiceType | null>(null)
  const [form, setForm] = useState(blankClientInvoice)
  const [fixed, setFixed] = useState(blankFixedFee)
  const [msNumber, setMsNumber] = useState('')
  const [sowId, setSowId] = useState('')
  const [msError, setMsError] = useState<string | null>(null)
  const sows = useRows<Row>(() => supabase.from('sows').select('*').order('created_at', { ascending: false }))
  useUnsaved(Boolean(form.invoice_number || form.total_fee || form.hours || fixed.invoice_number || fixed.total_fee || msNumber))

  const done = (ok: boolean) => { if (ok) { onSaved(); onClose() } }
  const label = (t: string) => <div style={{ fontSize: 12, color: d.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{t}</div>
  const back = <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={() => setType(null)}>Back</button>

  return (
    <div className="form-card" style={{ background: d.surface, borderColor: d.border, marginBottom: 16 }}>
      <div className="form-title" style={{ color: d.text }}>Invoice for {client.name}</div>
      {!type ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="ra-btn fill" onClick={() => setType('milestone')}>Milestone Invoice</button>
          <button className="ra-btn" style={{ background: d.surface2, color: d.text2, border: '1px solid ' + d.border }} onClick={() => setType('fixed_fee')}>Fixed Fee Invoice</button>
          <button className="ra-btn" style={{ background: d.surface, color: d.text3, border: '1px solid ' + d.border, fontSize: 12 }} onClick={() => setType('project')}>Project Invoice (deposit / balance)</button>
          <button className="ra-btn" style={{ background: d.surface, color: d.text3, border: '1px solid ' + d.border, fontSize: 12 }} onClick={() => setType('revision')}>Revision Invoice (hourly)</button>
          <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2, marginTop: 4 }} onClick={onClose}>Cancel</button>
        </div>
      ) : type === 'milestone' ? (
        <>
          {label('Milestone Invoice')}
          <Field label="Invoice #" style={{ marginBottom: 10 }}><input style={inputStyle} value={msNumber} onChange={(e) => setMsNumber(e.target.value)} placeholder="INV-165" /></Field>
          <Field label="Select SOW" style={{ marginBottom: 12 }}>
            <select style={inputStyle} value={sowId} onChange={(e) => setSowId(e.target.value)}>
              <option value="">{sows.loading ? 'Loading…' : 'Choose a SOW...'}</option>
              {sows.rows.map((s) => <option key={s.id} value={s.id}>{s.project_title}</option>)}
            </select>
          </Field>
          {sows.error && <div role="alert" style={{ fontSize: 12, color: d.redText, marginBottom: 10 }}>Couldn’t load statements of work. {sows.error}</div>}
          {(() => {
            const sow = sows.rows.find((s) => s.id === sowId)
            if (!sow?.line_items?.length) return null
            return (
              <div style={{ background: d.surface2, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: d.text3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Milestones</div>
                {sow.line_items.map((m: Row, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < sow.line_items.length - 1 ? '1px solid ' + d.border : 'none' }}>
                    <div>
                      <div style={{ fontSize: 12, color: d.text, fontWeight: 500 }}>{m.name}</div>
                      {m.deliverables && <div style={{ fontSize: 12, color: d.text3, marginTop: 2 }}>{m.deliverables}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: d.accent, fontWeight: 500, flexShrink: 0, paddingLeft: 12 }}>${parseFloat(m.fee || '0').toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )
          })()}
          {msError && <div role="alert" style={{ fontSize: 12, color: d.redText, background: d.red, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>{msError}</div>}
          <div className="form-actions">
            {back}
            <button className="btn-save" disabled={!sowId || !msNumber} onClick={async () => { const r = await createMilestoneInvoice(client, sows.rows.find((s) => s.id === sowId), msNumber); if (r === true) done(true); else setMsError(r) }}>Create</button>
          </div>
        </>
      ) : type === 'fixed_fee' ? (
        <>
          {label('Fixed Fee Invoice')}
          <div className="form-grid">
            <Field label="Invoice #"><input style={inputStyle} value={fixed.invoice_number} onChange={(e) => setFixed({ ...fixed, invoice_number: e.target.value })} placeholder="INV-164" /></Field>
            <Field label="Total Fee ($)"><input style={inputStyle} type="number" value={fixed.total_fee} onChange={(e) => setFixed({ ...fixed, total_fee: e.target.value })} placeholder="650" /></Field>
            <Field label="Due date"><input style={inputStyle} type="date" value={fixed.due_date} onChange={(e) => setFixed({ ...fixed, due_date: e.target.value })} /></Field>
            <Field label="Description" wide><input style={inputStyle} value={fixed.service_desc} onChange={(e) => setFixed({ ...fixed, service_desc: e.target.value })} placeholder="V7 Site Restructure — Change Order" /></Field>
          </div>
          <div className="form-actions">
            {back}
            <button className="btn-save" style={{ background: d.surface2, color: d.text }} onClick={async () => done(await createFixedFeeInvoice(client, fixed, 'download'))}>Download PDF</button>
            <button className="btn-save" onClick={async () => done(await createFixedFeeInvoice(client, fixed, 'send'))}>Send to Client</button>
          </div>
        </>
      ) : type === 'project' ? (
        <>
          {label('Project Invoice')}
          <div className="form-grid">
            <Field label="Invoice #"><input style={inputStyle} value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="INV-001" /></Field>
            <Field label="Total Fee ($)"><input style={inputStyle} type="number" value={form.total_fee} onChange={(e) => setForm({ ...form, total_fee: e.target.value })} placeholder="0" /></Field>
            <Field label="Deposit ($)"><input style={inputStyle} type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} placeholder="50% auto" /></Field>
            <Field label="Due date"><input style={inputStyle} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="Service description" wide><input style={inputStyle} value={form.service_desc} onChange={(e) => setForm({ ...form, service_desc: e.target.value })} placeholder="Web development services" /></Field>
          </div>
          <div className="form-actions">
            {back}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-save" style={{ background: d.surface2, color: d.text }} onClick={() => {
                const total = parseFloat(form.total_fee) || 0
                const dep = parseFloat(form.deposit_amount || String(total * 0.5)) || 0
                const snapshot = { ...form }
                onPreview({ doc: invoicePreview(snapshot, client, 'project', total, dep), action: 'download', onConfirm: async () => done(await createClientInvoice(client, 'project', snapshot, 'download')) })
              }}>Preview</button>
              <button className="btn-save" style={{ background: d.surface2, color: d.text }} onClick={async () => done(await createClientInvoice(client, 'project', form, 'download'))}>Download PDF</button>
              <button className="btn-save" onClick={async () => done(await createClientInvoice(client, 'project', form, 'send'))}>Send to Client</button>
            </div>
          </div>
        </>
      ) : (
        <>
          {label('Revision Invoice')}
          <div className="form-grid">
            <Field label="Invoice #"><input style={inputStyle} value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="INV-002-REV" /></Field>
            <Field label="Hours"><input style={inputStyle} type="number" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="0" /></Field>
            <Field label="Hourly rate ($)"><input style={inputStyle} type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></Field>
            <Field label="Due date"><input style={inputStyle} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="Revision description" wide><input style={inputStyle} value={form.service_desc} onChange={(e) => setForm({ ...form, service_desc: e.target.value })} placeholder="Additional revision round" /></Field>
          </div>
          <div className="form-actions">
            {back}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-save" style={{ background: d.surface2, color: d.text }} onClick={async () => done(await createClientInvoice(client, 'revision', form, 'download'))}>Download PDF</button>
              <button className="btn-save" onClick={async () => done(await createClientInvoice(client, 'revision', form, 'send'))}>Send to Client</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
