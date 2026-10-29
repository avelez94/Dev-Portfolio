/**
 * Proposal and contract rules for the Documents page: form shapes and
 * defaults, the payment terms stamped on each document, previews, and the
 * send requests. Moved unchanged from the single page dashboard.
 */
import { STANDARD_DEPOSIT_PCT, STANDARD_HOURLY_RATE, TERMS_VERSION, additionalWorkSentence, contractPaymentClausePdf, contractWarrantyClausePdf, proposalPaymentLines, type PaymentPlan } from '@/lib/terms'
import { MY_EMAIL, apiError, postJson } from './api'
import type { PreviewDoc } from './types'

export const CURRENT_TERMS = { terms_version: TERMS_VERSION, hourly_rate: STANDARD_HOURLY_RATE }
export const currentTerms = (plan: string) => ({ ...CURRENT_TERMS, payment_plan: plan })
export const PROJECT_TYPES = ['Landing Page', 'Booking + Payments', 'Web Application', 'AI Workflow', 'Other']

export type LineItem = { description: string; price: string }
export type MilestoneDraft = { name: string; deliverables: string; dueDate: string; fee: string }
export type ProposalForm = {
  client_name: string; client_email: string; client_business: string
  project_title: string; project_type: string; understood: string
  out_of_scope: string; deposit_pct: string; timeline: string
  next_steps: string; message: string; start_date: string
  delivery_date: string; revisions: string; hourly_rate: string
  payment_method: string; payment_plan: string
}
export type ContractForm = {
  client_name: string; client_email: string; client_business: string
  project_title: string; project_type: string
  start_date: string; delivery_date: string; total_fee: string
  deposit: string; balance: string; kill_fee_pct: string; payment_method: string; payment_plan: string
  invoice_number: string; invoice_service_desc: string; invoice_due_date: string
}

export const blankContract = (): ContractForm => ({
  client_name: '', client_email: '', client_business: '',
  project_title: '', project_type: 'Landing Page',
  start_date: '', delivery_date: '', total_fee: '',
  deposit: '', balance: '', kill_fee_pct: '25',
  payment_method: 'Stripe, PayPal, Zelle, or Wise', payment_plan: 'standard',
  invoice_number: '', invoice_service_desc: '', invoice_due_date: '',
})

export const contractTermsDoc = (f: { total_fee: string; deposit: string; balance: string; payment_method: string; payment_plan: string }) => {
  const total = parseFloat(f.total_fee) || 0
  const standard = f.payment_plan !== 'milestones'
  const deposit = standard ? total * (STANDARD_DEPOSIT_PCT / 100) : parseFloat(f.deposit) || 0
  return { ...currentTerms(standard ? 'standard' : 'milestones'), total_fee: total, deposit, balance: standard ? total - deposit : parseFloat(f.balance) || 0, payment_method: f.payment_method }
}

/* ---------- Proposal draft, saved in this browser while it's being written ---------- */

const read = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key)
    if (saved) return JSON.parse(saved)
  } catch { /* storage unavailable */ }
  return fallback
}
const write = (key: string, val: unknown) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* storage unavailable */ } }

export function savedProposalForm(): ProposalForm {
  const parsed = read<ProposalForm | null>('proposalForm', null)
  if (parsed) {
    // Drafts saved under the old $65 default pick up the standard rate.
    if (parsed.hourly_rate === '65') parsed.hourly_rate = String(STANDARD_HOURLY_RATE)
    if (parsed.payment_plan !== 'standard' && parsed.payment_plan !== 'milestones') parsed.payment_plan = 'standard'
    return parsed
  }
  return {
    client_name: '', client_email: '', client_business: '',
    project_title: '', project_type: 'Landing Page',
    understood: '', out_of_scope: '',
    deposit_pct: '50', timeline: '',
    next_steps: 'Once you accept this proposal, I will send the contract for your signature. Once signed, your deposit invoice will follow to officially kick things off.',
    message: '', start_date: '', delivery_date: '',
    revisions: '2', hourly_rate: String(STANDARD_HOURLY_RATE),
    payment_method: 'Stripe, PayPal, Zelle, or Wise',
    payment_plan: 'standard',
  }
}
export const savedLineItems = () => read<LineItem[]>('proposalLineItems', [{ description: '', price: '' }])
export const savedMilestones = () => read<MilestoneDraft[]>('proposalMilestones', [{ name: 'Milestone 1', deliverables: '', dueDate: '', fee: '' }])
export const saveProposalDraft = { form: (v: ProposalForm) => write('proposalForm', v), items: (v: LineItem[]) => write('proposalLineItems', v), milestones: (v: MilestoneDraft[]) => write('proposalMilestones', v) }

/* ---------- Previews ---------- */

export function proposalPreview(f: ProposalForm, lineItems: LineItem[]): PreviewDoc {
  const validItems = lineItems.filter((i) => i.description && i.price)
  const total = validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
  const itemsText = validItems.length > 0
    ? validItems.map((i) => i.description + '  —  $' + parseFloat(i.price).toLocaleString()).join('\n') + '\n\nTotal: $' + total.toLocaleString()
    : 'No line items added yet.'
  return {
    title: 'Project Proposal — ' + (f.project_title || 'Untitled'),
    sections: [
      { label: 'Prepared for', value: [f.client_name, f.client_email, f.client_business].filter(Boolean).join('\n') },
      { label: 'Project', value: f.project_title + ' (' + f.project_type + ')' },
      { label: 'What I understood', value: f.understood || 'See attached notes.' },
      { label: 'Investment breakdown', value: itemsText },
      { label: 'Payment schedule', value: proposalPaymentLines({ ...currentTerms(f.payment_plan), deposit_pct: f.payment_plan === 'standard' ? STANDARD_DEPOSIT_PCT : parseFloat(f.deposit_pct) }, total).join('\n') },
      ...(f.out_of_scope ? [{ label: 'What is not included', value: f.out_of_scope }] : []),
      { label: 'Timeline', value: f.timeline || 'To be confirmed in SOW.' },
      { label: 'Next steps', value: f.next_steps },
    ],
  }
}

export function contractPreview(f: ContractForm): PreviewDoc {
  return {
    title: 'Freelance Contract — ' + (f.project_title || 'Untitled'),
    sections: [
      { label: 'Client', value: [f.client_name, f.client_email, f.client_business].filter(Boolean).join('\n') },
      { label: 'Project', value: f.project_title + ' (' + f.project_type + ')' },
      { label: 'Dates', value: 'Start: ' + (f.start_date || 'TBD') + '  |  Delivery: ' + (f.delivery_date || 'TBD') },
      { label: 'Total fee', value: f.total_fee ? '$' + f.total_fee : 'TBD' },
      { label: 'Payment', value: contractPaymentClausePdf(contractTermsDoc(f)) },
      { label: 'Kill fee', value: f.kill_fee_pct + '% of total fee if cancelled after work begins' },
      { label: 'Payment method', value: f.payment_method },
      { label: 'Revisions', value: '2 rounds included. ' + additionalWorkSentence() },
      { label: 'Defects after launch', value: contractWarrantyClausePdf(CURRENT_TERMS) },
      { label: 'Governing law', value: 'State of Maryland' },
    ],
  }
}

/* ---------- Sending ---------- */

export type SendResult = { ok: true } | { ok: false; message: string }

/** The document was saved but the email didn't send: say so, with the link to share by hand. */
async function emailFailedMessage(res: Response, name: string) {
  const data = await res.json().catch(() => ({}))
  if (data?.emailed !== false) return null
  return `${name} saved, but the email didn't send. Share this link with the client yourself: ${data.url || 'open it from the documents list'}`
}

export async function sendProposal(f: ProposalForm, lineItems: LineItem[], proposalMilestones: MilestoneDraft[]): Promise<SendResult> {
  const plan = (f.payment_plan === 'milestones' ? 'milestones' : 'standard') as PaymentPlan
  const validItems = lineItems.filter((i) => i.description && i.price)
  const total = validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
  const depositPct = plan === 'standard' ? STANDARD_DEPOSIT_PCT : parseFloat(f.deposit_pct)
  const deposit = total * (depositPct / 100)
  const balance = total - deposit
  const validMilestones = plan === 'milestones' ? proposalMilestones.filter((m) => m.deliverables && m.fee) : []
  if (plan === 'milestones') {
    const milestoneTotal = validMilestones.reduce((s, m) => s + (parseFloat(m.fee) || 0), 0)
    if (validMilestones.length === 0) return { ok: false, message: 'A milestone payment schedule needs at least one milestone with deliverables and a fee.' }
    if (balance > 0 && Math.round(milestoneTotal) !== Math.round(balance)) {
      return { ok: false, message: `Milestone total ($${milestoneTotal.toLocaleString()}) must equal the balance after deposit ($${balance.toLocaleString()}).` }
    }
  }
  try {
    const res = await postJson('/api/proposals', {
      clientEmail: f.client_email, clientName: f.client_name, clientBusiness: f.client_business,
      projectTitle: f.project_title, projectType: f.project_type, understood: f.understood,
      lineItems: validItems, milestones: validMilestones, total, outOfScope: f.out_of_scope,
      depositPct: String(depositPct), paymentPlan: plan, timeline: f.timeline,
      startDate: f.start_date, deliveryDate: f.delivery_date, revisions: f.revisions,
      hourlyRate: parseFloat(f.hourly_rate), nextSteps: f.next_steps, message: f.message, cc: MY_EMAIL,
    })
    if (!res.ok) return { ok: false, message: await apiError(res) }
    const failed = await emailFailedMessage(res, 'Proposal')
    return failed ? { ok: false, message: failed } : { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Could not reach the server. Nothing was sent.' }
  }
}

export async function sendContract(f: ContractForm): Promise<SendResult> {
  const plan = (f.payment_plan === 'milestones' ? 'milestones' : 'standard') as PaymentPlan
  const totalFee = parseFloat(f.total_fee) || 0
  const deposit = plan === 'standard' ? totalFee * (STANDARD_DEPOSIT_PCT / 100) : parseFloat(f.deposit) || 0
  const balance = plan === 'standard' ? totalFee - deposit : parseFloat(f.balance) || 0
  try {
    const res = await postJson('/api/contracts', {
      clientName: f.client_name, clientEmail: f.client_email, clientBusiness: f.client_business,
      projectTitle: f.project_title, projectType: f.project_type, startDate: f.start_date, deliveryDate: f.delivery_date,
      totalFee, deposit, balance, paymentPlan: plan, killFeePct: parseFloat(f.kill_fee_pct) || 25,
      paymentMethod: f.payment_method, lineItems: [], invoiceNumber: f.invoice_number,
      invoiceServiceDesc: f.invoice_service_desc, invoiceDueDate: f.invoice_due_date,
    })
    if (!res.ok) return { ok: false, message: await apiError(res) }
    const failed = await emailFailedMessage(res, 'Contract')
    return failed ? { ok: false, message: failed } : { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Could not reach the server. Nothing was sent.' }
  }
}

export async function resendSignedContract(contractId: string) {
  try {
    const res = await postJson('/api/contracts/send-signed', { contractId })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    alert('Signed contract PDF sent successfully.')
  } catch (e) { alert('Failed to send. Check console.'); console.error(e) }
}

/** Fills the contract from an accepted proposal, with a deposit invoice due in 7 days. */
export function contractFromProposal(p: Record<string, any>, current: ContractForm): ContractForm { // eslint-disable-line @typescript-eslint/no-explicit-any
  const now = new Date()
  const invNum = 'INV-' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + p.client_name.split(' ')[0].toUpperCase()
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const deposit = p.total * (p.deposit_pct / 100)
  return {
    ...current,
    client_name: p.client_name, client_email: p.client_email, client_business: p.client_business || '',
    project_title: p.project_title, project_type: p.project_type, start_date: '', delivery_date: '',
    total_fee: String(p.total), deposit: String(deposit), balance: String(p.total - deposit),
    payment_plan: p.payment_plan === 'standard' ? 'standard' : p.payment_plan === 'milestones' ? 'milestones' : current.payment_plan,
    invoice_number: invNum, invoice_service_desc: p.project_title + ' — Deposit to begin', invoice_due_date: sevenDays,
  }
}
