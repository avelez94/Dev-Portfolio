/**
 * Website Care documents for one client, found by client id: signed (and
 * earlier) care agreements with their stored PDFs, and the health reports
 * that were sent. Records that can't be tied to the client by id are
 * returned separately as unlinked, never guessed into the list.
 */
import { db, CareError, type Row } from './db'

export type CareDoc = {
  kind: 'care_agreement' | 'care_report'
  id: string
  title: string
  date: string
  status: string
  site_id: string
  site_label: string
  /** Admin download for the stored PDF, when one exists. */
  pdf: string | null
  note?: string
}

export async function clientCareDocuments(clientId: string) {
  const client = (await db.from('clients').select('id, name, email, business').eq('id', clientId).maybeSingle()).data
  if (!client) throw new CareError('That client record does not exist.', 404)
  const sites = ((await db.from('care_sites').select('id, label, client_id, enrollment_status').eq('client_id', clientId)).data || []) as Row[]
  const agreements = ((await db.from('care_agreements').select('id, site_id, client_id, terms_version, status, issued_at, signed_at, signer_name, amount_cents, signed_pdf_path, superseded_reason')
    .eq('client_id', clientId).order('issued_at', { ascending: false })).data || []) as Row[]
  // Sites this client's agreements were issued on, including one since moved to another client.
  const siteIds = Array.from(new Set([...sites.map((s) => s.id), ...agreements.map((a) => a.site_id)]))
  const allSites = siteIds.length ? ((await db.from('care_sites').select('id, label, client_id').in('id', siteIds)).data || []) as Row[] : []
  const siteOf = (id: string) => allSites.find((s) => s.id === id)
  const docs: CareDoc[] = []
  for (const a of agreements) {
    if (a.status === 'superseded' && !a.signed_at) continue // never signed and replaced: not a document the client has
    const s = siteOf(a.site_id)
    docs.push({
      kind: 'care_agreement', id: a.id, site_id: a.site_id, site_label: s?.label || 'Website',
      title: `Website Care agreement ${a.terms_version}`,
      date: a.signed_at || a.issued_at,
      status: a.status === 'signed' ? `Signed by ${a.signer_name}` : a.status === 'superseded' ? 'Signed, later replaced by a newer version' : 'Sent, not signed yet',
      pdf: a.signed_pdf_path ? `/api/care/admin/sites/${a.site_id}/agreements/${a.id}/pdf` : null,
      note: s && s.client_id !== clientId ? 'This website now belongs to another client record; the agreement stays with the client who signed it.' : undefined,
    })
  }

  // Sent health reports, through their cycle's website.
  const mine = sites.map((s) => s.id)
  const cycles = mine.length ? ((await db.from('care_cycles').select('id, site_id, period_start, period_end').in('site_id', mine)).data || []) as Row[] : []
  const reports = cycles.length ? ((await db.from('care_reports').select('id, cycle_id').in('cycle_id', cycles.map((c) => c.id))).data || []) as Row[] : []
  const sends = reports.length ? ((await db.from('care_report_sends').select('id, report_id, approval_id, recipient_email, status, delivery_status, created_at, finished_at').in('report_id', reports.map((r) => r.id)).order('created_at', { ascending: false })).data || []) as Row[] : []
  const approvals = sends.length ? ((await db.from('care_report_approvals').select('id, version').in('id', sends.map((s) => s.approval_id))).data || []) as Row[] : []
  for (const snd of sends.filter((x) => x.status === 'accepted')) {
    const r = reports.find((x) => x.id === snd.report_id)!
    const c = cycles.find((x) => x.id === r.cycle_id)!
    const ver = approvals.find((x) => x.id === snd.approval_id)?.version
    docs.push({
      kind: 'care_report', id: snd.id, site_id: c.site_id, site_label: siteOf(c.site_id)?.label || 'Website',
      title: `Website health report, ${String(c.period_start).slice(0, 10)} to ${String(c.period_end).slice(0, 10)}`,
      date: snd.finished_at || snd.created_at,
      status: `Sent to ${snd.recipient_email}${snd.delivery_status !== 'unknown' ? ` (${snd.delivery_status})` : ''}`,
      pdf: ver ? `/api/care/admin/cycles/${c.id}/pdf?version=${ver}&download=1` : null,
    })
  }

  // Agreements on this client's websites that carry no client id: listed for you to check, not attributed.
  const unlinked = mine.length ? (((await db.from('care_agreements').select('id, site_id, terms_version, status, issued_at, signed_at, signer_name').in('site_id', mine).is('client_id', null)).data || []) as Row[]).map((a) => ({
    kind: 'care_agreement', id: a.id, title: `Website Care agreement ${a.terms_version}`, date: a.signed_at || a.issued_at,
    reason: 'Issued on one of this client’s websites but has no client id recorded. Check before treating it as theirs.',
  })) : []

  docs.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return { client, sites: sites.map((s) => ({ id: s.id, label: s.label, enrollment_status: s.enrollment_status, reviews: cycles.filter((c) => c.site_id === s.id).length })), documents: docs, unlinked }
}
