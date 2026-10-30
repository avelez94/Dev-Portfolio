/**
 * One client's document history, by client id: uploaded files, proposals,
 * statements of work, contracts, invoices and milestone invoices, plus Website
 * Care agreements and sent health reports (from the care API).
 *
 * Linking rules (no guessing):
 * - Files, proposals and invoices belong to the client when their client_id is
 *   the client's id.
 * - A statement of work belongs through its proposal; a contract through its
 *   proposal or statement of work.
 * - Care agreements and reports come from the care API, by client id.
 * Older records that only match the client's email are returned as unlinked,
 * with the reason, so you can check them; they are never merged in.
 * Pure (no imports), so it is tested directly.
 */

type R = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type DocKind = 'file' | 'proposal' | 'sow' | 'contract' | 'invoice' | 'care_agreement' | 'care_report'
export type ClientDoc = { kind: DocKind; id: string; title: string; date: string; status: string; open?: string; download?: { path: string; name: string }; pdf?: string; note?: string }
export type UnlinkedDoc = { kind: DocKind; id: string; title: string; date: string; reason: string; open?: string }

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  file: 'File', proposal: 'Proposal', sow: 'Statement of work', contract: 'Contract', invoice: 'Invoice', care_agreement: 'Care agreement', care_report: 'Care report',
}

/** Every kind of document the client history covers, in the order the filters show them. */
export const DOC_KINDS = Object.keys(DOC_KIND_LABEL) as DocKind[]

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '')

export function assembleClientDocuments(input: {
  client: { id: string; email?: string | null }
  files?: R[]; proposals?: R[]; sows?: R[]; contracts?: R[]; invoices?: R[]; milestones?: R[]
  care?: { documents: R[]; unlinked?: R[] } | null
}): { documents: ClientDoc[]; unlinked: UnlinkedDoc[] } {
  const { client } = input
  const docs: ClientDoc[] = []
  const unlinked: UnlinkedDoc[] = []
  const emailOnly = 'Matches this client’s email but isn’t linked to their record.'

  for (const f of input.files || []) {
    if (f.client_id !== client.id) continue
    docs.push({ kind: 'file', id: f.id, title: f.name || 'File', date: f.created_at, status: cap(f.type) || 'Uploaded', download: { path: f.storage_path, name: f.name } })
  }

  const myProposals = new Set<string>()
  for (const p of input.proposals || []) {
    const title = `Proposal: ${p.project_title || 'Untitled'}`
    if (p.client_id === client.id) {
      myProposals.add(p.id)
      docs.push({ kind: 'proposal', id: p.id, title, date: p.created_at, status: cap(p.status) || 'Sent', open: `/proposals/${p.id}` })
    } else if (!p.client_id && same(p.client_email, client.email)) {
      unlinked.push({ kind: 'proposal', id: p.id, title, date: p.created_at, reason: emailOnly, open: `/proposals/${p.id}` })
    }
  }

  const mySows = new Set<string>()
  for (const s of input.sows || []) {
    const title = `Statement of work: ${s.project_title || 'Untitled'}`
    if (s.proposal_id && myProposals.has(s.proposal_id)) {
      mySows.add(s.id)
      docs.push({ kind: 'sow', id: s.id, title, date: s.created_at, status: cap(s.status) || 'Sent', open: `/sows/${s.id}` })
    } else if (same(s.client_email, client.email)) {
      unlinked.push({ kind: 'sow', id: s.id, title, date: s.created_at, reason: s.proposal_id ? 'Its proposal isn’t linked to this client. ' + emailOnly : 'Has no proposal to link it. ' + emailOnly, open: `/sows/${s.id}` })
    }
  }

  for (const c of input.contracts || []) {
    const title = `Contract: ${c.project_title || 'Untitled'}`
    if ((c.proposal_id && myProposals.has(c.proposal_id)) || (c.sow_id && mySows.has(c.sow_id))) {
      docs.push({ kind: 'contract', id: c.id, title, date: c.signed_at || c.created_at, status: c.status === 'signed' ? 'Signed' : cap(c.status) || 'Sent', open: `/contracts/${c.id}` })
    } else if (same(c.client_email, client.email)) {
      unlinked.push({ kind: 'contract', id: c.id, title, date: c.signed_at || c.created_at, reason: c.proposal_id || c.sow_id ? 'Its proposal or statement of work isn’t linked to this client. ' + emailOnly : 'Has no proposal or statement of work to link it. ' + emailOnly, open: `/contracts/${c.id}` })
    }
  }

  for (const i of input.invoices || []) {
    if (i.client_id !== client.id) continue
    const ms = (input.milestones || []).filter((m) => m.invoice_id === i.id)
    const paid = ms.filter((m) => m.status === 'paid').length
    docs.push({
      kind: 'invoice', id: i.id, title: `Invoice ${i.invoice_number || ''}`.trim() + (i.service_desc ? `: ${i.service_desc}` : ''), date: i.created_at,
      status: ms.length ? `${cap(i.status) || 'Pending'}, ${paid} of ${ms.length} milestone payments received` : cap(i.status) || 'Pending',
    })
  }

  for (const d of input.care?.documents || []) {
    docs.push({ kind: d.kind, id: d.id, title: `${d.title} (${d.site_label})`, date: d.date, status: d.status, pdf: d.pdf || undefined, open: `/admin/care?site=${d.site_id}`, note: d.note })
  }
  for (const u of input.care?.unlinked || []) unlinked.push({ kind: u.kind, id: u.id, title: u.title, date: u.date, reason: u.reason })

  const byDate = (a: { date: string }, b: { date: string }) => String(b.date || '').localeCompare(String(a.date || ''))
  return { documents: docs.sort(byDate), unlinked: unlinked.sort(byDate) }
}
