'use client'
/**
 * Documents: reference pricing, the proposal and contract forms, signed
 * contracts, and uploaded files. The details panel always shows who the open
 * form is for and the exact address it sends to.
 */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { useTheme } from '../../_components/theme'
import { PageFrame, PageHeader, PageState } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import PreviewDialog, { type PendingPreview } from '../../_components/PreviewDialog'
import { combine, useRows } from '../../_lib/useRows'
import { blankContract, resendSignedContract, saveProposalDraft, savedLineItems, savedMilestones, savedProposalForm, sendContract, sendProposal, type ContractForm as ContractFields, type LineItem, type MilestoneDraft, type ProposalForm as ProposalFields } from '../../_lib/documents'
import { deleteDocument, downloadDoc, uploadTemplate } from '../../_lib/files'
import type { Client, Document, Pricing, Row } from '../../_lib/types'
import PricingCards from './PricingCards'
import ProposalForm from './ProposalForm'
import ContractForm from './ContractForm'
import DocContext from './DocContext'

const docIcon = (d: ReturnType<typeof useTheme>['d'], bg: string, path: React.ReactNode) => (
  <div className="doc-icon" style={{ background: bg, color: d.accent }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">{path}</svg></div>
)

export default function DocumentsView() {
  const { d } = useTheme()
  const pricing = useRows<Pricing>(() => supabase.from('pricing').select('*').order('id'))
  const clients = useRows<Client>(() => supabase.from('clients').select('*').order('created_at', { ascending: false }))
  const proposals = useRows<Row>(() => supabase.from('proposals').select('*').order('created_at', { ascending: false }))
  const contracts = useRows<Row>(() => supabase.from('contracts').select('*').order('created_at', { ascending: false }))
  const templates = useRows<Document>(() => supabase.from('documents').select('*').is('client_id', null).order('created_at', { ascending: false }))
  const page = combine(pricing, clients, proposals, contracts, templates)

  const [open, setOpen] = useState<'proposal' | 'contract' | null>(null)
  const [preview, setPreview] = useState<PendingPreview | null>(null)
  const [error, setError] = useState<{ kind: 'proposal' | 'contract'; message: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<'proposal' | 'contract' | null>(null)

  // The proposal draft is kept in this browser, exactly as before.
  const [proposalForm, setProposalFormState] = useState<ProposalFields>(savedProposalForm)
  const [lineItems, setLineItemsState] = useState<LineItem[]>(savedLineItems)
  const [proposalMilestones, setMilestonesState] = useState<MilestoneDraft[]>(savedMilestones)
  const setProposalForm = (v: ProposalFields) => { setProposalFormState(v); saveProposalDraft.form(v) }
  const setLineItems = (v: LineItem[]) => { setLineItemsState(v); saveProposalDraft.items(v) }
  const setProposalMilestones = (v: MilestoneDraft[]) => { setMilestonesState(v); saveProposalDraft.milestones(v) }

  const [contractForm, setContractForm] = useState<ContractFields>(blankContract)
  useUnsaved(JSON.stringify(contractForm) !== JSON.stringify(blankContract()) && sent !== 'contract')

  async function onSendProposal() {
    if (!proposalForm.client_email || !proposalForm.client_name) return
    setError(null); setSending(true)
    const r = await sendProposal(proposalForm, lineItems, proposalMilestones)
    setSending(false)
    if (!r.ok) { setError({ kind: 'proposal', message: r.message }); return }
    setSent('proposal'); setTimeout(() => setSent(null), 3000)
  }
  async function onSendContract() {
    if (!contractForm.client_email || !contractForm.client_name) return
    if (!contractForm.invoice_number) { alert('Please fill in the invoice number before sending.'); return }
    setError(null); setSending(true)
    const r = await sendContract(contractForm)
    setSending(false)
    if (!r.ok) { setError({ kind: 'contract', message: r.message }); return }
    setSent('contract'); setTimeout(() => setSent(null), 3000)
  }

  const form = open === 'proposal' ? proposalForm : open === 'contract' ? contractForm : null
  const signed = contracts.rows.filter((c) => c.status === 'signed')
  const toggle = (k: 'proposal' | 'contract') => setOpen(open === k ? null : k)

  return (
    <PageFrame panel={<DocContext form={form} kind={open === 'proposal' ? 'Proposal' : open === 'contract' ? 'Contract' : ''} clients={clients.rows} />}>
      <div style={{ width: '100%' }}>
        <PageHeader title="Documents" sub="Templates and fill forms" />
        <PageState {...page} what="documents">
          <div className="section-label" style={{ color: d.text2, marginBottom: 12 }}>My Pricing</div>
          <PricingCards pricing={pricing.rows} onSaved={pricing.reload} />

          <div className="section-label" style={{ color: d.text2, marginBottom: 16 }}>Fill and generate</div>
          <div className="doc-card" style={{ background: d.white, borderColor: d.border }}>
            <div className="doc-card-header">
              {docIcon(d, d.blush, <><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M5 4h6M5 6.5h6M5 9h4M5 11.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>)}
              <div>
                <div className="doc-name" style={{ color: d.text }}>Project Proposal</div>
                <div style={{ fontSize: 12, color: d.text3 }}>Scope, pricing, and milestone schedule combined</div>
              </div>
            </div>
            <div className="doc-actions"><button className="doc-btn fill" onClick={() => toggle('proposal')}>{open === 'proposal' ? 'Close form' : 'Fill out Proposal'}</button></div>
          </div>
          {open === 'proposal' && (
            <ProposalForm proposalForm={proposalForm} setProposalForm={setProposalForm} lineItems={lineItems} setLineItems={setLineItems}
              proposalMilestones={proposalMilestones} setProposalMilestones={setProposalMilestones} clients={clients.rows}
              error={error?.kind === 'proposal' ? error.message : null} sent={sent === 'proposal'} sending={sending}
              onSend={onSendProposal} onClose={() => setOpen(null)} onPreview={setPreview} />
          )}

          {signed.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-mini-label" style={{ color: d.text3, marginBottom: 8 }}>Signed contracts</div>
              {signed.map((c) => (
                <div key={c.id} style={{ background: d.white, border: '1px solid ' + d.border, borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: d.text }}>{c.client_name}</div>
                    <div style={{ fontSize: 12, color: d.text3, fontFamily: 'DM Mono,monospace' }}>{c.project_title} · Signed {new Date(c.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                  <button className="btn-save" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => resendSignedContract(c.id)}>Resend PDF</button>
                </div>
              ))}
            </div>
          )}
          <div className="doc-card" style={{ background: d.white, borderColor: d.border }}>
            <div className="doc-card-header">
              {docIcon(d, d.pebble, <><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V6L9 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M9 1v5h5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></>)}
              <div>
                <div className="doc-name" style={{ color: d.text }}>Freelance Contract</div>
                <div style={{ fontSize: 12, color: d.text3 }}>Fill out and download a client ready contract</div>
              </div>
            </div>
            <div className="doc-actions"><button className="doc-btn fill" onClick={() => toggle('contract')}>{open === 'contract' ? 'Close form' : 'Fill out contract'}</button></div>
          </div>
          {open === 'contract' && (
            <ContractForm contractForm={contractForm} setContractForm={setContractForm} proposals={proposals.rows.filter((p) => p.status === 'accepted')}
              error={error?.kind === 'contract' ? error.message : null} sent={sent === 'contract'} sending={sending}
              onSend={onSendContract} onClose={() => setOpen(null)} onPreview={setPreview} />
          )}

          {templates.rows.length > 0 && (
            <>
              <div className="section-label" style={{ color: d.text2, marginBottom: 12, marginTop: 8 }}>Uploaded files</div>
              {templates.rows.map((t) => (
                <div key={t.id} className="doc-card" style={{ background: d.white, borderColor: d.border }}>
                  <div className="doc-card-header">
                    <div className="doc-icon" style={{ background: d.surface, color: d.text3 }}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" /></svg></div>
                    <div className="doc-name" style={{ color: d.text, flex: 1 }}>{t.name}</div>
                    <button aria-label="Remove" className="icon-btn" style={{ color: d.text3 }} onClick={async () => { await deleteDocument(t.id, t.storage_path); await templates.reload() }}>x</button>
                  </div>
                  <div className="doc-actions"><button className="doc-btn fill" onClick={() => downloadDoc(t.storage_path, t.name)}>Download</button></div>
                </div>
              ))}
            </>
          )}
          <label className="upload-zone" style={{ borderColor: d.border, color: d.text3, background: d.surface }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>+</div>
            <div style={{ fontSize: 12 }}>Upload any document</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Supports .docx, .pdf, .txt</div>
            <input type="file" accept=".docx,.pdf,.txt" style={{ display: 'none' }} onChange={async (e) => { if (e.target.files?.[0] && (await uploadTemplate(e.target.files[0]))) await templates.reload() }} />
          </label>
        </PageState>
      </div>
      {preview && <PreviewDialog preview={preview} onClose={() => setPreview(null)} />}
    </PageFrame>
  )
}
