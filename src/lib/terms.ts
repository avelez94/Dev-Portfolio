/**
 * Reusable wording for additional work and payments in proposals, SOWs, and
 * contracts.
 *
 * Every document is stamped with the terms version it was issued under, in its
 * `terms_version` column (see supabase/migrations/20261028_terms_version.sql),
 * and renders that version's wording, word for word, from then on:
 *
 *   no stamp                  the original wording ($65 an hour, milestones)
 *   2026-10-standard-rate     the standard rate stored on the document, with a
 *                             50/50 "standard" plan or a "milestones" plan
 *   2026-11-milestone-balance the current terms: $70 an hour (or the rate
 *                             agreed and stored on the document) with a one
 *                             hour minimum or an agreed fixed quote, and a 50%
 *                             deposit with the remaining 50% across milestones
 *
 * So issued proposals, signed agreements, and their invoices never change
 * after the fact.
 *
 * Client facing wording rule: no dashes in the current wording.
 */

import { depositCents, formatDue, money, storedMilestones } from './payment-schedule'

export const TERMS_VERSION = '2026-11-milestone-balance'
/** The October 2026 terms. Documents stamped with it keep its wording and payment plan. */
export const PREVIOUS_TERMS_VERSION = '2026-10-standard-rate'

/** The approved rate for new hourly work (November 2026). Documents keep the rate stored on them. */
export const STANDARD_HOURLY_RATE = 70

/** Rate stored on documents issued before the standard rate. Legacy text only. */
const LEGACY_HOURLY_RATE = 65

/** The approved project payment policy (November 2026), shown on new documents and the public site. */
export const PROJECT_PAYMENT_POLICY =
  'A 50% deposit is due before work begins. The remaining 50% is divided across the project milestones listed in your proposal and agreement.'

type Versioned = { terms_version?: string | null; hourly_rate?: number | string | null } | null | undefined

/** Stamped with the standard rate terms or later (not the original wording). */
export function usesCurrentTerms(doc: Versioned): boolean {
  return doc?.terms_version === TERMS_VERSION || doc?.terms_version === PREVIOUS_TERMS_VERSION
}

/** Issued under the current terms (the milestone payment policy and fixed quote wording). */
export function usesLatestTerms(doc: Versioned): boolean {
  return doc?.terms_version === TERMS_VERSION
}

function rateOf(doc: Versioned): number {
  const n = Number(doc?.hourly_rate)
  return Number.isFinite(n) && n > 0 ? n : STANDARD_HOURLY_RATE
}

export function formatRate(rate: number): string {
  return `$${rate.toLocaleString('en-US')}/hr`
}

/** One sentence for new documents: rate, minimum, fixed quote, and approval. */
export function additionalWorkSentence(rate: number = STANDARD_HOURLY_RATE): string {
  return `Additional work is billed at ${formatRate(rate)} with a one hour minimum, or at a fixed quote we agree on, and an estimate is approved before work begins.`
}

/** Public wording for hourly work, from the same rate. */
export function hourlyWorkSentence(rate: number = STANDARD_HOURLY_RATE): string {
  return `$${rate} an hour with a one hour minimum, or a fixed quote we agree on`
}

/* ---- Contract clauses ---------------------------------------------- */

export function contractServicesClause(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) {
    return `Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires written approval and will be billed at $${LEGACY_HOURLY_RATE}/hr.`
  }
  if (usesLatestTerms(doc)) {
    return `Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires a written estimate approved by Client before it begins, and is billed at ${formatRate(rateOf(doc))} with a one hour minimum, or at a fixed quote the parties agree on in writing.`
  }
  return `Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires a written estimate approved by Client before it begins, and is billed at ${formatRate(rateOf(doc))} with a one hour minimum.`
}

/** Revisions clause as shown on the contract signing page. */
export function contractRevisionsClausePage(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) {
    return `Project includes 2 rounds of revisions. One revision round equals one consolidated list of feedback submitted at one time, not ongoing back-and-forth. Additional revisions are billed at $${LEGACY_HOURLY_RATE}/hr and require written approval before proceeding.`
  }
  if (usesLatestTerms(doc)) {
    return `Project includes 2 rounds of revisions. One revision round equals one consolidated list of feedback submitted at one time. Additional revisions require a written estimate approved by Client before work begins, and are billed at ${formatRate(rateOf(doc))} with a one hour minimum, or at a fixed quote the parties agree on in writing.`
  }
  return `Project includes 2 rounds of revisions. One revision round equals one consolidated list of feedback submitted at one time. Additional revisions require a written estimate approved by Client before work begins, and are billed at ${formatRate(rateOf(doc))} with a one hour minimum.`
}

/** Revisions clause as written into the signed contract PDF. */
export function contractRevisionsClausePdf(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) {
    return `Project includes 2 rounds of revisions. One revision round equals one consolidated list of feedback. Additional revisions are billed at $${LEGACY_HOURLY_RATE}/hr.`
  }
  return contractRevisionsClausePage(doc)
}

/* ---- Proposal and SOW lines ----------------------------------------- */

export function proposalChangeOrderLine(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) return `Change orders billed at $${LEGACY_HOURLY_RATE}/hr.`
  if (usesLatestTerms(doc)) return `Change orders and additional revisions are billed at ${formatRate(rateOf(doc))} with a one hour minimum, or at a fixed quote we agree on, after you approve an estimate.`
  return `Change orders and additional revisions are billed at ${formatRate(rateOf(doc))} with a one hour minimum, after you approve an estimate.`
}

/** SOW revisions paragraph. Legacy SOWs already showed their stored rate. */
export function sowRevisionsText(doc: Versioned & { revisions?: string | number | null }): string {
  const rounds = doc?.revisions ?? 2
  const legacyRate = Number(doc?.hourly_rate) || LEGACY_HOURLY_RATE
  if (!usesCurrentTerms(doc)) {
    return `${rounds} rounds of revisions included. Additional revisions billed at $${legacyRate}/hr. One revision round equals one consolidated list of feedback submitted at one time.`
  }
  if (usesLatestTerms(doc)) return `${rounds} rounds of revisions included. One revision round equals one consolidated list of feedback submitted at one time. Additional revisions are billed at ${formatRate(rateOf(doc))} with a one hour minimum, or at a fixed quote we agree on, after you approve an estimate.`
  return `${rounds} rounds of revisions included. One revision round equals one consolidated list of feedback submitted at one time. Additional revisions are billed at ${formatRate(rateOf(doc))} with a one hour minimum, after you approve an estimate.`
}

/* ---- Payment schedule ------------------------------------------------ */

/**
 * milestone_balance : current terms. 50% deposit before work begins; the
 *                     remaining 50% across the milestones in the proposal and
 *                     agreement (src/lib/payment-schedule.ts).
 * standard          : October 2026 terms, 50% upfront and 50% at delivery.
 * milestones        : October 2026 terms, deposit then milestones.
 * Documents without a terms stamp render their original wording.
 */
export type PaymentPlan = 'milestone_balance' | 'standard' | 'milestones'
export const STANDARD_DEPOSIT_PCT = 50

type PaymentDoc = Versioned & { payment_plan?: string | null }

export function parsePaymentPlan(v: unknown): PaymentPlan | null {
  return v === 'milestone_balance' || v === 'standard' || v === 'milestones' ? v : null
}

function planOf(doc: PaymentDoc): PaymentPlan | 'legacy' {
  if (usesLatestTerms(doc)) return 'milestone_balance'
  if (!usesCurrentTerms(doc)) return 'legacy'
  return doc?.payment_plan === 'standard' ? 'standard' : 'milestones'
}

/** True when the document uses the 50% deposit plus milestones policy. */
export function usesMilestoneBalance(doc: PaymentDoc): boolean {
  return planOf(doc) === 'milestone_balance'
}

/** Earlier documents keep their original number formatting; current ones always show cents when there are any. */
const usd = (n: number) => `$${Number(n || 0).toLocaleString('en-US')}`

export function depositLabel(doc: PaymentDoc): string {
  const plan = planOf(doc)
  if (plan === 'milestone_balance') return 'Deposit due before work begins (50%)'
  return plan === 'standard' ? 'Deposit due to begin (50%)' : 'Deposit due to begin'
}

export function invoiceDepositLabel(doc: PaymentDoc): string {
  const plan = planOf(doc)
  return plan === 'milestones' ? 'Deposit due now' : 'Deposit due now (50%)'
}

export function balanceLabel(doc: PaymentDoc): string {
  const plan = planOf(doc)
  if (plan === 'milestone_balance') return 'Remaining 50%, across the project milestones'
  if (plan === 'standard') return 'Remaining 50% due at delivery, before launch or handoff'
  if (plan === 'milestones') return 'Balance paid across the milestones in your proposal'
  return 'Balance paid across milestones'
}

/** Lines under the proposal total. */
export function proposalPaymentLines(doc: PaymentDoc & { deposit_pct?: number }, total: number): string[] {
  const plan = planOf(doc)
  if (plan === 'milestone_balance') {
    const totalCents = Math.round(total * 100)
    const dep = depositCents(totalCents) / 100
    return [
      `Deposit (50% due before work begins): ${money(dep)}`,
      `The remaining 50% (${money(Math.round(totalCents - dep * 100) / 100)}) is divided across the project milestones listed in this proposal and your agreement.`,
    ]
  }
  const pct = Number(doc?.deposit_pct) || STANDARD_DEPOSIT_PCT
  const deposit = (total * pct) / 100
  if (plan === 'standard') {
    return [
      `Deposit (50% due upfront to reserve the project and begin work): ${usd(deposit)}`,
      `Remaining 50% (${usd(total - deposit)}) is due at delivery, before public launch or final handoff.`,
    ]
  }
  if (plan === 'milestones') {
    return [`Deposit (${pct}% due to begin): ${usd(deposit)}`, 'Remaining balance is paid across the milestones defined in this proposal and its Statement of Work.']
  }
  return [`Deposit (${pct}% due to begin): ${usd(deposit)}`, 'Remaining balance paid across project milestones.', 'Exact milestone schedule outlined in the Statement of Work.']
}

type ContractMoney = PaymentDoc & { total_fee: number; deposit: number; balance: number; payment_method?: string; line_items?: unknown }

export function contractPaymentClausePage(c: ContractMoney): string {
  const plan = planOf(c)
  const tail = `Payment via ${c.payment_method}. Invoices are due within 7 days. Late payments accrue 1.5% interest per month after 14 days.`
  if (plan === 'milestone_balance') {
    const ms = storedMilestones(c.line_items)
    const list = ms.map((m, i) => `Milestone ${i + 1}, ${m.name}: ${money(m.fee)}, invoiced on ${m.deliverables.replace(/[.\s]+$/, '')}${m.dueDate ? ` (target ${formatDue(m.dueDate)})` : ''}.`).join(' ')
    return `Total fee: ${money(c.total_fee)}. A deposit of ${money(c.deposit)} (50%) is due before work begins. The remaining ${money(c.balance)} (50%) is divided across the project milestones listed in the accepted proposal and this agreement. ${list} Each milestone is invoiced when its deliverable or payment trigger is reached; nothing is charged automatically. ${tail}`
  }
  if (plan === 'standard') {
    return `Total fee: ${usd(c.total_fee)}. A deposit of ${usd(c.deposit)} (50%) is due before work begins and reserves the project. The remaining ${usd(c.balance)} (50%) is due at delivery, before public launch or final handoff. ${tail}`
  }
  if (plan === 'milestones') {
    return `Total fee: ${usd(c.total_fee)}. Deposit of ${usd(c.deposit)} is due before work begins. The remaining balance of ${usd(c.balance)} is paid across the milestones defined in the accepted proposal and Statement of Work. ${tail}`
  }
  return `Total fee: ${usd(c.total_fee)}. Deposit of ${usd(c.deposit)} is due before work begins. Remaining balance of ${usd(c.balance)} is paid across project milestones as outlined in the Statement of Work. ${tail}`
}

export function contractPaymentClausePdf(c: ContractMoney): string {
  const plan = planOf(c)
  if (plan === 'legacy') {
    return `Total fee: ${usd(c.total_fee)}. Deposit of ${usd(c.deposit)} is due before work begins. Remaining balance of ${usd(c.balance)} is paid across project milestones. Late payments accrue 1.5% interest per month after 14 days.`
  }
  return contractPaymentClausePage(c)
}

/* ---- Defects after launch ------------------------------------------- */

export function contractWarrantyClausePage(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) {
    return `Alante Velez warrants that all work will be original, will not infringe third-party rights, and will be free of known defects for 30 days following final delivery. Client is responsible for all content provided including text, images, and media.`
  }
  return `Alante Velez warrants that all work will be original and will not infringe third party rights. For 30 days from launch, Client may report defects in the delivered work, measured against the agreed scope, and Alante Velez will correct them. Correcting covered defects does not use paid care time. New requests, Client changes, and changes made by outside services are handled separately. Client is responsible for all content provided, including text, images, and media.`
}

export function contractWarrantyClausePdf(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) return 'Work will be original, free of known defects for 30 days following final delivery.'
  return contractWarrantyClausePage(doc)
}
