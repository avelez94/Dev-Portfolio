'use client'
/** Revenue: totals, the last six months, projects, and every invoice. */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { useTheme } from '../../_components/theme'
import { Empty, Field, PageFrame, PageHeader, PageState } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import { combine, useRows } from '../../_lib/useRows'
import { MONTHS, fmtMoney, fmtShort } from '../../_lib/format'
import { PROJECT_TYPES } from '../../_lib/documents'
import { markInvoicePaid, revenueTotals } from '../../_lib/invoices'
import type { Client, Invoice, Project } from '../../_lib/types'
import InvoiceDialog from './InvoiceDialog'
import ProjectDialog from './ProjectDialog'

const blankProject = () => ({ name: '', type: 'Business Website', value: '', platform: 'direct', status: 'active', end_date: '' })

export default function RevenueView() {
  const { d, inputStyle } = useTheme()
  const invoices = useRows<Invoice>(() => supabase.from('invoices').select('*').order('created_at', { ascending: false }))
  const projects = useRows<Project>(() => supabase.from('projects').select('*').order('created_at', { ascending: false }))
  const clients = useRows<Client>(() => supabase.from('clients').select('id, name, email'))
  const page = combine(invoices, projects, clients)
  const [showNew, setShowNew] = useState(false)
  const [np, setNp] = useState(blankProject)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null)
  useUnsaved(showNew && Boolean(np.name || np.value))

  const t = revenueTotals(invoices.rows, projects.rows)
  const maxMonthly = Math.max(...t.monthly.map((m) => m.value), 1)
  const totalProjectValue = t.direct + t.referral || 1
  const now = new Date()
  const viewingProject = projects.rows.find((p) => p.id === viewingProjectId)

  async function addProject() {
    if (!np.name || !np.value) return
    await supabase.from('projects').insert({ name: np.name, type: np.type, value: parseFloat(np.value), platform: np.platform, status: np.status, end_date: np.end_date || null })
    setNp(blankProject()); setShowNew(false)
    await projects.reload()
  }

  return (
    <PageFrame>
      <PageHeader title="Revenue" sub={`${now.getFullYear()} overview`} />
      <PageState {...page} what="revenue">
        <div className="stat-row">
          {[
            { label: 'Total earned', val: fmtMoney(t.totalEarned), sub: 'All time paid', bg: d.sand },
            { label: 'Outstanding', val: fmtMoney(t.totalOutstanding), sub: 'Awaiting payment', bg: d.linen },
            { label: 'This month', val: fmtMoney(t.thisMonth), sub: MONTHS[now.getMonth()], bg: d.blush },
            { label: 'Avg project', val: fmtMoney(t.avgProject), sub: projects.rows.length + ' projects', bg: d.pebble },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ background: s.bg, borderColor: d.border }}>
              <div className="sc-label" style={{ color: d.text2 }}>{s.label}</div>
              <div className="sc-num" style={{ color: d.text, fontSize: 20 }}>{s.val}</div>
              <div className="sc-sub" style={{ color: d.text3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="chart-wrap" style={{ background: d.white, borderColor: d.border }}>
          <h2 className="chart-title" style={{ color: d.text }}>Monthly revenue</h2>
          <div className="bar-chart">
            {t.monthly.map((m, i) => (
              <div key={i} className="bar-col">
                <div className="bar-val" style={{ color: d.text3 }}>{m.value > 0 ? fmtMoney(m.value) : ''}</div>
                <div className="bar" style={{ height: Math.max((m.value / maxMonthly) * 100, 4) + '%', background: m.month === now.getMonth() && m.year === now.getFullYear() ? d.accent : 'rgba(255,138,112,0.35)' }} />
                <div className="bar-label" style={{ color: d.text3 }}>{MONTHS[m.month]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="platform-bars">
          {[
            { label: 'Direct clients', val: t.direct, pct: (t.direct / totalProjectValue) * 100 },
            { label: 'Referrals and Platforms', val: t.referral, pct: (t.referral / totalProjectValue) * 100 },
          ].map((p, i) => (
            <div key={i} className="plat-card" style={{ background: d.white, borderColor: d.border }}>
              <div className="plat-label" style={{ color: d.text2 }}>{p.label}</div>
              <div className="plat-num" style={{ color: d.text }}>{fmtMoney(p.val)}</div>
              <div className="plat-bar-bg" style={{ background: d.surface2 }}><div className="plat-bar-fill" style={{ width: p.pct + '%', background: d.accent }} /></div>
            </div>
          ))}
        </div>
        <div className="section-label" style={{ color: d.text2, marginBottom: 12 }}>
          Projects
          <button className="add-row-btn" style={{ color: d.accent, background: d.accentBg, marginLeft: 'auto' }} onClick={() => setShowNew(!showNew)}>+ Add project</button>
        </div>
        {showNew && (
          <div className="form-card" style={{ background: d.surface, borderColor: d.border }}>
            <div className="form-title" style={{ color: d.text }}>New project</div>
            <div className="form-grid">
              <Field label="Name"><input style={inputStyle} value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="Project name" /></Field>
              <Field label="Type"><select style={inputStyle} value={np.type} onChange={(e) => setNp({ ...np, type: e.target.value })}>{PROJECT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Value ($)"><input style={inputStyle} type="number" value={np.value} onChange={(e) => setNp({ ...np, value: e.target.value })} placeholder="0" /></Field>
              <Field label="Platform"><select style={inputStyle} value={np.platform} onChange={(e) => setNp({ ...np, platform: e.target.value })}><option value="direct">Direct</option><option value="referral">Referral</option><option value="upwork">Upwork</option><option value="fiverr">Fiverr</option></select></Field>
              <Field label="Deadline"><input style={inputStyle} type="date" value={np.end_date} onChange={(e) => setNp({ ...np, end_date: e.target.value })} /></Field>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn-save" onClick={addProject}>Save</button>
            </div>
          </div>
        )}
        <div className="data-table" style={{ borderColor: d.border }}>
          <div className="dt-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 40px', background: d.surface, borderColor: d.border }}>
            {['Project', 'Type', 'Value', 'Platform', 'Deadline', ''].map((h, i) => <div key={i} className="dt-cell hd" style={{ color: d.text3 }}>{h}</div>)}
          </div>
          {projects.rows.length === 0 ? <Empty>No projects yet.</Empty> : projects.rows.map((p) => (
            <div key={p.id} className="dt-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 40px', borderColor: d.border }}>
              <div className="dt-cell" style={{ color: d.text }}>{p.name}</div>
              <div className="dt-cell" style={{ color: d.text2 }}>{p.type}</div>
              <div className="dt-cell" style={{ color: d.accent, fontWeight: 500 }}>{fmtMoney(p.value)}</div>
              <div className="dt-cell"><span className="status-pill" style={{ background: p.platform === 'direct' ? d.accentBg : d.surface2, color: p.platform === 'direct' ? d.accent : d.text2 }}>{p.platform}</span></div>
              <div className="dt-cell" style={{ color: d.text2 }}>{p.end_date ? fmtShort(p.end_date) : 'none'}</div>
              <div className="dt-cell" style={{ display: 'flex', gap: 4 }}>
                <button className="icon-btn" style={{ color: d.text2, fontSize: 12 }} onClick={() => setViewingProjectId(p.id)} title="View">view</button>
                <button aria-label="Remove" className="icon-btn" style={{ color: d.text3 }} onClick={async () => { await supabase.from('projects').delete().eq('id', p.id); await projects.reload() }}>x</button>
              </div>
            </div>
          ))}
        </div>
        <div className="section-label" style={{ color: d.text2, marginBottom: 12 }}>All Invoices</div>
        <div className="data-table" style={{ borderColor: d.border }}>
          <div className="dt-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 80px', background: d.surface, borderColor: d.border }}>
            {['Invoice #', 'Amount', 'Due', 'Status', ''].map((h, i) => <div key={i} className="dt-cell hd" style={{ color: d.text3 }}>{h}</div>)}
          </div>
          {invoices.rows.length === 0 ? <Empty>No invoices yet.</Empty> : invoices.rows.map((inv) => {
            const pill = inv.status === 'paid' ? { background: d.green, color: d.greenText } : inv.status === 'deposit_paid' ? { background: d.amber, color: d.amberText } : inv.status === 'awaiting_deposit' ? { background: d.surface2, color: d.text3 } : { background: d.amber, color: d.amberText }
            const label = inv.status === 'awaiting_signature' ? 'Unsigned' : inv.status === 'awaiting_deposit' ? 'Awaiting Dep' : inv.status === 'deposit_paid' ? 'Dep Paid' : inv.status === 'paid' ? 'Paid' : 'Pending'
            const pay = async () => { await markInvoicePaid(inv); await invoices.reload() }
            return (
              <div key={inv.id} className="dt-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 80px', borderColor: d.border }}>
                <div className="dt-cell" style={{ color: d.text }}>{inv.invoice_number}{inv.invoice_type === 'revision' ? ' (rev)' : inv.invoice_type === 'milestone' ? ' (ms)' : inv.invoice_type === 'fixed_fee' ? ' (fixed)' : ''}</div>
                <div className="dt-cell" style={{ color: d.accent, fontWeight: 500 }}>{fmtMoney(inv.total_fee || inv.amount)}</div>
                <div className="dt-cell" style={{ color: d.text2 }}>{inv.due_date ? fmtShort(inv.due_date) : 'none'}</div>
                <div className="dt-cell"><span className="status-pill" style={pill}>{label}</span></div>
                <div className="dt-cell" style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-btn" style={{ color: d.text2, fontSize: 12 }} onClick={() => setViewingInvoice(inv)} title="View">view</button>
                  {inv.status === 'awaiting_deposit' && <button className="icon-btn" style={{ color: d.amberText, fontSize: 12 }} onClick={pay} title="Mark deposit paid">dep</button>}
                  {inv.status === 'deposit_paid' && (inv.invoice_type === 'milestone'
                    ? <button className="icon-btn" style={{ color: d.greenText, fontSize: 12 }} onClick={pay} title="Record the next milestone payment (manage each one in Pipeline)">next</button>
                    : <button className="icon-btn" style={{ color: d.greenText, fontSize: 12 }} onClick={pay} title="Mark final paid">fin</button>)}
                  {inv.status === 'pending' && <button className="icon-btn" style={{ color: d.greenText, fontSize: 12 }} onClick={pay} title="Mark paid">ok</button>}
                  <button aria-label="Remove" className="icon-btn" style={{ color: d.text3 }} onClick={async () => { await supabase.from('invoices').delete().eq('id', inv.id); await invoices.reload() }}>x</button>
                </div>
              </div>
            )
          })}
        </div>
      </PageState>
      {viewingInvoice && <InvoiceDialog invoice={viewingInvoice} client={clients.rows.find((c) => c.id === viewingInvoice.client_id)} onClose={() => setViewingInvoice(null)} />}
      {viewingProject && <ProjectDialog key={viewingProject.id} project={viewingProject} onClose={() => setViewingProjectId(null)} onSaved={projects.reload} />}
    </PageFrame>
  )
}
