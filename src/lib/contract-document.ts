/**
 * The terms and conditions of the freelance agreement, exactly as the client
 * reads and signs them on the contract page (/contracts/[id]).
 *
 * The signing page, the signed PDF copy for current terms, and the admin
 * download all read from here, so they can't drift apart. Wording that depends
 * on the document's terms version comes from src/lib/terms.ts.
 *
 * Contracts signed before the current terms are not rebuilt from this: their
 * signed PDF keeps its original wording (see legacyContractPdf).
 */
import {
  contractPaymentClausePage,
  contractRevisionsClausePage,
  contractServicesClause,
  contractWarrantyClausePage,
} from '@/lib/terms'

export type ContractDoc = {
  client_name: string
  client_email: string
  client_business?: string | null
  project_title: string
  project_type: string
  start_date?: string | null
  delivery_date?: string | null
  total_fee: number
  deposit: number
  balance: number
  kill_fee_pct: number
  payment_method: string
  terms_version?: string | null
  hourly_rate?: number | null
  payment_plan?: string | null
}

export function killFeeAmount(c: Pick<ContractDoc, 'total_fee' | 'kill_fee_pct'>): number {
  return Math.round((c.total_fee * c.kill_fee_pct) / 100)
}

export function contractClauses(c: ContractDoc): [string, string][] {
  return [
    ['1. Services', contractServicesClause(c)],
    ['2. Payment', contractPaymentClausePage(c)],
    ['3. Kill fee', `If Client cancels after work has begun, a kill fee of ${c.kill_fee_pct}% of the total project fee ($${killFeeAmount(c).toLocaleString()}) is due immediately, in addition to payment for all work completed to date.`],
    ['4. Intellectual property', `Full ownership of all deliverables transfers to Client upon receipt of final payment in full. Until final payment is received, all work remains the property of Alante Velez. Alante Velez retains the right to display completed work in portfolio and case studies.`],
    ['5. Revisions', contractRevisionsClausePage(c)],
    ['6. Client responsibilities', `Client agrees to provide all required content, assets, credentials, and feedback in a timely manner. Delays caused by Client may result in timeline adjustments. Alante Velez is not responsible for delays caused by third-party services or Client inaction.`],
    ['7. Confidentiality', `Both parties agree to keep each other's proprietary information, business processes, and client data confidential during and after the project. This obligation survives termination of this agreement.`],
    ['8. Warranties', contractWarrantyClausePage(c)],
    ['9. Limitation of liability', `Alante Velez's total liability under this agreement is limited to the total amount paid by Client. Alante Velez is not liable for indirect, incidental, or consequential damages including loss of revenue, data, or business opportunity.`],
    ['10. Dispute resolution', `The parties agree to attempt to resolve any disputes informally before pursuing legal action. If informal resolution fails, disputes will be resolved through binding arbitration in the State of Maryland.`],
    ['11. Governing law', `This agreement is governed by the laws of the State of Maryland. Any legal action must be brought in courts located in Maryland.`],
    ['12. Entire agreement', `This contract, together with the accepted Proposal and Statement of Work, constitutes the entire agreement between the parties and supersedes all prior discussions, representations, or agreements.`],
  ]
}
