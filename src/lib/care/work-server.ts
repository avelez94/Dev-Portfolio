/**
 * Website Care work tracking on the server: the task catalog, the work ledger
 * for each website and billing period, estimates for larger requests, and
 * the care terms review. Allocation always goes through the database
 * functions (care_record_work and friends), which lock the billing period so
 * concurrent requests can't double allocate or overdraw.
 * Client facing copy rule: no dashes.
 */
import { randomUUID } from 'node:crypto'
import { CARE_TERMS_VERSION } from '@/content/care-terms'
import { db, must, CareError, logActivity, type Row } from './db'
import { invalidateApproval } from './report'
import { estimateProblems, type Allowance } from './work'

const ERRORS: [RegExp, (m: RegExpMatchArray) => string, number][] = [
  [/CARE_NOT_CONFIRMED/, () => 'Confirm that the work and its testing are complete before recording it. Nothing was recorded.', 422],
  [/CARE_TERMS_REVIEW/, () => 'This client’s care agreement predates the flexible plan time terms. Review it on the website page before recording work or estimates.', 409],
  [/CARE_PRESET_UNCONFIRMED: (.*)/, (m) => `The minutes for “${m[1]}” are proposed, not confirmed. Confirm them in the task catalog first. Nothing was recorded.`, 422],
  [/CARE_DUPLICATE_LINE: (.*)/, (m) => `“${m[1]}” is listed twice. Use one line with the total quantity so its testing isn’t counted twice.`, 422],
  [/CARE_WRONG_PERIOD/, () => 'That completion date is outside this billing period. Record the work on the period it was done in.', 422],
  [/CARE_OVER_ALLOWANCE: needs (\d+), (\d+) available/, (m) => `This needs ${m[1]} standard minutes but only ${m[2]} are available in this billing period. Nothing was recorded. For larger work, create an estimate and record the client’s approval first.`, 409],
  [/CARE_ESTIMATE_PERIOD/, () => 'That estimate belongs to another billing period. Carry it to the current period instead; it then needs the client’s approval again.', 409],
  [/CARE_PERIOD_ENDED/, () => 'That billing period has ended, so its minutes can’t be reserved. Carry the estimate to the current period.', 409],
  [/CARE_SCOPE_EXCEEDED: (\d+) of (\d+)/, (m) => `This would go beyond the approved estimate (${m[1]} of ${m[2]} standard minutes already recorded). Create a revised estimate and record the client’s approval before more paid work.`, 409],
  [/CARE_ESTIMATE_STATE/, () => 'That estimate isn’t open for this step. It may still be a draft, already closed, or replaced by a revision.', 409],
  [/CARE_BAD_INPUT: (.*)/, (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1) + '.', 422],
]

/** Turns a database function error into a clear message with the right status. */
export function careDbError(message: string): CareError {
  for (const [re, text, status] of ERRORS) {
    const m = message.match(re)
    if (m) return new CareError(text(m), status)
  }
  return new CareError(message, 500)
}

async function rpc<T = Row>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw careDbError(error.message)
  return data as T
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const int = (v: unknown, lo: number, hi: number, what: string) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < lo || n > hi) throw new CareError(`${what} must be a whole number from ${lo} to ${hi}.`, 422)
  return n
}

/* ------------------------------ task catalog ------------------------------ */

export async function listPresets() {
  return (await db.from('care_task_presets').select('*').order('category').order('name')).data || []
}

function presetFields(body: Row, partial: boolean) {
  const out: Row = {}
  const text = (k: string, min: number, max: number, label: string) => {
    if (partial && !(k in body)) return
    const v = str(body[k], max)
    if (v.length < min) throw new CareError(`${label} is required.`, 422)
    out[k] = v
  }
  text('name', 2, 80, 'Task name')
  text('category', 2, 40, 'Category')
  text('unit_definition', 5, 400, 'One unit (what a quantity of 1 means)')
  text('client_description', 5, 400, 'Client description')
  if (!partial || 'included' in body) out.included = str(body.included, 600)
  if (!partial || 'private_instructions' in body) out.private_instructions = str(body.private_instructions, 2000) || null
  if (!partial || 'work_minutes' in body) out.work_minutes = int(body.work_minutes, 0, 600, 'Work minutes per unit')
  if (!partial || 'testing_minutes' in body) out.testing_minutes = int(body.testing_minutes ?? 0, 0, 240, 'Testing minutes')
  if (!partial || 'testing_mode' in body) {
    if (body.testing_mode !== 'batch' && body.testing_mode !== 'per_unit') throw new CareError('Choose whether testing applies once per batch or to each unit.', 422)
    out.testing_mode = body.testing_mode
  }
  if ('active' in body) out.active = body.active === true
  return out
}

/** New presets start unconfirmed; they deduct nothing until confirmed. */
export async function createPreset(body: Row, actor: string) {
  const row = must(await db.from('care_task_presets').insert(presetFields(body, false)).select('*').single(), 'Task preset')
  await logActivity({ actor, action: 'preset_created', detail: { preset: row.id, name: row.name } })
  return row
}

/** Editing minutes, testing, or the unit clears the confirmation (database trigger). Past entries keep their own snapshot. */
export async function updatePreset(id: string, body: Row, actor: string) {
  const row = must(await db.from('care_task_presets').update(presetFields(body, true)).eq('id', id).select('*').single(), 'Task preset')
  await logActivity({ actor, action: 'preset_updated', detail: { preset: id, version: row.version, confirmed: !!row.confirmed_at } })
  return row
}

export async function confirmPreset(id: string, version: number, actor: string) {
  const res = await db.from('care_task_presets').update({ confirmed_at: new Date().toISOString(), confirmed_by: actor }).eq('id', id).eq('version', version).select('*')
  if (res.error) throw new CareError(res.error.message, 500)
  if (!res.data?.length) throw new CareError('This preset changed since you opened it. Review the latest minutes, then confirm.', 409)
  await logActivity({ actor, action: 'preset_confirmed', detail: { preset: id, version } })
  return res.data[0]
}

/* ------------------------------ ledger and allowance ------------------------------ */

export async function allowanceFor(cycleId: string): Promise<Allowance> {
  const rows = await rpc<Allowance[]>('care_period_allowance', { p_cycle: cycleId })
  return rows[0] || { included: 0, applied: 0, reserved: 0, available: 0 }
}

/** The billing period that covers today, or the latest one. */
export async function currentCycle(siteId: string): Promise<Row | null> {
  const now = new Date().toISOString()
  const live = (await db.from('care_cycles').select('*').eq('site_id', siteId).lte('period_start', now).gt('period_end', now).order('period_start', { ascending: false }).limit(1)).data?.[0]
  if (live) return live
  return (await db.from('care_cycles').select('*').eq('site_id', siteId).order('period_start', { ascending: false }).limit(1)).data?.[0] || null
}

export async function ledgerFor(cycleId: string) {
  const cycle = must(await db.from('care_cycles').select('*').eq('id', cycleId).single(), 'Billing period')
  const entries = (await db.from('care_work_entries').select('*').eq('cycle_id', cycleId).order('recorded_at', { ascending: true }).order('line_no')).data || []
  const estimates = (await db.from('care_estimates').select('*').eq('cycle_id', cycleId).order('created_at', { ascending: false })).data || []
  const allowance = await allowanceFor(cycleId)
  return { cycle, entries, estimates, allowance, confirmed: !!cycle.work_log_confirmed_at }
}

/** Everything the Quick add and allowance panels need for one website. */
export async function siteWork(siteId: string) {
  const site = must(await db.from('care_sites').select('id, label, plan, care_terms_version, care_terms_note, care_terms_reviewed_at').eq('id', siteId).single(), 'Website')
  const cycle = await currentCycle(siteId)
  const ledger = cycle ? await ledgerFor(cycle.id) : null
  const presets = (await db.from('care_task_presets').select('*').eq('active', true).order('category').order('name')).data || []
  const open = (await db.from('care_estimates').select('*, care_cycles(period_start, period_end)').eq('site_id', siteId).in('status', ['draft', 'approved']).order('created_at', { ascending: false })).data || []
  return { site, cycle, ledger, presets, openEstimates: open, terms: termsState(site) }
}

export function termsState(site: Row) {
  const current = site.care_terms_version === CARE_TERMS_VERSION
  return { current, version: CARE_TERMS_VERSION, onFile: site.care_terms_version || null, note: site.care_terms_note || null, reviewedAt: site.care_terms_reviewed_at || null }
}

type LineIn = Row

function cleanLines(lines: unknown): LineIn[] {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw new CareError('Choose between 1 and 50 tasks.', 422)
  return lines.map((l: Row) => {
    const excluded = ['monthly_check', 'report', 'defect_correction'].includes(l.excluded_reason) ? l.excluded_reason : null
    const base = { quantity: int(l.quantity, 1, 100, 'Quantity'), testing_shared: l.testing_shared === true, excluded_reason: excluded, private_note: str(l.private_note, 1000), client_description: str(l.client_description, 400) }
    if (l.source === 'preset') {
      if (typeof l.preset_id !== 'string') throw new CareError('Choose a task.', 422)
      return { source: 'preset', preset_id: l.preset_id, ...base }
    }
    return {
      source: 'custom', ...base, name: str(l.name, 80), category: str(l.category, 40) || 'Custom', unit_definition: str(l.unit_definition, 400),
      work_minutes: int(l.work_minutes, 0, 600, 'Agreed standard minutes'), testing_minutes: int(l.testing_minutes ?? 0, 0, 240, 'Testing minutes'),
      testing_mode: l.testing_mode === 'per_unit' ? 'per_unit' : 'batch',
    }
  })
}

/**
 * Records completed work. `batch_key` comes from the form when it opens, so a
 * double click or a retry saves once. Recorded work is part of the monthly
 * report, so an approved report for that period returns to draft.
 */
export async function recordWork(cycleId: string, body: Row, actor: string) {
  const batch = /^[\w-]{8,80}$/.test(String(body.batch_key || '')) ? String(body.batch_key) : randomUUID()
  const completedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.completed_on || '')) ? String(body.completed_on) : new Date().toISOString().slice(0, 10)
  const corrects = Array.isArray(body.corrects) ? body.corrects.filter((x: unknown) => typeof x === 'string') : null
  const site = must(await db.from('care_cycles').select('site_id, care_sites(care_terms_version)').eq('id', cycleId).single(), 'Billing period')
  const result = await rpc<Row>('care_record_work', {
    p_cycle: cycleId, p_batch_key: batch, p_lines: cleanLines(body.lines), p_actor: actor, p_confirmed: body.confirmed === true,
    p_terms_version: CARE_TERMS_VERSION, p_completed_on: completedOn, p_estimate: body.estimate_id || null,
    p_complete_estimate: body.complete_estimate === true, p_corrects: corrects?.length ? corrects : null, p_correct_reason: str(body.correct_reason, 300) || null,
  })
  if (!result.duplicate) {
    await logActivity({ site_id: site.site_id, cycle_id: cycleId, actor, action: corrects?.length ? 'work_corrected' : 'work_recorded', detail: { batch, lines: result.entries.length, applied: result.entries.reduce((s: number, e: Row) => s + e.applied_minutes, 0), estimate: body.estimate_id || null } })
    await invalidateApproval(cycleId, 'Recorded work changed after approval.', actor)
  }
  return result
}

export async function voidWork(entryIds: unknown, reason: unknown, actor: string) {
  const ids = Array.isArray(entryIds) ? entryIds.filter((x) => typeof x === 'string') : []
  if (!ids.length) throw new CareError('Choose the work to undo.', 422)
  const first = must(await db.from('care_work_entries').select('site_id, cycle_id').eq('id', ids[0]).single(), 'Work entry')
  const r = await rpc<Row>('care_void_work', { p_entries: ids, p_reason: str(reason, 300), p_actor: actor })
  await logActivity({ site_id: first.site_id, cycle_id: first.cycle_id, actor, action: 'work_undone', detail: { entries: ids, reason: str(reason, 300) } })
  await invalidateApproval(first.cycle_id, 'Recorded work changed after approval.', actor)
  return r
}

/** You confirm every completed task for the period is recorded; until then reports say records may be incomplete. */
export async function confirmWorkLog(cycleId: string, confirmed: boolean, actor: string) {
  await db.from('care_cycles').update({ work_log_confirmed_at: confirmed ? new Date().toISOString() : null, work_log_confirmed_by: confirmed ? actor : null, updated_at: new Date().toISOString() }).eq('id', cycleId)
  await logActivity({ cycle_id: cycleId, actor, action: confirmed ? 'work_log_confirmed' : 'work_log_reopened' })
  await invalidateApproval(cycleId, 'The work record status changed after approval.', actor)
}

/* ------------------------------ estimates ------------------------------ */

function estimateFields(body: Row) {
  const out: Row = {
    title: str(body.title, 120), scope: str(body.scope, 4000), deliverables: str(body.deliverables, 4000), schedule: str(body.schedule, 1000),
    standard_minutes: int(body.standard_minutes, 1, 6000, 'Total standard minutes'), included_minutes: int(body.included_minutes ?? 0, 0, 6000, 'Included minutes'),
    price_explanation: str(body.price_explanation, 1000),
    lines: Array.isArray(body.lines) ? body.lines.slice(0, 50) : [],
  }
  const price = body.additional_price === '' || body.additional_price === null || body.additional_price === undefined ? null : Number(body.additional_price)
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000)) throw new CareError('Additional price must be a dollar amount.', 422)
  out.additional_price_cents = price === null ? null : Math.round(price * 100)
  if (out.title.length < 3) throw new CareError('Add a short title.', 422)
  if (out.included_minutes > out.standard_minutes) throw new CareError('Included minutes can’t be more than the total.', 422)
  return out
}

export async function createEstimate(siteId: string, body: Row, actor: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  if (!termsState(site).current) throw careDbError('CARE_TERMS_REVIEW')
  const cycle = body.cycle_id ? must(await db.from('care_cycles').select('*').eq('id', body.cycle_id).eq('site_id', siteId).single(), 'Billing period') : await currentCycle(siteId)
  if (!cycle) throw new CareError('There is no paid billing period for this website yet.', 409)
  const fields = estimateFields(body)
  if (!cycle.included_minutes && fields.included_minutes) throw new CareError('This plan has no included time, so no included minutes can apply.', 422)
  const row = must(await db.from('care_estimates').insert({ ...fields, site_id: siteId, cycle_id: cycle.id, revision_of: body.revision_of || null }).select('*').single(), 'Estimate')
  await logActivity({ site_id: siteId, cycle_id: cycle.id, actor, action: body.revision_of ? 'estimate_revised' : 'estimate_created', detail: { estimate: row.id, standard: row.standard_minutes, included: row.included_minutes } })
  await invalidateApproval(cycle.id, 'An approval request changed after approval.', actor)
  return row
}

/** Drafts only: once approved, a change needs a revised estimate. */
export async function updateEstimate(id: string, body: Row, actor: string) {
  const cur = must(await db.from('care_estimates').select('*').eq('id', id).single(), 'Estimate')
  if (cur.status !== 'draft') throw new CareError('Only a draft can be edited. For an approved estimate, create a revised estimate.', 409)
  const row = must(await db.from('care_estimates').update({ ...estimateFields({ ...cur, additional_price: cur.additional_price_cents === null ? null : cur.additional_price_cents / 100, ...body }), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft').select('*').single(), 'Estimate')
  await invalidateApproval(cur.cycle_id, 'An approval request changed after approval.', actor)
  return row
}

export async function approveEstimate(id: string, note: unknown, actor: string) {
  const e = must(await db.from('care_estimates').select('*').eq('id', id).single(), 'Estimate')
  const a = await allowanceFor(e.cycle_id)
  const cyc = must(await db.from('care_cycles').select('included_minutes').eq('id', e.cycle_id).single(), 'Billing period')
  const problems = estimateProblems({ ...e, additional_price_cents: e.additional_price_cents }, e.revision_of ? null : a.available, !!cyc.included_minutes)
  if (problems.length) throw new CareError(problems.join(' '), 422)
  const r = await rpc<Row>('care_approve_estimate', { p_estimate: id, p_note: str(note, 500), p_actor: actor })
  await logActivity({ site_id: e.site_id, cycle_id: e.cycle_id, actor, action: 'estimate_approved', detail: { estimate: id, reserved: r.reserved } })
  await invalidateApproval(e.cycle_id, 'An estimate was approved after the report was approved.', actor)
  return r
}

export async function closeEstimate(id: string, status: unknown, reason: unknown, actor: string) {
  const e = must(await db.from('care_estimates').select('*').eq('id', id).single(), 'Estimate')
  const r = await rpc<Row>('care_close_estimate', { p_estimate: id, p_status: String(status), p_reason: str(reason, 300), p_actor: actor })
  await logActivity({ site_id: e.site_id, cycle_id: e.cycle_id, actor, action: `estimate_${status}`, detail: { estimate: id } })
  await invalidateApproval(e.cycle_id, 'An estimate changed after the report was approved.', actor)
  return r
}

/**
 * Unfinished approved work at the end of a billing period: its reserved minutes
 * stay in that period. Carrying it forward closes the old one as expired and
 * creates a draft in the current period, which needs the client's approval again.
 */
export async function carryEstimate(id: string, actor: string) {
  const e = must(await db.from('care_estimates').select('*').eq('id', id).single(), 'Estimate')
  if (!['approved', 'draft'].includes(e.status)) throw careDbError('CARE_ESTIMATE_STATE')
  const cycle = await currentCycle(e.site_id)
  if (!cycle || cycle.id === e.cycle_id) throw new CareError('There is no newer billing period to carry this to yet.', 409)
  const recorded = (await db.from('care_work_entries').select('total_minutes, excluded_reason').eq('estimate_id', id).is('voided_at', null)).data || []
  const done = recorded.filter((x: Row) => !x.excluded_reason).reduce((s: number, x: Row) => s + x.total_minutes, 0)
  await rpc('care_close_estimate', { p_estimate: id, p_status: 'expired', p_reason: 'Billing period ended before the work was finished; carried to the next period', p_actor: actor })
  const remaining = Math.max(e.standard_minutes - done, 1)
  const row = must(await db.from('care_estimates').insert({
    site_id: e.site_id, cycle_id: cycle.id, title: e.title, scope: e.scope, deliverables: e.deliverables, schedule: e.schedule, lines: e.lines,
    standard_minutes: remaining, included_minutes: 0, additional_price_cents: null, price_explanation: '',
  }).select('*').single(), 'Estimate')
  await logActivity({ site_id: e.site_id, cycle_id: cycle.id, actor, action: 'estimate_carried', detail: { from: id, to: row.id, remaining } })
  return row
}

export async function invoiceEstimate(id: string, body: Row, actor: string) {
  const e = must(await db.from('care_estimates').select('*, care_sites(client_id)').eq('id', id).single(), 'Estimate')
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date || '')) ? String(body.due_date) : null
  const invoiceId = await rpc<string>('care_invoice_estimate', { p_estimate: id, p_client: e.care_sites.client_id, p_number: str(body.invoice_number, 60), p_due: due, p_actor: actor })
  await logActivity({ site_id: e.site_id, cycle_id: e.cycle_id, actor, action: 'estimate_invoiced', detail: { estimate: id, invoice: invoiceId, cents: e.additional_price_cents } })
  return { invoice_id: invoiceId }
}

/* ------------------------------ terms review and flags ------------------------------ */

/** Records that this client's agreement now uses the flexible plan time terms. */
export async function reviewTerms(siteId: string, note: unknown, actor: string) {
  const n = str(note, 500)
  if (n.length < 5) throw new CareError('Describe how the client accepted the flexible plan time terms (for example, signed updated agreement and date).', 422)
  await db.from('care_sites').update({ care_terms_version: CARE_TERMS_VERSION, care_terms_note: n, care_terms_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', siteId)
  await logActivity({ site_id: siteId, actor, action: 'care_terms_reviewed', detail: { version: CARE_TERMS_VERSION, note: n } })
}

/** Items for your review: unfinished approved work near or past period end, and agreements on older terms. */
export async function workFlags() {
  const soon = new Date(Date.now() + 7 * 86400_000).toISOString()
  const open = (await db.from('care_estimates').select('id, site_id, title, status, reserved_minutes, cycle_id, care_cycles!inner(period_end)').eq('status', 'approved').lte('care_cycles.period_end', soon)).data || []
  // New enrollments record their terms when the setup is confirmed, so only confirmed or paused sites are flagged.
  const oldTerms = (await db.from('care_sites').select('id, label, care_terms_version').in('enrollment_status', ['confirmed', 'paused'])).data?.filter((s: Row) => s.care_terms_version !== CARE_TERMS_VERSION) || []
  return { unfinished: open, termsReview: oldTerms }
}
