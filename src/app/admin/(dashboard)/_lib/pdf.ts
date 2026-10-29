/**
 * PDF builders for invoices and proposals, moved unchanged from the single
 * page dashboard. With `brand`, a document uses the studio layout (header
 * band, page numbers, headings that stay with their text). Without it, the
 * original layout is used, which is kept for downloading records created
 * before the new styling so they match what the client originally received.
 */
import jsPDF from 'jspdf'
import { createBrandedPdf } from '@/lib/pdf/writer'
import { contractPdf } from '@/lib/pdf/contract'
import { usesStudioBrand } from '@/lib/brand-version'
import { STANDARD_DEPOSIT_PCT, STANDARD_HOURLY_RATE, additionalWorkSentence, proposalPaymentLines } from '@/lib/terms'
import { contractTermsDoc, currentTerms, type ContractForm, type LineItem, type MilestoneDraft, type ProposalForm } from './documents'
import type { InvoiceMilestone } from './types'

/** Stored per record (see src/lib/brand-version.ts); never inferred from dates. */
export const brandedRecord = usesStudioBrand

export function makePDF(brand?: { docType: string; title: string; subtitle?: string }) {
  if (brand) {
    const pdf = createBrandedPdf(brand)
    const clean = (s: string) => s.replace(/\s+[–—]\s+/g, ': ')
    const addLine = (text: string, size = 11, bold = false, accent = false) => {
      if (accent && size >= 14) return // the document title lives in the header band
      if (/^Alante Velez\s*\|/.test(text) || /^alante@alantevelez\.com/.test(text)) return // already in the header and footer
      if (/^Prepared: /.test(text)) return // the date is in the subtitle
      if (accent && bold) {
        if (/^SIGNATURES$/.test(text)) pdf.ensure(70) // keep the signature lines with their heading
        pdf.heading(clean(text)); return
      }
      pdf.text(clean(text), { size: size === 11 ? 10.5 : size, bold, color: bold ? 'ink' : 'inkSoft', gap: 0.9 })
    }
    const addSpace = (n = 1) => pdf.space(n * 3.4)
    const addDivider = () => pdf.divider()
    return { doc: pdf.doc, addLine, addSpace, addDivider, save: (name: string) => { pdf.finish(); pdf.doc.save(name) } }
  }
  const doc = new jsPDF()
  const lm = 20, rm = 190, lineH = 7
  let y = 20
  const addLine = (text: string, size = 11, bold = false, accent = false) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    if (accent) doc.setTextColor(196, 112, 74)
    else doc.setTextColor(44, 36, 32)
    const lines = doc.splitTextToSize(text, rm - lm)
    lines.forEach((line: string) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(line, lm, y); y += lineH
    })
  }
  const addSpace = (n = 1) => { y += lineH * n }
  const addDivider = () => {
    doc.setDrawColor(196, 112, 74); doc.setLineWidth(0.3)
    doc.line(lm, y, rm, y); y += lineH
  }
  return { doc, addLine, addSpace, addDivider, save: (name: string) => doc.save(name) }
}

export type InvoiceFields = { invoice_number: string; due_date: string; service_desc: string; hours: string; hourly_rate: string }

export function clientInvoicePDF(f: InvoiceFields, clientName: string, clientEmail: string, type: string, totalFee: number, depositAmount: number, branded = true) {
  const { addLine, addSpace, addDivider, save } = makePDF(branded ? { docType: 'Invoice', title: 'Invoice #' + f.invoice_number, subtitle: 'Prepared for ' + clientName } : undefined)
  addLine('INVOICE', 16, true, true)
  addLine('Alante Velez | Full Stack Web Developer', 10)
  addDivider(); addSpace()
  addLine('INVOICE #' + f.invoice_number, 12, true); addSpace(0.5)
  addLine('Due Date: ' + (f.due_date || 'Upon receipt'))
  addSpace(); addDivider()
  addLine('BILL TO', 10, true, true); addSpace(0.5)
  addLine(clientName); addLine(clientEmail)
  addSpace(); addDivider()
  addLine('SERVICE', 10, true, true); addSpace(0.5)
  addLine(f.service_desc || 'Web development services')
  addSpace(); addDivider()
  if (type === 'project') {
    addLine('PAYMENT BREAKDOWN', 10, true, true); addSpace(0.5)
    addLine('Total Project Fee: $' + totalFee.toLocaleString()); addSpace(0.5)
    addLine('Deposit Due Now (50%): $' + depositAmount.toLocaleString(), 11, true)
    addLine('Balance Due on Delivery (50%): $' + (totalFee - depositAmount).toLocaleString(), 11, true)
    addSpace(0.5)
    addLine('Note: Final deliverables will be transferred upon receipt of the balance payment.', 10)
  } else {
    addLine('REVISION BILLING', 10, true, true); addSpace(0.5)
    addLine('Hours: ' + f.hours + ' hrs x $' + f.hourly_rate + '/hr')
    addLine('Total Due: $' + totalFee.toLocaleString(), 12, true)
  }
  addSpace(); addDivider()
  addLine('PAYMENT', 10, true, true); addSpace(0.5)
  addLine('Stripe, PayPal, Zelle, or Wise')
  addLine('Reference: Invoice #' + f.invoice_number + ' | ' + clientName)
  save('Invoice_' + f.invoice_number + '_' + clientName.replace(/\s+/g, '_') + '.pdf')
}

export function fixedFeePDF(f: { invoice_number: string; due_date: string; service_desc: string }, clientName: string, fee: number) {
  const { addLine, addSpace, addDivider, save } = makePDF({ docType: 'Invoice', title: 'Invoice #' + f.invoice_number, subtitle: 'Prepared for ' + clientName })
  addLine('INVOICE', 16, true, true)
  addLine('Alante Velez | Full Stack Web Developer', 10)
  addDivider(); addSpace()
  addLine('INVOICE #' + f.invoice_number, 12, true); addSpace(0.5)
  addLine('Due Date: ' + (f.due_date || 'Upon receipt'))
  addSpace(); addDivider()
  addLine('BILL TO', 10, true, true); addSpace(0.5)
  addLine(clientName)
  addSpace(); addDivider()
  addLine('SERVICE', 10, true, true); addSpace(0.5)
  addLine(f.service_desc || 'Web development services')
  addSpace(); addDivider()
  addLine('PAYMENT', 10, true, true); addSpace(0.5)
  addLine('Total due: $' + fee.toLocaleString(), 12, true)
  addSpace(0.5)
  addLine('Payment method: Zelle')
  addLine('Reference: Invoice #' + f.invoice_number + ' | ' + clientName)
  save('Invoice_' + f.invoice_number + '_' + clientName.replace(/\s+/g, '_') + '.pdf')
}

export function milestonePDF(clientName: string, clientEmail: string, milestone: InvoiceMilestone, invoiceNumber: string, totalCount: number, index: number) {
  // Existing milestone records: original layout unless created after the styling cutoff.
  const { addLine, addSpace, addDivider, save } = makePDF(brandedRecord(milestone) ? { docType: 'Invoice', title: 'Invoice #' + invoiceNumber, subtitle: 'Milestone ' + (index + 1) + ' of ' + totalCount + ' for ' + clientName } : undefined)
  addLine('INVOICE', 16, true, true)
  addLine('Alante Velez | Full Stack Web Developer', 10)
  addDivider(); addSpace()
  addLine('INVOICE #' + invoiceNumber + ' — Milestone ' + (index + 1) + ' of ' + totalCount, 12, true); addSpace(0.5)
  addLine('Due Date: ' + (milestone.due_date || 'Upon completion'))
  addSpace(); addDivider()
  addLine('BILL TO', 10, true, true); addSpace(0.5)
  addLine(clientName); addLine(clientEmail)
  addSpace(); addDivider()
  addLine('MILESTONE', 10, true, true); addSpace(0.5)
  addLine(milestone.name, 12, true)
  if (milestone.deliverables) { addSpace(0.5); addLine(milestone.deliverables) }
  addSpace(); addDivider()
  addLine('PAYMENT', 10, true, true); addSpace(0.5)
  addLine('Milestone fee: $' + milestone.fee.toLocaleString(), 12, true)
  addSpace(0.5)
  addLine('Payment method: Zelle')
  addLine('Reference: Invoice #' + invoiceNumber + ' | ' + milestone.name)
  save('Invoice_' + invoiceNumber + '_M' + (index + 1) + '.pdf')
}

export function proposalPDF(f: ProposalForm, lineItems: LineItem[], proposalMilestones: MilestoneDraft[]) {
  const validItems = lineItems.filter((i) => i.description && i.price)
  const total = validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
  const { addLine, addSpace, addDivider, save } = makePDF({ docType: 'Project proposal', title: f.project_title || 'Project proposal', subtitle: 'Prepared for ' + (f.client_business || f.client_name) + ' on ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })
  addLine('PROJECT PROPOSAL', 16, true, true)
  addLine('Alante Velez  |  Full Stack Web Developer', 10)
  addLine('alante@alantevelez.com  |  alantevelez.com', 10)
  addLine('Prepared: ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 10)
  addDivider(); addSpace()
  addLine('PREPARED FOR', 10, true, true); addSpace(0.5)
  addLine(f.client_name); addLine(f.client_email)
  if (f.client_business) addLine(f.client_business)
  addSpace(); addDivider()
  addLine('PROJECT', 10, true, true); addSpace(0.5)
  addLine('Title: ' + f.project_title)
  addLine('Type: ' + f.project_type)
  addSpace(); addDivider()
  addLine('WHAT I UNDERSTOOD', 10, true, true); addSpace(0.5)
  addLine(f.understood || 'See attached notes.')
  addSpace(); addDivider()
  addLine('INVESTMENT BREAKDOWN', 10, true, true); addSpace(0.5)
  validItems.forEach((item) => {
    addLine(item.description + '  —  $' + parseFloat(item.price).toLocaleString())
  })
  addSpace(0.5)
  addLine('TOTAL: $' + total.toLocaleString(), 12, true)
  addSpace(0.5)
  proposalPaymentLines({ ...currentTerms(f.payment_plan), deposit_pct: f.payment_plan === 'standard' ? STANDARD_DEPOSIT_PCT : parseFloat(f.deposit_pct) }, total).forEach((l) => addLine(l))
  addLine('Change orders and additional revisions: ' + additionalWorkSentence(parseFloat(f.hourly_rate) || STANDARD_HOURLY_RATE))
  addSpace(); addDivider()
  if (f.out_of_scope) {
    addLine('WHAT IS NOT INCLUDED', 10, true, true); addSpace(0.5)
    addLine(f.out_of_scope); addSpace(); addDivider()
  }
  const validMilestones = f.payment_plan === 'milestones' ? proposalMilestones.filter((m) => m.deliverables && m.fee) : []
  if (validMilestones.length > 0) {
    addLine('MILESTONE SCHEDULE', 10, true, true); addSpace(0.5)
    validMilestones.forEach((m, i) => {
      addLine('Milestone ' + (i + 1) + ': ' + m.name, 11, true)
      if (m.dueDate) addLine('Due: ' + new Date(m.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 10)
      addLine('Fee: $' + parseFloat(m.fee).toLocaleString(), 10)
      addLine(m.deliverables, 10)
      addSpace(0.5)
    })
    addDivider()
  }
  addLine('TIMELINE', 10, true, true); addSpace(0.5)
  addLine(f.timeline || 'See milestone schedule above.')
  addSpace(); addDivider()
  addLine('NEXT STEPS', 10, true, true); addSpace(0.5)
  addLine(f.next_steps)
  addSpace(); addDivider()
  addLine('SIGNATURES', 10, true, true); addSpace()
  addLine('Freelancer: Alante Velez'); addSpace()
  addLine('Date: ___________'); addSpace()
  addLine('Client: ' + f.client_name); addSpace()
  addLine('Date: ___________')
  save('Proposal_' + f.client_name.replace(/\s+/g, '_') + '_' + f.project_title.replace(/\s+/g, '_') + '.pdf')
}

/** Same builder, clauses, terms version, and payment schedule as the contract the client signs online. */
export function contractDoc(f: ContractForm) {
  const doc = contractPdf({
    client_name: f.client_name,
    client_email: f.client_email,
    client_business: f.client_business || null,
    project_title: f.project_title,
    project_type: f.project_type,
    start_date: f.start_date || null,
    delivery_date: f.delivery_date || null,
    kill_fee_pct: parseFloat(f.kill_fee_pct) || 25,
    ...contractTermsDoc(f),
  })
  doc.save('Contract_' + f.client_name.replace(/\s+/g, '_') + '.pdf')
}
