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
