/**
 * Plan time arithmetic shared by the admin screens (to show the calculation
 * before anything is saved) and the server. The database functions in
 * supabase/pending/website-care/20261031_care_work_ledger.sql apply the same
 * rules when work is recorded; tests check the two agree.
 *
 * Plan time is counted in standard minutes from the task schedule, never
 * measured time:
 *   line total = quantity x work minutes + testing
 *   testing    = once per line when it applies to the batch, once per unit
 *                when it applies to each unit, zero when tested together
 *                with another task in the same record
 * No database or server imports here.
 */

export type TestingMode = 'batch' | 'per_unit'
export type ExcludedReason = 'monthly_check' | 'report' | 'defect_correction'

export const EXCLUDED_LABEL: Record<ExcludedReason, string> = {
  monthly_check: 'Monthly check, not counted',
  report: 'Report preparation, not counted',
  defect_correction: 'Covered defect correction, not counted',
}

export type Preset = {
  id: string
  key?: string | null
  name: string
  category: string
  unit_definition: string
  included: string
  work_minutes: number
  testing_minutes: number
  testing_mode: TestingMode
  client_description: string
  private_instructions?: string | null
  active: boolean
  confirmed_at: string | null
  version: number
}

export type MinuteRule = { work_minutes: number; testing_minutes: number; testing_mode: TestingMode }

export function lineTotals(rule: MinuteRule, quantity: number, testingShared = false) {
  const q = Math.max(0, Math.floor(quantity))
  const work = q * rule.work_minutes
  const testing = testingShared || q === 0 ? 0 : rule.testing_mode === 'per_unit' ? q * rule.testing_minutes : rule.testing_minutes
  return { work, testing, total: work + testing }
}

/** Plain words for a line's calculation, e.g. "2 × 5 work + 3 testing (once for the batch) = 13". */
export function describeCalc(rule: MinuteRule, quantity: number, testingShared = false) {
  const t = lineTotals(rule, quantity, testingShared)
  const testing = testingShared
    ? '0 testing (tested with another task)'
    : rule.testing_mode === 'per_unit'
      ? `${quantity} × ${rule.testing_minutes} testing`
      : `${rule.testing_minutes} testing (once for the batch)`
  return `${quantity} × ${rule.work_minutes} work + ${testing} = ${t.total}`
}

export type DraftLine = {
  key: string
  source: 'preset' | 'custom'
  preset?: Preset
  name: string
  client_description: string
  private_note: string
  quantity: number
  work_minutes: number
  testing_minutes: number
  testing_mode: TestingMode
  testing_shared: boolean
  excluded_reason: ExcludedReason | ''
}

export type Allowance = { included: number; applied: number; reserved: number; available: number }

/** What a Quick add record would do to the allowance, before it is saved. */
export function draftSummary(lines: DraftLine[], allowance: Allowance | null) {
  const per = lines.map((l) => ({ line: l, ...lineTotals(l, l.quantity, l.testing_shared), counted: !l.excluded_reason }))
  const work = per.reduce((s, x) => s + (x.counted ? x.work : 0), 0)
  const testing = per.reduce((s, x) => s + (x.counted ? x.testing : 0), 0)
  const counted = work + testing
  const notCounted = per.reduce((s, x) => s + (x.counted ? 0 : x.total), 0)
  const after = allowance ? allowance.available - counted : null
  const unconfirmed = lines.filter((l) => l.source === 'preset' && !l.excluded_reason && !l.preset?.confirmed_at).map((l) => l.name)
  const keys = lines.filter((l) => l.source === 'preset').map((l) => l.preset?.id)
  const duplicates = keys.filter((k, i) => k && keys.indexOf(k) !== i)
  const problems: string[] = []
  if (!lines.length) problems.push('Choose at least one task.')
  if (unconfirmed.length) problems.push(`Confirm the proposed minutes for ${unconfirmed.join(', ')} in the task catalog first.`)
  if (duplicates.length) problems.push('A task is listed twice. Use one line with the total quantity.')
  for (const l of lines) {
    if (l.quantity < 1 || l.quantity > 100) problems.push(`Quantity for ${l.name || 'a task'} must be 1 to 100.`)
    if (l.source === 'custom' && (l.name.trim().length < 2 || l.client_description.trim().length < 5)) problems.push('A custom task needs a name and a client description.')
  }
  if (after !== null && after < 0) problems.push(`This needs ${counted} standard minutes but only ${Math.max(allowance!.available, 0)} are available. Nothing can be recorded beyond the allowance; create an estimate for larger work.`)
  return { per, work, testing, counted, notCounted, after, problems }
}

export type EstimateFields = {
  standard_minutes: number
  included_minutes: number
  additional_price_cents: number | null
  price_explanation: string
  scope: string
  deliverables: string
  title: string
}

/** What an estimate still needs before the client can be asked to approve it. */
export function estimateProblems(e: EstimateFields, available: number | null, planHasTime: boolean) {
  const p: string[] = []
  if (e.title.trim().length < 3) p.push('Add a short title.')
  if (e.scope.trim().length < 5) p.push('Describe the scope.')
  if (e.deliverables.trim().length < 5) p.push('List the expected deliverables.')
  if (!(e.standard_minutes > 0)) p.push('Set the total standard minutes, including testing.')
  if (e.included_minutes < 0 || e.included_minutes > e.standard_minutes) p.push('Included minutes must be between 0 and the total.')
  if (!planHasTime && e.included_minutes > 0) p.push('This plan has no included time, so no included minutes can apply.')
  if (available !== null && e.included_minutes > Math.max(available, 0)) p.push(`Only ${Math.max(available, 0)} included minutes are available this period.`)
  const additional = e.standard_minutes - e.included_minutes
  if (additional > 0 && (e.additional_price_cents === null || e.price_explanation.trim().length < 5)) p.push('Additional work needs a price and a short note on how it was calculated.')
  return p
}

export const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? 'Not set' : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`)
export const minutes = (n: number) => `${n} minute${n === 1 ? '' : 's'}`
