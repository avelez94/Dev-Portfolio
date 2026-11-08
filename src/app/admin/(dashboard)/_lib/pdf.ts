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
import { STANDARD_HOURLY_RATE, additionalWorkSentence, proposalPaymentLines } from '@/lib/terms'
import { checkSchedule, milestoneLabel, money, scheduleLines } from '@/lib/payment-schedule'
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
    return { doc: pdf.doc, addLine, addSpace, addDivider, finish: () => pdf.finish(), save: (name: string) => { pdf.finish(); pdf.doc.save(name) } }
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
  return { doc, addLine, addSpace, addDivider, finish: () => {}, save: (name: string) => doc.save(name) }
}

export type InvoiceFields = { invoice_number: string; due_date: string; service_desc: string; hours: string; hourly_rate: string }

/**
 * Invoice dates read "November 8, 2026". A plain YYYY-MM-DD (what the date
 * fields and the database store) is that calendar day in every time zone.
 * Anything that isn't a date (for example "Upon receipt") is kept as written.
 */
export function invoiceDate(value: string | null | undefined, fallback: string) {
  const s = (value || '').trim()
  if (!s) return fallback
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const amount = (n: number) => money(Number(n) || 0)

/** A line that only names the invoice type; the fixed fee layout prints that label itself. */
const TYPE_ONLY = /^(fixed[\s-]*fee\s*)?change[\s-]*order$|^fixed[\s-]*fee(\s+invoice)?$/i

/**
 * The SERVICE section of a fixed fee invoice, from the Description exactly as
 * entered: the first line is the service title and any further lines are the
 * scope. A single line is the title alone; nothing is added to it. A trailing
 * " — Change Order" on the title, or a line that only repeats the invoice
 * type, is dropped because the layout already says "Fixed-Fee Change Order".
 */
export function fixedFeeService(desc: string | null | undefined) {
  const lines = String(desc || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !TYPE_ONLY.test(l))
  const [first = '', ...scope] = lines
  const title = first.replace(/\s*[|:–—-]\s*(fixed[\s-]*fee\s*)?change[\s-]*order$/i, '').trim()
  return { title: title || 'Web development services', scope: scope.join('\n') }
}

/** Everything an invoice PDF needs, for any invoice type. */
export type InvoiceDoc = {
  type: string
  invoice_number: string
  due_date: string | null | undefined
  service_desc: string | null | undefined
  client_name: string
  client_email: string
  total_fee: number
  deposit_amount?: number
  hours?: string | number | null
  hourly_rate?: string | number | null
}

/**
 * One builder for every invoice type. The type decides the sections and the
 * billing language; nothing hourly ever appears unless the invoice is hourly.
 *   fixed_fee  SERVICE (title, "Fixed-Fee Change Order", scope), CHANGE ORDER (fixed fee, Total Due)
 *   project    SERVICE, PAYMENT BREAKDOWN (total, deposit now, balance on delivery)
 *   revision   SERVICE, REVISION BILLING (hours x rate, Total Due)
 *   milestone  SERVICE, MILESTONE SCHEDULE (schedule total; each milestone has its own invoice)
 *   other      SERVICE, AMOUNT DUE (hours shown only if the record has hours)
 */
export function buildInvoicePDF(v: InvoiceDoc, branded = true) {
  const pdf = makePDF(branded ? { docType: 'Invoice', title: 'Invoice #' + v.invoice_number, subtitle: 'Prepared for ' + v.client_name } : undefined)
  const { addLine, addSpace, addDivider } = pdf
  const total = Number(v.total_fee) || 0
  const hours = Number(v.hours) || 0
  addLine('INVOICE', 16, true, true)
  addLine('Alante Velez | Full Stack Web Developer', 10)
  addDivider(); addSpace()
  addLine('INVOICE #' + v.invoice_number, 12, true); addSpace(0.5)
  addLine('Due Date: ' + invoiceDate(v.due_date, 'Upon receipt'))
  addSpace(); addDivider()
  addLine('BILL TO', 10, true, true); addSpace(0.5)
  addLine(v.client_name)
  if (v.client_email) addLine(v.client_email)
  addSpace(); addDivider()
  addLine('SERVICE', 10, true, true); addSpace(0.5)
  if (v.type === 'fixed_fee') {
    const service = fixedFeeService(v.service_desc)
    addLine(service.title)
    addLine('Fixed-Fee Change Order', 9, true)
    if (service.scope) addLine(service.scope, 9.5)
    addSpace(); addDivider()
    addLine('CHANGE ORDER', 10, true, true); addSpace(0.5)
    addLine('Pricing: Fixed fee'); addSpace(0.5)
    addLine('Total Due: ' + amount(total), 12, true)
  } else {
    addLine(v.service_desc || 'Web development services')
    addSpace(); addDivider()
    if (v.type === 'project') {
      const deposit = Number(v.deposit_amount) || 0
      addLine('PAYMENT BREAKDOWN', 10, true, true); addSpace(0.5)
      addLine('Total Project Fee: $' + total.toLocaleString()); addSpace(0.5)
      addLine('Deposit Due Now (50%): $' + deposit.toLocaleString(), 11, true)
      addLine('Balance Due on Delivery (50%): $' + (total - deposit).toLocaleString(), 11, true)
      addSpace(0.5)
      addLine('Note: Final deliverables will be transferred upon receipt of the balance payment.', 10)
    } else if (v.type === 'revision') {
      addLine('REVISION BILLING', 10, true, true); addSpace(0.5)
      addLine('Hours: ' + v.hours + ' hrs x $' + v.hourly_rate + '/hr')
      addLine('Total Due: $' + total.toLocaleString(), 12, true)
    } else if (v.type === 'milestone') {
      addLine('MILESTONE SCHEDULE', 10, true, true); addSpace(0.5)
      addLine('Schedule total: ' + amount(total), 12, true)
      addSpace(0.5)
      addLine('Each milestone is invoiced separately with its own amount and due date.', 10)
    } else {
      addLine('AMOUNT DUE', 10, true, true); addSpace(0.5)
      if (hours > 0) addLine('Hours: ' + v.hours + ' hrs x $' + v.hourly_rate + '/hr')
      addLine('Total Due: ' + amount(total), 12, true)
    }
  }
  addSpace(); addDivider()
  addLine('PAYMENT', 10, true, true); addSpace(0.5)
  addLine('Stripe, PayPal, Zelle, or Wise')
  // Fixed fee invoices carry no reference line; the other types keep theirs.
  if (v.type !== 'fixed_fee') addLine('Reference: Invoice #' + v.invoice_number + ' | ' + v.client_name)
  return pdf
}

export const invoiceFileName = (invoiceNumber: string, clientName: string) => 'Invoice_' + invoiceNumber + '_' + clientName.replace(/\s+/g, '_') + '.pdf'

/** Builds and downloads any invoice type. */
export function invoicePDF(v: InvoiceDoc, branded = true) {
  buildInvoicePDF(v, branded).save(invoiceFileName(v.invoice_number, v.client_name))
}

/** Project (deposit / balance) and revision (hourly) invoices from the admin form. */
export function clientInvoicePDF(f: InvoiceFields, clientName: string, clientEmail: string, type: string, totalFee: number, depositAmount: number, branded = true) {
  invoicePDF({ type, invoice_number: f.invoice_number, due_date: f.due_date, service_desc: f.service_desc, client_name: clientName, client_email: clientEmail, total_fee: totalFee, deposit_amount: depositAmount, hours: f.hours, hourly_rate: f.hourly_rate }, branded)
}

/** Fixed fee (change order) invoices from the admin form: Total Fee is the Total Due. */
export function fixedFeePDF(f: { invoice_number: string; due_date: string; service_desc: string }, clientName: string, clientEmail: string, fee: number) {
  invoicePDF({ type: 'fixed_fee', invoice_number: f.invoice_number, due_date: f.due_date, service_desc: f.service_desc, client_name: clientName, client_email: clientEmail, total_fee: fee })
}

export function milestonePDF(clientName: string, clientEmail: string, milestone: InvoiceMilestone, invoiceNumber: string, totalCount: number, index: number) {
  // Existing milestone records: original layout unless created after the styling cutoff.
  const { addLine, addSpace, addDivider, save } = makePDF(brandedRecord(milestone) ? { docType: 'Invoice', title: 'Invoice #' + invoiceNumber, subtitle: milestoneLabel(milestone, index, totalCount) + ' for ' + clientName } : undefined)
  addLine('INVOICE', 16, true, true)
  addLine('Alante Velez | Full Stack Web Developer', 10)
  addDivider(); addSpace()
  addLine('INVOICE #' + invoiceNumber + '  |  ' + milestoneLabel(milestone, index, totalCount), 12, true); addSpace(0.5)
  addLine('Due Date: ' + invoiceDate(milestone.due_date, 'Upon completion'))
  addSpace(); addDivider()
  addLine('BILL TO', 10, true, true); addSpace(0.5)
  addLine(clientName); addLine(clientEmail)
  addSpace(); addDivider()
  addLine('MILESTONE', 10, true, true); addSpace(0.5)
  addLine(milestone.name, 12, true)
  if (milestone.deliverables) { addSpace(0.5); addLine(milestone.deliverables) }
  addSpace(); addDivider()
  addLine('PAYMENT', 10, true, true); addSpace(0.5)
  addLine('Amount due: ' + money(Number(milestone.fee)), 12, true)
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
  const check = checkSchedule(total, proposalMilestones)
  proposalPaymentLines(currentTerms(f.hourly_rate), total).forEach((l) => addLine(l))
  addLine('Change orders and additional revisions: ' + additionalWorkSentence(parseFloat(f.hourly_rate) || STANDARD_HOURLY_RATE))
  addSpace(); addDivider()
  if (f.out_of_scope) {
    addLine('WHAT IS NOT INCLUDED', 10, true, true); addSpace(0.5)
    addLine(f.out_of_scope); addSpace(); addDivider()
  }
  addLine('PAYMENT SCHEDULE', 10, true, true); addSpace(0.5)
  scheduleLines(check.schedule).forEach((l) => { addLine(l, 10); addSpace(0.3) })
  addSpace(); addDivider()
  addLine('TIMELINE', 10, true, true); addSpace(0.5)
  addLine(f.timeline || 'See the payment schedule above.')
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
