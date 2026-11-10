/**
 * The signed Website Care agreement as a PDF: exactly the snapshot the client
 * read on their agreement page, plus their signature, the time and the
 * signing details. Built only from stored data, so it can be rebuilt
 * identically. Copy rule: no dashes in client facing text.
 */
import jsPDF from 'jspdf'
import { BRAND, COLORS as C, rgb } from '@/lib/brand'
import type { AgreementSnapshot } from './agreement'

const PW = 215.9
const PH = 279.4
const M = 18
const W = PW - M * 2
const BOTTOM = PH - 18

export type SignatureFacts = { signer_name: string; signer_email: string; signed_at: string; signer_ip: string; signature_image: string; agreement_id: string; snapshot_hash: string }

export function agreementPdf(a: AgreementSnapshot, sig: SignatureFacts | null): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = 0
  const set = (style: string, size: number, color: string) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...rgb(color)) }
  const lines = (t: string, w = W) => doc.splitTextToSize(String(t || ''), w) as string[]
  const footer = () => {
    set('normal', 7.5, C.muted)
    doc.text(`Website Care agreement ${a.version} for ${a.site.label}`, M, PH - 9)
    doc.text(sig ? `Signed • ${sig.agreement_id.slice(0, 8)}` : 'Not signed', PW - M, PH - 9, { align: 'right' })
  }
  const newPage = () => { footer(); doc.addPage(); y = 18 }
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage() }
  const para = (t: string, size = 9.5, color: string = C.inkSoft, style = 'normal') => {
    set(style, size, color)
    for (const l of lines(t)) { ensure(size * 0.5); doc.text(l, M, y); y += size * 0.45 }
    y += 1.6
  }
  const heading = (t: string) => { ensure(14); y += 2; set('bold', 11.5, C.ink); doc.text(t, M, y); y += 6 }

  // Header band
  doc.setFillColor(...rgb(C.cream)); doc.rect(0, 0, PW, 30, 'F')
  set('bold', 12, C.ink); doc.text(BRAND.name, M, 14)
  set('normal', 8.5, C.inkSoft); doc.text(BRAND.site, M, 19)
  set('bold', 8, C.coralDeep); doc.text('WEBSITE CARE AGREEMENT', PW - M, 14, { align: 'right' })
  set('normal', 8.5, C.inkSoft); doc.text(`Version ${a.version}`, PW - M, 19, { align: 'right' })
  y = 42
  set('bold', 18, C.ink); doc.text(`Care agreement for ${a.site.label}`, M, y); y += 9
  para(`Between ${BRAND.name} and ${a.client.business || a.client.name}${a.client.business && a.client.name ? ` (${a.client.name})` : ''}. Issued ${a.issued_on}.`, 9.5, C.inkSoft)

  heading('Plan and price')
  para(`${a.plan.name}: ${a.price.label} a month, billed monthly in advance until cancelled. ${a.plan.included_minutes ? `${a.plan.included_minutes} minutes of included plan time each billing period.` : 'No included plan time; work is quoted separately.'}`)

  heading('Agreed website and checks')
  para(`Website: ${a.site.url}${a.site.domains.length ? ` (approved domains: ${a.site.domains.join(', ')})` : ''}`)
  if (a.scope.pages.length) para(`Pages checked each month: ${a.scope.pages.map((p) => `${p.label} (${p.url})`).join('; ')}.`)
  if (a.scope.destinations.length) para(`Destinations opened each month: ${a.scope.destinations.map((d) => `${d.label} (${d.url})`).join('; ')}. Opening a destination doesn’t test booking, payment or form delivery.`)
  if (a.scope.checks.length) para(`Checked by hand each month: ${a.scope.checks.map((c) => c.label).join('; ')}.`)
  para('You confirm you’re authorized to have this website checked. Checks are read only and never submit forms, book, or pay.')

  for (const sec of a.terms) {
    heading(sec.title)
    for (const b of sec.body) para(b)
  }

  heading('Signature')
  if (sig) {
    ensure(52)
    try { doc.addImage(sig.signature_image, 'PNG', M, y, 70, 24) } catch { /* the signer details below still record the signature */ }
    y += 27
    doc.setDrawColor(...rgb(C.line)); doc.line(M, y, M + 90, y); y += 5
    para(`Signed by ${sig.signer_name} (${sig.signer_email}) on ${new Date(sig.signed_at).toUTCString().replace('GMT', 'UTC')}.`, 9.5, C.ink, 'bold')
    para(`Signed electronically on the client’s private agreement page from ${sig.signer_ip}. Agreement ${sig.agreement_id}. Content fingerprint ${sig.snapshot_hash.slice(0, 16)}.`, 8, C.muted)
  } else {
    para('Not signed yet.', 9.5, C.muted)
  }
  footer()
  return Buffer.from(doc.output('arraybuffer'))
}
