/**
 * Reusable wording for additional work in proposals, SOWs, and contracts.
 *
 * Documents created by this version are stamped with TERMS_VERSION in their
 * `terms_version` column (see supabase/migrations/20261028_terms_version.sql).
 * Anything without that stamp (every proposal, SOW, and contract issued before
 * this change) keeps rendering its original wording, word for word, so issued
 * proposals and signed agreements never change after the fact.
 *
 * Client facing wording rule: no dashes in the current wording.
 */

export const TERMS_VERSION = '2026-10-standard-rate'
export const STANDARD_HOURLY_RATE = 100

/** Rate stored on documents issued before the standard rate. Legacy text only. */
const LEGACY_HOURLY_RATE = 65

type Versioned = { terms_version?: string | null; hourly_rate?: number | string | null } | null | undefined

export function usesCurrentTerms(doc: Versioned): boolean {
  return doc?.terms_version === TERMS_VERSION
}

function rateOf(doc: Versioned): number {
  const n = Number(doc?.hourly_rate)
  return Number.isFinite(n) && n > 0 ? n : STANDARD_HOURLY_RATE
}

export function formatRate(rate: number): string {
  return `$${rate.toLocaleString('en-US')}/hr`
}

/** One sentence: rate, minimum, and approval. Used by the builder and new documents. */
export function additionalWorkSentence(rate: number = STANDARD_HOURLY_RATE): string {
  return `Additional work is billed at ${formatRate(rate)} with a one hour minimum, and an estimate is approved before work begins.`
}

/* ---- Contract clauses ---------------------------------------------- */

export function contractServicesClause(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) {
    return `Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires written approval and will be billed at $${LEGACY_HOURLY_RATE}/hr.`
  }
  return `Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires a written estimate approved by Client before it begins, and is billed at ${formatRate(rateOf(doc))} with a one hour minimum.`
}

/** Revisions clause as shown on the contract signing page. */
export function contractRevisionsClausePage(doc: Versioned): string {
  if (!usesCurrentTerms(doc)) {
    return `Project includes 2 rounds of revisions. One revision round equals one consolidated list of feedback submitted at one time, not ongoing back-and-forth. Additional revisions are billed at $${LEGACY_HOURLY_RATE}/hr and require written approval before proceeding.`
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
  return `Change orders and additional revisions are billed at ${formatRate(rateOf(doc))} with a one hour minimum, after you approve an estimate.`
}

/** SOW revisions paragraph. Legacy SOWs already showed their stored rate. */
export function sowRevisionsText(doc: Versioned & { revisions?: string | number | null }): string {
  const rounds = doc?.revisions ?? 2
  const legacyRate = Number(doc?.hourly_rate) || LEGACY_HOURLY_RATE
  if (!usesCurrentTerms(doc)) {
    return `${rounds} rounds of revisions included. Additional revisions billed at $${legacyRate}/hr. One revision round equals one consolidated list of feedback submitted at one time.`
  }
  return `${rounds} rounds of revisions included. One revision round equals one consolidated list of feedback submitted at one time. Additional revisions are billed at ${formatRate(rateOf(doc))} with a one hour minimum, after you approve an estimate.`
}

/* ---- Payment schedule ------------------------------------------------ */

/**
 * standard   : standard website projects, 50% upfront and 50% at delivery.
 * milestones : larger custom projects, schedule defined in the proposal.
 * Documents without the current terms stamp render their original wording.
 */
export type PaymentPlan = 'standard' | 'milestones'
export const STANDARD_DEPOSIT_PCT = 50

type PaymentDoc = Versioned & { payment_plan?: string | null }

export function parsePaymentPlan(v: unknown): PaymentPlan | null {
  return v === 'standard' || v === 'milestones' ? v : null
}

function planOf(doc: PaymentDoc): PaymentPlan | 'legacy' {
  if (!usesCurrentTerms(doc)) return 'legacy'
  return doc?.payment_plan === 'standard' ? 'standard' : 'milestones'
}

const usd = (n: number) => `$${Number(n || 0).toLocaleString('en-US')}`

export function depositLabel(doc: PaymentDoc): string {
  return planOf(doc) === 'standard' ? 'Deposit due to begin (50%)' : 'Deposit due to begin'
}

export function invoiceDepositLabel(doc: PaymentDoc): string {
  return planOf(doc) === 'milestones' ? 'Deposit due now' : 'Deposit due now (50%)'
}

export function balanceLabel(doc: PaymentDoc): string {
  const plan = planOf(doc)
  if (plan === 'standard') return 'Remaining 50% due at delivery, before launch or handoff'
  if (plan === 'milestones') return 'Balance paid across the milestones in your proposal'
  return 'Balance paid across milestones'
}

/** Lines under the proposal total. */
export function proposalPaymentLines(doc: PaymentDoc & { deposit_pct?: number }, total: number): string[] {
  const plan = planOf(doc)
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

type ContractMoney = PaymentDoc & { total_fee: number; deposit: number; balance: number; payment_method?: string }

export function contractPaymentClausePage(c: ContractMoney): string {
  const plan = planOf(c)
  const tail = `Payment via ${c.payment_method}. Invoices are due within 7 days. Late payments accrue 1.5% interest per month after 14 days.`
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
