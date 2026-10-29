/**
 * What a client's proposal, SOW, and contract links may receive.
 *
 * The /api/{proposals,sows,contracts}/[id] GET routes are reachable by anyone
 * holding the link, so they return only the fields those pages display or need
 * for their wording (terms version, rate, payment plan). Everything else stays
 * on the server: signer IP, signature image, signer name and time, response
 * IPs, decline reasons, internal notes, cover messages already sent by email,
 * linked record ids, and timestamps.
 */

type Row = Record<string, unknown>

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pick(row: Row, keys: readonly string[]): Row {
  const out: Row = {}
  for (const k of keys) if (k in row) out[k] = row[k]
  return out
}
const list = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : [])

const TERMS = ['terms_version', 'hourly_rate', 'payment_plan'] as const

export const PROPOSAL_FIELDS = ['id', 'status', 'client_name', 'client_business', 'project_title', 'project_type', 'understood', 'total', 'deposit_pct', 'out_of_scope', 'timeline', 'next_steps', ...TERMS] as const
export const SOW_FIELDS = ['id', 'status', 'client_name', 'client_business', 'project_title', 'project_type', 'understood', 'out_of_scope', 'total', 'deposit', 'balance', 'deposit_pct', 'start_date', 'delivery_date', 'revisions', 'payment_method', ...TERMS] as const
export const CONTRACT_FIELDS = ['id', 'status', 'client_name', 'client_email', 'client_business', 'project_title', 'project_type', 'start_date', 'delivery_date', 'total_fee', 'deposit', 'balance', 'kill_fee_pct', 'payment_method', ...TERMS] as const

const milestone = (m: Row) => pick(m, ['name', 'deliverables', 'dueDate', 'fee'])

export function publicProposal(row: Row, sowMilestones: unknown): Row {
  return {
    ...pick(row, PROPOSAL_FIELDS),
    line_items: list(row.line_items).map((i) => pick(i, ['description', 'price'])),
    milestones: list(sowMilestones).map(milestone),
  }
}

export function publicSow(row: Row): Row {
  return { ...pick(row, SOW_FIELDS), line_items: list(row.line_items).map(milestone) }
}

export function publicContract(row: Row): Row {
  // The client's own email is shown under Parties. The signature, signer name,
  // time, and IP are never sent back; once signed, the page only shows a
  // confirmation, and the signed copy goes out by email as a PDF.
  return pick(row, CONTRACT_FIELDS)
}

export const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
