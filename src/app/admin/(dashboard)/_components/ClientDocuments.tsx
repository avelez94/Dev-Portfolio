'use client'
/**
 * The client's Documents section, shared by Pipeline and Website Care so both
 * show the same history: files, proposals, statements of work, contracts,
 * invoices, signed care agreements and sent care reports, all found by the
 * client's id. Records that only match by email are listed separately as
 * unlinked, for you to check (see _lib/client-docs.ts).
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { useTheme } from './theme'
import { useRows } from '../_lib/useRows'
import { downloadDoc, deleteDocument } from '../_lib/files'
import { assembleClientDocuments, DOC_KIND_LABEL, type ClientDoc } from '../_lib/client-docs'

type R = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

export default function ClientDocuments({ client, heading = 'Documents', links }: { client: { id: string; name?: string | null; email?: string | null }; heading?: string; links?: React.ReactNode }) {
  const { d } = useTheme()
  const email = (client.email || '').trim()
  const files = useRows<R>(() => supabase.from('documents').select('*').eq('client_id', client.id).order('created_at', { ascending: false }), [client.id])
  const proposals = useRows<R>(() => supabase.from('proposals').select('id, client_id, client_email, project_title, status, created_at').or(`client_id.eq.${client.id}${email ? `,client_email.ilike.${email}` : ''}`), [client.id, email])
  const pIds = proposals.rows.filter((p) => p.client_id === client.id).map((p) => p.id)
  const sows = useRows<R>(() => supabase.from('sows').select('id, proposal_id, client_email, project_title, status, created_at').or([pIds.length ? `proposal_id.in.(${pIds.join(',')})` : '', email ? `client_email.ilike.${email}` : ''].filter(Boolean).join(',') || 'id.is.null'), [pIds.join(','), email])
  const sIds = sows.rows.map((s) => s.id)
  const contracts = useRows<R>(() => supabase.from('contracts').select('id, proposal_id, sow_id, client_email, project_title, status, signed_at, created_at').or([pIds.length ? `proposal_id.in.(${pIds.join(',')})` : '', sIds.length ? `sow_id.in.(${sIds.join(',')})` : '', email ? `client_email.ilike.${email}` : ''].filter(Boolean).join(',') || 'id.is.null'), [pIds.join(','), sIds.join(','), email])
  const invoices = useRows<R>(() => supabase.from('invoices').select('id, client_id, invoice_number, service_desc, status, created_at').eq('client_id', client.id), [client.id])
  const iIds = invoices.rows.map((i) => i.id)
  const milestones = useRows<R>(() => (iIds.length ? supabase.from('invoice_milestones').select('id, invoice_id, status').in('invoice_id', iIds) : Promise.resolve({ data: [], error: null })), [iIds.join(',')])
  // Website Care documents come from the care API; it answers 404 where care is switched off.
  const [care, setCare] = useState<{ documents: R[]; unlinked: R[]; sites: R[] } | null>(null)
  const [careErr, setCareErr] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/care/admin/clients/${client.id}/documents`, { cache: 'no-store' })
      .then(async (r) => { if (!live) return; if (r.status === 404) { setCare(null); return } const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Couldn’t load Website Care documents.'); setCare(j) })
      .catch((e) => live && setCareErr(String(e.message || e)))
    return () => { live = false }
  }, [client.id])

  const { documents, unlinked } = assembleClientDocuments({ client, files: files.rows, proposals: proposals.rows, sows: sows.rows, contracts: contracts.rows, invoices: invoices.rows, milestones: milestones.rows, care })
  const err = files.error || proposals.error || sows.error || contracts.error || invoices.error || milestones.error || careErr
  const btn = { background: d.accentBg, color: d.accent, fontSize: 12, padding: '3px 8px', textDecoration: 'none', borderRadius: 8 } as const
  const row = (doc: ClientDoc) => (
    <li key={doc.kind + doc.id} data-kind={doc.kind} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', background: d.surface, borderRadius: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: d.text3, minWidth: 92 }}>{DOC_KIND_LABEL[doc.kind]}</span>
      <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: d.text }}>{doc.title}<span style={{ display: 'block', color: d.text3 }}>{fmtDate(doc.date)} · {doc.status}{doc.note ? ` · ${doc.note}` : ''}</span></span>
      {doc.pdf && <a className="cr-btn" style={btn} href={doc.pdf}>Download PDF</a>}
      {doc.open && <a className="cr-btn" style={btn} href={doc.open} target={doc.open.startsWith('/admin') ? undefined : '_blank'} rel="noreferrer">Open</a>}
      {doc.download && <button className="cr-btn" style={btn} onClick={() => downloadDoc(doc.download!.path, doc.download!.name)}>Download</button>}
      {doc.kind === 'file' && doc.download && <button aria-label={`Remove ${doc.title}`} className="icon-btn" style={{ color: d.text3 }} onClick={async () => { if (window.confirm(`Remove ${doc.title}?`)) { await deleteDocument(doc.id, doc.download!.path); await files.reload() } }}>x</button>}
    </li>
  )
  return (
    <section aria-label={`${heading} for ${client.name || 'this client'}`} data-testid="client-documents">
      <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, color: d.text3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{heading}{links}</div>
      {err && <div role="alert" style={{ fontSize: 12, color: d.redText, background: d.red, borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>Some documents couldn’t be loaded: {err}</div>}
      {documents.length === 0 && !err && <div style={{ fontSize: 12, color: d.text3, marginBottom: 8 }}>No documents linked to this client yet.</div>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{documents.map(row)}</ul>
      {unlinked.length > 0 && (
        <details style={{ marginTop: 8 }} data-testid="unlinked-documents">
          <summary style={{ fontSize: 12, color: d.text2, cursor: 'pointer' }}>Possibly this client’s, not linked ({unlinked.length})</summary>
          <p style={{ fontSize: 12, color: d.text3, margin: '6px 0' }}>These older records aren’t tied to this client’s id, so they’re not counted above. Check each before relying on it.</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{unlinked.map((u) => (
            <li key={u.kind + u.id} style={{ fontSize: 12, padding: '6px 12px', background: d.surface, borderRadius: 10, marginBottom: 6, color: d.text }}>
              <b>{DOC_KIND_LABEL[u.kind]}</b>: {u.title} · {fmtDate(u.date)}<span style={{ display: 'block', color: d.text3 }}>{u.reason}</span>
              {u.open && <a href={u.open} target="_blank" rel="noreferrer" style={{ color: d.accent }}>Open</a>}
            </li>
          ))}</ul>
        </details>
      )}
    </section>
  )
}
