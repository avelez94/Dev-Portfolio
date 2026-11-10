'use client'
/** A saved invoice's details, and its PDF built from its own record (never from a form). */
import { useTheme } from '../../_components/theme'
import { DetailRows, Dialog, DialogTitle } from '../../_components/ui'
import { fmtMoney, fmtShort } from '../../_lib/format'
import { invoiceStatusLabel, invoiceTypeLabel } from '../../_lib/invoices'
import { brandedRecord, invoicePDF } from '../../_lib/pdf'
import type { Invoice } from '../../_lib/types'

export default function InvoiceDialog({ invoice: v, client, onClose }: { invoice: Invoice; client: { name: string; email: string } | null | undefined; onClose: () => void }) {
  const { d } = useTheme()
  // The saved invoice's own type decides its layout (fixed fee, project, revision or milestone).
  const download = () => invoicePDF({
    type: v.invoice_type, invoice_number: v.invoice_number, due_date: v.due_date, service_desc: v.service_desc,
    client_name: client?.name || 'Client', client_email: client?.email || '',
    total_fee: v.total_fee || v.amount, deposit_amount: v.deposit_amount || 0, hours: v.hours, hourly_rate: v.hourly_rate,
  }, brandedRecord(v))
  return (
    <Dialog label="Invoice details" onClose={onClose}>
      <DialogTitle onClose={onClose}>Invoice #{v.invoice_number}</DialogTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <DetailRows rows={[
          { label: 'Type', val: invoiceTypeLabel(v.invoice_type) },
          { label: 'Service', val: v.service_desc || 'Web development services' },
          { label: 'Total fee', val: fmtMoney(v.total_fee || v.amount) },
          ...(v.invoice_type === 'project' ? [
            { label: 'Deposit', val: fmtMoney(v.deposit_amount || v.total_fee * 0.5) },
            { label: 'Balance', val: fmtMoney((v.total_fee || 0) - (v.deposit_amount || 0)) },
          ] : v.invoice_type === 'revision' ? [{ label: 'Hours', val: v.hours + 'h x $' + v.hourly_rate + '/hr' }] : []),
          { label: 'Due date', val: v.due_date ? fmtShort(v.due_date) : 'Upon receipt' },
          { label: 'Status', val: invoiceStatusLabel(v.status) },
        ]} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" style={{ flex: 1, background: d.surface2, color: d.text }} onClick={download}>Download PDF</button>
        <button className="btn-cancel" style={{ flex: 1, borderColor: d.border, color: d.text2 }} onClick={onClose}>Close</button>
      </div>
    </Dialog>
  )
}
