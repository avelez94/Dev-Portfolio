/**
 * Proposal and contract rules for the Documents page: form shapes and
 * defaults, the payment terms stamped on each document, previews, and the
 * send requests.
 *
 * New documents use the current terms (src/lib/terms.ts): the standard hourly
 * rate unless you enter an agreed one, and a 50% deposit with the remaining
 * 50% across milestones you define (src/lib/payment-schedule.ts). The API
 * routes check the schedule again before anything is saved or sent.
 */
import { STANDARD_HOURLY_RATE, TERMS_VERSION, additionalWorkSentence, contractPaymentClausePdf, contractWarrantyClausePdf, proposalPaymentLines } from '@/lib/terms'
import { checkSchedule, scheduleLines, storedMilestones } from '@/lib/payment-schedule'
import { MY_EMAIL, apiError, postJson } from './api'
import type { PreviewDoc } from './types'

export const PAYMENT_PLAN = 'milestone_balance'
export const CURRENT_TERMS = { terms_version: TERMS_VERSION, hourly_rate: STANDARD_HOURLY_RATE, payment_plan: PAYMENT_PLAN }
export const currentTerms = (rate?: string | number) => ({ ...CURRENT_TERMS, hourly_rate: Number(rate) > 0 ? Number(rate) : STANDARD_HOURLY_RATE })
/** Project types for new documents. Documents keep the type they were issued with. */
export const PROJECT_TYPES = ['Business Website', 'Booking & Payments', 'Custom Website or Application', 'Custom Automations & AI Integrations', 'Other']
/** Rates that were the standard default at some point. An unsent draft still holding one picks up the current rate. */
const OLD_DEFAULT_RATES = ['65', '75', '100']

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
  milestones: MilestoneDraft[]; hourly_rate: string; proposal_id: string
  kill_fee_pct: string; payment_method: string
  invoice_number: string; invoice_service_desc: string; invoice_due_date: string
}

export const blankMilestone = (n: number): MilestoneDraft => ({ name: 'Milestone ' + n, deliverables: '', dueDate: '', fee: '' })

export const blankContract = (): ContractForm => ({
  client_name: '', client_email: '', client_business: '',
  project_title: '', project_type: PROJECT_TYPES[0],
  start_date: '', delivery_date: '', total_fee: '',
  milestones: [blankMilestone(1)], hourly_rate: String(STANDARD_HOURLY_RATE), proposal_id: '',
  kill_fee_pct: '25', payment_method: 'Stripe, PayPal, Zelle, or Wise',
  invoice_number: '', invoice_service_desc: '', invoice_due_date: '',
})

/** The contract as it will be stored and shown: current terms, the agreed rate, and the checked schedule. */
export const contractTermsDoc = (f: Pick<ContractForm, 'total_fee' | 'milestones' | 'payment_method' | 'hourly_rate'>) => {
  const { schedule } = checkSchedule(f.total_fee, f.milestones)
  return { ...currentTerms(f.hourly_rate), total_fee: schedule.total, deposit: schedule.deposit, balance: schedule.balance, line_items: schedule.milestones, payment_method: f.payment_method }
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
    // Unsent drafts holding an earlier default rate pick up the current one, and the current payment policy.
    if (OLD_DEFAULT_RATES.includes(String(parsed.hourly_rate))) parsed.hourly_rate = String(STANDARD_HOURLY_RATE)
    parsed.payment_plan = PAYMENT_PLAN
    parsed.deposit_pct = '50'
    return parsed
  }
  return {
    client_name: '', client_email: '', client_business: '',
    project_title: '', project_type: PROJECT_TYPES[0],
    understood: '', out_of_scope: '',
    deposit_pct: '50', timeline: '',
    next_steps: 'Once you accept this proposal, I will send the contract for your signature. Once signed, your deposit invoice will follow to officially kick things off.',
    message: '', start_date: '', delivery_date: '',
    revisions: '2', hourly_rate: String(STANDARD_HOURLY_RATE),
    payment_method: 'Stripe, PayPal, Zelle, or Wise',
    payment_plan: PAYMENT_PLAN,
  }
}
export const savedLineItems = () => read<LineItem[]>('proposalLineItems', [{ description: '', price: '' }])
export const savedMilestones = () => read<MilestoneDraft[]>('proposalMilestones', [blankMilestone(1)])
export const saveProposalDraft = { form: (v: ProposalForm) => write('proposalForm', v), items: (v: LineItem[]) => write('proposalLineItems', v), milestones: (v: MilestoneDraft[]) => write('proposalMilestones', v) }

/* ---------- Previews ---------- */

const proposalTotal = (lineItems: LineItem[]) => lineItems.filter((i) => i.description && i.price).reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)

/** Schedule problems for the proposal as it stands (empty when it's ready to send). */
export function proposalScheduleProblems(lineItems: LineItem[], milestones: MilestoneDraft[]) {
  return checkSchedule(proposalTotal(lineItems), milestones).problems
}

export function proposalPreview(f: ProposalForm, lineItems: LineItem[], milestones: MilestoneDraft[] = []): PreviewDoc {
  const validItems = lineItems.filter((i) => i.description && i.price)
  const total = proposalTotal(lineItems)
  const check = checkSchedule(total, milestones)
  const itemsText = validItems.length > 0
    ? validItems.map((i) => i.description + ':  $' + parseFloat(i.price).toLocaleString()).join('\n') + '\n\nTotal: $' + total.toLocaleString()
    : 'No line items added yet.'
  return {
    title: 'Project Proposal: ' + (f.project_title || 'Untitled'),
    sections: [
      { label: 'Prepared for', value: [f.client_name, f.client_email, f.client_business].filter(Boolean).join('\n') },
      { label: 'Project', value: f.project_title + ' (' + f.project_type + ')' },
      { label: 'What I understood', value: f.understood || 'See attached notes.' },
      { label: 'Investment breakdown', value: itemsText },
      { label: 'Payment schedule', value: [...proposalPaymentLines(currentTerms(f.hourly_rate), total), '', ...scheduleLines(check.schedule)].join('\n') + (check.ok ? '' : '\n\nStill to fix before sending:\n' + check.problems.join('\n')) },
      { label: 'Additional work', value: additionalWorkSentence(Number(f.hourly_rate) || STANDARD_HOURLY_RATE) },
      ...(f.out_of_scope ? [{ label: 'What is not included', value: f.out_of_scope }] : []),
      { label: 'Timeline', value: f.timeline || 'To be confirmed in SOW.' },
      { label: 'Next steps', value: f.next_steps },
    ],
  }
}

export function contractPreview(f: ContractForm): PreviewDoc {
  const doc = contractTermsDoc(f)
  const check = checkSchedule(f.total_fee, f.milestones)
  return {
    title: 'Freelance Contract: ' + (f.project_title || 'Untitled'),
    sections: [
      { label: 'Client', value: [f.client_name, f.client_email, f.client_business].filter(Boolean).join('\n') },
      { label: 'Project', value: f.project_title + ' (' + f.project_type + ')' },
      { label: 'Dates', value: 'Start: ' + (f.start_date || 'TBD') + '  |  Delivery: ' + (f.delivery_date || 'TBD') },
      { label: 'Total fee', value: f.total_fee ? '$' + f.total_fee : 'TBD' },
      { label: 'Payment', value: contractPaymentClausePdf(doc) + (check.ok ? '' : '\n\nStill to fix before sending:\n' + check.problems.join('\n')) },
      { label: 'Kill fee', value: f.kill_fee_pct + '% of total fee if cancelled after work begins' },
      { label: 'Payment method', value: f.payment_method },
      { label: 'Revisions', value: '2 rounds included. ' + additionalWorkSentence(Number(f.hourly_rate) || STANDARD_HOURLY_RATE) },
      { label: 'Defects after launch', value: contractWarrantyClausePdf(CURRENT_TERMS) },
      { label: 'Governing law', value: 'State of Maryland' },
    ],
  }
}

/** The client record whose email matches exactly (one match only), for linking the invoice schedule. */
export function linkedClient<T extends { email?: string | null }>(clients: T[], email: string): T | null {
  const e = email.trim().toLowerCase()
  if (!e) return null
  const hits = clients.filter((c) => (c.email || '').trim().toLowerCase() === e)
  return hits.length === 1 ? hits[0] : null
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
  const validItems = lineItems.filter((i) => i.description && i.price)
  const total = proposalTotal(lineItems)
  const check = checkSchedule(total, proposalMilestones)
  if (!check.ok) return { ok: false, message: check.problems.join(' ') }
  try {
    const res = await postJson('/api/proposals', {
      clientEmail: f.client_email, clientName: f.client_name, clientBusiness: f.client_business,
      projectTitle: f.project_title, projectType: f.project_type, understood: f.understood,
      lineItems: validItems, milestones: check.schedule.milestones, total: check.schedule.total, outOfScope: f.out_of_scope,
      paymentPlan: PAYMENT_PLAN, timeline: f.timeline,
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

export async function sendContract(f: ContractForm, clientId?: string | null): Promise<SendResult> {
  const check = checkSchedule(f.total_fee, f.milestones)
  if (!check.ok) return { ok: false, message: check.problems.join(' ') }
  const s = check.schedule
  try {
    const res = await postJson('/api/contracts', {
      clientName: f.client_name, clientEmail: f.client_email, clientBusiness: f.client_business,
      projectTitle: f.project_title, projectType: f.project_type, startDate: f.start_date, deliveryDate: f.delivery_date,
      totalFee: s.total, deposit: s.deposit, balance: s.balance, milestones: s.milestones, paymentPlan: PAYMENT_PLAN,
      hourlyRate: parseFloat(f.hourly_rate), clientId: clientId || null, killFeePct: parseFloat(f.kill_fee_pct) || 25,
      paymentMethod: f.payment_method, invoiceNumber: f.invoice_number,
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

/**
 * Fills the contract from an accepted proposal: its agreed rate and, for
 * proposals on the current terms, its milestone schedule (from the linked
 * SOW). The deposit invoice is due in 7 days.
 */
export function contractFromProposal(p: Record<string, any>, current: ContractForm, sowMilestones?: unknown): ContractForm { // eslint-disable-line @typescript-eslint/no-explicit-any
  const now = new Date()
  const invNum = 'INV-' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + p.client_name.split(' ')[0].toUpperCase()
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const ms = storedMilestones(sowMilestones)
  return {
    ...current,
    client_name: p.client_name, client_email: p.client_email, client_business: p.client_business || '',
    project_title: p.project_title, project_type: p.project_type, start_date: '', delivery_date: '',
    total_fee: String(p.total),
    milestones: ms.length ? ms.map((m) => ({ name: m.name, deliverables: m.deliverables, dueDate: m.dueDate || '', fee: String(m.fee) })) : [blankMilestone(1)],
    hourly_rate: String(Number(p.hourly_rate) > 0 ? p.hourly_rate : STANDARD_HOURLY_RATE),
    proposal_id: p.id || '',
    invoice_number: invNum, invoice_service_desc: p.project_title + ': deposit to begin', invoice_due_date: sevenDays,
  }
}
