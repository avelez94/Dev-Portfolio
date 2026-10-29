/**
 * Project payment schedule for documents issued under the current terms
 * (TERMS_VERSION in src/lib/terms.ts):
 *
 *   A 50% deposit is due before work begins. The remaining 50% is divided
 *   across the project milestones listed in your proposal and agreement.
 *
 * You choose each milestone's amount and payment trigger; nothing here splits
 * the balance for you. Amounts are checked in whole cents so the deposit plus
 * the milestones always equals the project total exactly. Shared by the admin
 * builders, the API routes (which validate again), the client pages, emails,
 * PDFs, and the linked invoices.
 */

/** Stored shape (SOW and contract line_items). Field names kept from earlier documents. */
export type Milestone = { name: string; deliverables: string; dueDate: string | null; fee: number }
export type MilestoneInput = { name?: unknown; deliverables?: unknown; dueDate?: unknown; fee?: unknown }

export const DEPOSIT_PCT = 50

export const toCents = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}
export const fromCents = (c: number) => c / 100

/** The deposit is half the total; with an odd number of cents the extra cent goes to the deposit. */
export function depositCents(totalCents: number) {
  return Math.ceil(totalCents / 2)
}

export function money(n: number) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

export type Schedule = { total: number; deposit: number; balance: number; milestones: Milestone[] }
export type ScheduleCheck = { ok: true; schedule: Schedule; problems: [] } | { ok: false; problems: string[]; schedule: Schedule }

/**
 * Checks a deposit plus milestone schedule. Blank milestone rows are ignored.
 * Every remaining row needs a name, a deliverable or payment trigger, and an
 * amount; a due date is optional. The milestones must add up to the balance
 * after the 50% deposit, to the cent.
 */
export function checkSchedule(total: unknown, rows: MilestoneInput[] | null | undefined): ScheduleCheck {
  const problems: string[] = []
  const totalCents = toCents(total)
  if (!Number.isFinite(totalCents) || totalCents <= 0) problems.push('Enter the project total.')
  const tc = Number.isFinite(totalCents) && totalCents > 0 ? totalCents : 0
  const dep = depositCents(tc)
  const bal = tc - dep
  // Rows left blank (or only holding the default "Milestone N" name) are ignored.
  const blank = (m: MilestoneInput) => (!String(m.name ?? '').trim() || /^Milestone \d+$/.test(String(m.name).trim())) && ![m.deliverables, m.fee, m.dueDate].some((v) => String(v ?? '').trim())
  const filled = (rows || []).filter((m) => m && !blank(m))
  const milestones: Milestone[] = []
  let sum = 0
  filled.forEach((m, i) => {
    const label = `Milestone ${i + 1}`
    const name = String(m.name ?? '').trim()
    const trigger = String(m.deliverables ?? '').trim()
    const cents = toCents(m.fee)
    const due = String(m.dueDate ?? '').trim()
    if (!name) problems.push(`${label} needs a name.`)
    if (!trigger) problems.push(`${label} needs its deliverable or payment trigger.`)
    if (!Number.isFinite(cents) || cents <= 0) problems.push(`${label} needs an amount.`)
    else if (Math.abs(Number(String(m.fee).replace(/[$,\s]/g, '')) * 100 - cents) > 1e-6) problems.push(`${label}: use whole cents.`)
    if (due && (!DATE.test(due) || Number.isNaN(Date.parse(due + 'T12:00:00Z')))) problems.push(`${label} has an invalid due date.`)
    const fee = Number.isFinite(cents) && cents > 0 ? cents : 0
    sum += fee
    milestones.push({ name: name.slice(0, 120), deliverables: trigger.slice(0, 2000), dueDate: due && DATE.test(due) ? due : null, fee: fromCents(fee) })
  })
  if (!milestones.length) problems.push('Add at least one milestone for the remaining 50%.')
  else if (tc && sum !== bal) {
    const diff = bal - sum
    problems.push(`The milestones add up to ${money(fromCents(sum))}; they need to equal the remaining 50%, ${money(fromCents(bal))} (${diff > 0 ? `${money(fromCents(diff))} still to assign` : `${money(fromCents(-diff))} too much`}).`)
  }
  const schedule = { total: fromCents(tc), deposit: fromCents(dep), balance: fromCents(bal), milestones }
  return problems.length ? { ok: false, problems, schedule } : { ok: true, problems: [], schedule }
}

/** Reads stored milestones (SOW or contract line_items) back into the stored shape. */
export function storedMilestones(v: unknown): Milestone[] {
  return (Array.isArray(v) ? v : []).filter((m) => m && typeof m === 'object').map((m: Record<string, unknown>) => ({
    name: String(m.name ?? ''), deliverables: String(m.deliverables ?? ''), dueDate: typeof m.dueDate === 'string' && m.dueDate ? m.dueDate : null, fee: Number(m.fee) || 0,
  }))
}

export function formatDue(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** One line per payment: the deposit, then each milestone. Used by emails and PDFs. */
export function scheduleLines(s: { deposit: number; milestones: Milestone[] }): string[] {
  return [
    `Deposit (50%), due before work begins: ${money(s.deposit)}`,
    ...s.milestones.map((m, i) => `Milestone ${i + 1}, ${m.name}: ${money(m.fee)}. Payment trigger: ${m.deliverables.replace(/[.\s]+$/, '')}${m.dueDate ? `. Target date ${formatDue(m.dueDate)}` : ''}.`),
  ]
}

/** "Deposit" for a contract schedule's first row, otherwise "Payment 2 of 4". */
export function milestoneLabel(m: { name: string }, index: number, total: number) {
  return m.name === 'Deposit (50%)' ? 'Deposit' : 'Payment ' + (index + 1) + ' of ' + total
}
