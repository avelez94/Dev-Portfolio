'use client'
/**
 * Pipeline: every client by stage. The selected client is in the address
 * (?client=), so links, refresh, and back and forward show the same person.
 */
import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-admin-browser'
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { useTheme } from '../../_components/theme'
import { Dialog, Empty, Field, PageFrame, PageHeader, PageState } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import PreviewDialog, { type PendingPreview } from '../../_components/PreviewDialog'
import { useRows } from '../../_lib/useRows'
import { PIPELINE_STAGES, STAGE_LABELS } from '../../_lib/leads'
import type { Client } from '../../_lib/types'
import ClientPanel from './ClientPanel'

const blankClient = () => ({ name: '', email: '', business: '', platform: 'direct', pipeline_stage: 'discovery_call' })

export default function PipelineView() {
  const { d, inputStyle } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const clients = useRows<Client>(() => supabase.from('clients').select('*').order('created_at', { ascending: false }))
  const [showAdd, setShowAdd] = useState(false)
  const [nc, setNc] = useState(blankClient)
  const [advancing, setAdvancing] = useState<Client | null>(null)
  const [projectForm, setProjectForm] = useState({ value: '', end_date: '' })
  const [preview, setPreview] = useState<PendingPreview | null>(null)
  useUnsaved(showAdd && Boolean(nc.name || nc.email || nc.business))

  const selectedId = params.get('client')
  const selected = selectedId ? clients.rows.find((c) => c.id === selectedId) : undefined
  const select = (c: Client) => router.push(`${pathname}?client=${encodeURIComponent(c.id)}`, { scroll: false })

  async function moveToNextStage(c: Client) {
    const i = PIPELINE_STAGES.indexOf(c.pipeline_stage)
    if (i === PIPELINE_STAGES.length - 1) return
    const nextStage = PIPELINE_STAGES[i + 1]
    if (nextStage === 'active_project') { setAdvancing(c); return }
    await supabase.from('clients').update({ pipeline_stage: nextStage }).eq('id', c.id)
    await clients.reload()
  }
  async function markAsLost(c: Client) {
    await supabase.from('clients').update({ pipeline_stage: 'lost' }).eq('id', c.id)
    await supabase.from('projects').update({ status: 'lost' }).eq('client_id', c.id)
    await clients.reload()
  }
  async function confirmActiveProject() {
    if (!advancing) return
    const c = advancing
    await supabase.from('clients').update({ pipeline_stage: 'active_project' }).eq('id', c.id)
    if (projectForm.value) {
      await supabase.from('projects').insert({
        client_id: c.id, name: c.name + (c.business ? ' — ' + c.business : ''), type: 'Custom Website or Application',
        value: parseFloat(projectForm.value), platform: c.platform || 'direct', status: 'active', end_date: projectForm.end_date || null,
      })
    }
    setAdvancing(null)
    setProjectForm({ value: '', end_date: '' })
    await clients.reload()
  }
  async function addClient() {
    if (!nc.name || !nc.email) return
    await supabase.from('clients').insert({ name: nc.name, email: nc.email, business: nc.business || null, pipeline_stage: nc.pipeline_stage, platform: nc.platform, notes: null })
    setNc(blankClient()); setShowAdd(false)
    await clients.reload()
  }

  const byStage = PIPELINE_STAGES.reduce((acc, s) => { acc[s] = clients.rows.filter((c) => c.pipeline_stage === s); return acc }, {} as Record<string, Client[]>)
  const panel = selected
    ? <ClientPanel key={selected.id} client={selected} onAdvance={moveToNextStage} onLost={markAsLost} onSaved={clients.reload} onPreview={setPreview} />
    : (
      <div className="rp-empty">
        <div className="rp-empty-icon">✦</div>
        <div className="rp-empty-text" style={{ color: d.text3 }}>{selectedId && !clients.loading ? 'That client wasn’t found.' : 'Select a client'}<br />to see the details here</div>
      </div>
    )

  return (
    <PageFrame panel={panel}>
      <PageHeader title="Pipeline" sub={`${clients.rows.length} clients total`} />
      <PageState loading={clients.loading} error={clients.error} retry={clients.reload} what="clients">
        <div style={{ marginBottom: 16 }}>
          <button className="add-row-btn" style={{ color: d.accent, background: d.accentBg, borderRadius: 10 }} onClick={() => setShowAdd(!showAdd)}>+ Add client manually</button>
        </div>
        {showAdd && (
          <div className="form-card" style={{ background: d.surface, borderColor: d.border, marginBottom: 20 }}>
            <div className="form-title" style={{ color: d.text }}>New client</div>
            <div className="form-grid">
              <Field label="Name"><input style={inputStyle} value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Full name" /></Field>
              <Field label="Email"><input style={inputStyle} value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder="client@email.com" /></Field>
              <Field label="Business (optional)"><input style={inputStyle} value={nc.business} onChange={(e) => setNc({ ...nc, business: e.target.value })} placeholder="Company name" /></Field>
              <Field label="Platform"><select style={inputStyle} value={nc.platform} onChange={(e) => setNc({ ...nc, platform: e.target.value })}><option value="direct">Direct</option><option value="upwork">Upwork</option><option value="fiverr">Fiverr</option><option value="referral">Referral</option></select></Field>
              <Field label="Stage"><select style={inputStyle} value={nc.pipeline_stage} onChange={(e) => setNc({ ...nc, pipeline_stage: e.target.value })}>{PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select></Field>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-save" onClick={addClient}>Add Client</button>
            </div>
          </div>
        )}
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="stage-section">
            <div className="stage-header">
              <div className="stage-pill" style={{
                background: stage === 'discovery_call' ? d.sand : stage === 'proposal_sent' ? d.linen : stage === 'active_project' ? d.green : stage === 'lost' ? d.red : d.surface,
                color: stage === 'discovery_call' ? d.amberText : stage === 'proposal_sent' ? d.text : stage === 'active_project' ? d.greenText : stage === 'lost' ? d.redText : d.text3,
              }}>{STAGE_LABELS[stage]}</div>
              <div className="stage-count" style={{ color: d.text3 }}>{byStage[stage]?.length || 0}</div>
            </div>
            {byStage[stage]?.length === 0
              ? <Empty left>Empty</Empty>
              : byStage[stage].map((c) => (
                <div key={c.id} className="client-row" role="button" tabIndex={0} aria-pressed={selected?.id === c.id}
                  style={{ background: selected?.id === c.id ? d.accentBg : d.white, borderColor: selected?.id === c.id ? d.accent : d.border }}
                  onClick={() => select(c)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(c) } }}>
                  <div style={{ flex: 1 }}>
                    <div className="cr-name" style={{ color: d.text }}>{c.name}</div>
                    <div className="cr-meta" style={{ color: d.text2 }}>{c.email}{c.business ? ' · ' + c.business : ''}{c.platform && c.platform !== 'direct' ? ' · ' + c.platform : ''}</div>
                  </div>
                  {stage !== 'closed' && stage !== 'lost' && <button className="cr-btn" style={{ background: d.surface, color: d.text2 }} onClick={(e) => { e.stopPropagation(); void moveToNextStage(c) }}>Advance</button>}
                </div>
              ))}
          </div>
        ))}
      </PageState>
      {advancing && (
        <Dialog label="Start active project" onClose={() => setAdvancing(null)} maxWidth={380} closeOnBackdrop={false}>
          <div style={{ fontFamily: ADMIN_FONTS.display, fontSize: 18, fontWeight: 600, color: d.text, marginBottom: 6 }}>Moving to Active Project</div>
          <div style={{ fontSize: 12, color: d.text3, marginBottom: 24 }}>{advancing.name} is now an active client. Add project details below.</div>
          <Field label="Project value ($)" style={{ marginBottom: 12 }}><input style={inputStyle} type="number" value={projectForm.value} onChange={(e) => setProjectForm({ ...projectForm, value: e.target.value })} placeholder="Total project fee" /></Field>
          <Field label="Delivery deadline" style={{ marginBottom: 20 }}><input style={inputStyle} type="date" value={projectForm.end_date} onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })} /></Field>
          <div className="form-actions">
            <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={() => setAdvancing(null)}>Cancel</button>
            <button className="btn-save" onClick={confirmActiveProject}>Confirm and Advance</button>
          </div>
        </Dialog>
      )}
      {preview && <PreviewDialog preview={preview} onClose={() => setPreview(null)} />}
    </PageFrame>
  )
}
