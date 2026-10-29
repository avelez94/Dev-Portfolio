/**
 * Invoice rules: creating each invoice type for one explicit client, marking
 * payments, and sending invoice emails. Moved unchanged from the single page
 * dashboard; every function takes the client it acts on as an argument.
 */
import { supabase } from '@/lib/supabase-admin-browser'
import { DOC_BRAND_VERSION, missingBrandColumn } from '@/lib/brand-version'
import { STANDARD_HOURLY_RATE } from '@/lib/terms'
import { MY_EMAIL, postJson } from './api'
import { clientInvoicePDF, fixedFeePDF } from './pdf'
import type { Invoice, InvoiceMilestone, PreviewDoc, Row } from './types'

export type ClientRef = { id: string; name: string; email: string }
export type InvoiceType = 'project' | 'revision' | 'milestone' | 'fixed_fee'
export type ClientInvoiceForm = { invoice_number: string; total_fee: string; deposit_amount: string; due_date: string; service_desc: string; hours: string; hourly_rate: string }
export type FixedFeeForm = { invoice_number: string; total_fee: string; due_date: string; service_desc: string }
export const blankClientInvoice = (): ClientInvoiceForm => ({ invoice_number: '', total_fee: '', deposit_amount: '', due_date: '', service_desc: '', hours: '', hourly_rate: String(STANDARD_HOURLY_RATE) })
export const blankFixedFee = (): FixedFeeForm => ({ invoice_number: '', total_fee: '', due_date: '', service_desc: '' })

const today = () => new Date().toISOString().split('T')[0]

/**
 * Saves new invoice rows stamped with the current document look. If the
 * brand_version column doesn't exist yet, saves them unstamped (they then
 * download in the original layout) rather than failing.
 */
export async function insertStamped(table: 'invoices' | 'invoice_milestones', rows: Record<string, unknown>[]) {
  const stamped = rows.map((r) => ({ ...r, brand_version: DOC_BRAND_VERSION }))
  const first = await supabase.from(table).insert(stamped).select()
  if (!first.error || !missingBrandColumn(first.error)) return first
  console.warn('brand_version column missing; run supabase/migrations/20261029_document_brand_version.sql')
  return supabase.from(table).insert(rows).select()
}

export async function sendInvoiceEmail(client: Pick<ClientRef, 'name' | 'email'>, inv: Invoice) {
  try {
    const totalFee = inv.total_fee || inv.amount
    const depositAmount = inv.deposit_amount || totalFee * 0.5
    await postJson('/api/invoices/send', {
      clientEmail: client.email, clientName: client.name, cc: MY_EMAIL,
      invoiceNumber: inv.invoice_number, invoiceType: inv.invoice_type,
      totalFee, depositAmount, dueDate: inv.due_date, serviceDesc: inv.service_desc,
      hours: inv.hours, hourlyRate: inv.hourly_rate,
    })
  } catch (e) { console.error(e) }
}

export async function sendMilestoneEmail(client: Pick<ClientRef, 'name' | 'email'>, milestone: InvoiceMilestone, invoiceNumber: string, totalCount: number, index: number) {
  try {
    await postJson('/api/invoices/send', {
      clientEmail: client.email, clientName: client.name, cc: MY_EMAIL,
      invoiceNumber: invoiceNumber + ' (Milestone ' + (index + 1) + ' of ' + totalCount + ')',
      invoiceType: 'milestone', totalFee: milestone.fee, depositAmount: milestone.fee, dueDate: milestone.due_date,
      serviceDesc: milestone.name + (milestone.deliverables ? '\n' + milestone.deliverables : ''),
    })
  } catch (e) { console.error(e) }
}

/** Project (deposit and balance) or revision (hourly) invoice. Returns false when required fields are missing. */
export async function createClientInvoice(client: ClientRef, type: 'project' | 'revision', f: ClientInvoiceForm, action: 'download' | 'send') {
  if (!f.invoice_number) return false
  const isProject = type === 'project'
  if (isProject && !f.total_fee) return false
  if (!isProject && !f.hours) return false
  const totalFee = isProject ? parseFloat(f.total_fee) : parseFloat(f.hours) * parseFloat(f.hourly_rate)
  const depositAmount = isProject ? parseFloat(f.deposit_amount || String(totalFee * 0.5)) : 0
  const { data: insertedRows } = await insertStamped('invoices', [{
    client_id: client.id, invoice_number: f.invoice_number, invoice_type: type,
    total_fee: totalFee, deposit_amount: depositAmount, amount: totalFee,
    due_date: f.due_date || null, service_desc: f.service_desc || null,
    hours: isProject ? 0 : parseFloat(f.hours), hourly_rate: isProject ? STANDARD_HOURLY_RATE : parseFloat(f.hourly_rate),
    status: isProject ? 'awaiting_deposit' : 'pending',
  }])
  const inserted = insertedRows?.[0] as Invoice | undefined
  if (action === 'download') clientInvoicePDF(f, client.name, client.email, type, totalFee, depositAmount)
  else if (inserted) await sendInvoiceEmail(client, inserted)
  return true
}

export async function createFixedFeeInvoice(client: ClientRef, f: FixedFeeForm, action: 'download' | 'send') {
  if (!f.invoice_number || !f.total_fee) return false
  const fee = parseFloat(f.total_fee)
  const { data: invRows } = await insertStamped('invoices', [{
    client_id: client.id, invoice_number: f.invoice_number, invoice_type: 'fixed_fee',
    total_fee: fee, deposit_amount: fee, amount: fee, due_date: f.due_date || null, service_desc: f.service_desc || null, status: 'pending',
  }])
  const inv = invRows?.[0] as Invoice | undefined
  if (action === 'download') fixedFeePDF(f, client.name, fee)
  else if (inv) await sendInvoiceEmail(client, inv)
  return true
}

export async function createMilestoneInvoice(client: ClientRef, sow: Row | undefined, invoiceNumber: string) {
  if (!sow?.line_items?.length || !invoiceNumber) return false
  const totalFee = sow.line_items.reduce((sum: number, m: Row) => sum + parseFloat(m.fee || '0'), 0)
  const { data: invRows } = await insertStamped('invoices', [{
    client_id: client.id, invoice_number: invoiceNumber, invoice_type: 'milestone',
    total_fee: totalFee, deposit_amount: 0, amount: totalFee, sow_id: sow.id, status: 'pending', service_desc: sow.project_title,
  }])
  const inv = invRows?.[0]
  if (!inv) return false
  await insertStamped('invoice_milestones', sow.line_items.map((m: Row) => ({
    invoice_id: inv.id, name: m.name, deliverables: m.deliverables || null, due_date: m.dueDate || null, fee: parseFloat(m.fee || '0'), status: 'pending',
  })))
  return true
}

/** Project invoices step from awaiting deposit to deposit paid to paid; everything else goes straight to paid. */
export async function markInvoicePaid(inv: Invoice) {
  if (inv.invoice_type === 'project' && inv.status === 'awaiting_deposit') {
    await supabase.from('invoices').update({ status: 'deposit_paid', deposit_paid_date: today() }).eq('id', inv.id)
  } else {
    await supabase.from('invoices').update({ status: 'paid', paid_date: today() }).eq('id', inv.id)
  }
}

export async function markMilestonePaid(milestone: InvoiceMilestone) {
  await supabase.from('invoice_milestones').update({ status: 'paid', paid_date: today() }).eq('id', milestone.id)
}

export function invoicePreview(f: ClientInvoiceForm, client: Pick<ClientRef, 'name' | 'email'>, type: string, totalFee: number, depositAmount: number): PreviewDoc {
  const isProject = type === 'project'
  return {
    title: 'Invoice #' + f.invoice_number + ' — ' + client.name,
    sections: [
      { label: 'Bill to', value: client.name + '\n' + client.email },
      { label: 'Service', value: f.service_desc || 'Web development services' },
      { label: 'Invoice type', value: isProject ? 'Project Invoice' : 'Revision Invoice' },
      ...(isProject ? [
        { label: 'Total fee', value: '$' + totalFee.toLocaleString() },
        { label: 'Deposit due now (50%)', value: '$' + depositAmount.toLocaleString() },
        { label: 'Balance due on delivery', value: '$' + (totalFee - depositAmount).toLocaleString() },
      ] : [
        { label: 'Hours', value: f.hours + 'h x $' + f.hourly_rate + '/hr' },
        { label: 'Total due', value: '$' + totalFee.toLocaleString() },
      ]),
      { label: 'Due date', value: f.due_date || 'Upon receipt' },
      { label: 'Payment', value: 'Stripe, PayPal, Zelle, or Wise' },
    ],
  }
}

export const INVOICE_STATUS_LABEL: Record<string, string> = { awaiting_deposit: 'Awaiting Deposit', deposit_paid: 'Deposit Paid', paid: 'Paid in Full' }
export const invoiceStatusLabel = (s: string) => INVOICE_STATUS_LABEL[s] || 'Pending'
export const invoiceTypeLabel = (t: string) => (t === 'revision' ? 'Revision Invoice' : t === 'fixed_fee' ? 'Fixed Fee Invoice' : t === 'milestone' ? 'Milestone Schedule' : 'Project Invoice')

/** Totals for the Revenue page, computed exactly as before. */
export function revenueTotals(invoices: Invoice[], projects: { value: number; platform: string }[]) {
  const now = new Date()
  const paidOn = (i: Invoice) => (i.paid_date || i.deposit_paid_date) as string
  const totalEarned = invoices.filter((i) => i.status === 'paid' || i.status === 'deposit_paid').reduce((s, i) => (i.status === 'paid' ? s + i.total_fee : s + (i.deposit_amount || i.total_fee * 0.5)), 0)
  const totalOutstanding = invoices.filter((i) => i.status === 'pending' || i.status === 'awaiting_deposit' || i.status === 'deposit_paid').reduce((s, i) => {
    if (i.status === 'deposit_paid') return s + ((i.total_fee || 0) - (i.deposit_amount || 0))
    return s + (i.total_fee || i.amount)
  }, 0)
  const thisMonth = invoices.filter((i) => (i.status === 'paid' || i.status === 'deposit_paid') && paidOn(i) && new Date(paidOn(i)).getMonth() === now.getMonth() && new Date(paidOn(i)).getFullYear() === now.getFullYear())
    .reduce((s, i) => (i.status === 'paid' ? s + (i.total_fee || i.amount) : s + (i.deposit_amount || 0)), 0)
  const avgProject = projects.length > 0 ? projects.reduce((s, p) => s + p.value, 0) / projects.length : 0
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(); dt.setMonth(dt.getMonth() - 5 + i)
    const m = dt.getMonth(), y = dt.getFullYear()
    const total = invoices.filter((inv) => inv.status === 'paid' && inv.paid_date && new Date(inv.paid_date).getMonth() === m && new Date(inv.paid_date).getFullYear() === y).reduce((s, inv) => s + (inv.total_fee || inv.amount), 0)
    return { month: m, year: y, value: total }
  })
  const direct = projects.filter((p) => p.platform === 'direct').reduce((s, p) => s + p.value, 0)
  const referral = projects.filter((p) => p.platform === 'referral').reduce((s, p) => s + p.value, 0)
  return { totalEarned, totalOutstanding, thisMonth, avgProject, monthly, direct, referral }
}
