/**
 * Suggested Report text, written from templates (no AI service).
 *
 * The suggestions come only from the client report snapshot (the same
 * client facing facts the report shows: grouped results, your issue
 * decisions and client notes, recorded manual results, the work ledger, and
 * estimate statuses) plus the labels and results of the manual checks you
 * recorded. Private notes are not part of either, so they can never appear.
 *
 * Rules: claim nothing the records don't show (no "passed" without a passing
 * result, no "fixed" without a verified fix, no client approval unless an
 * estimate is approved), make no commitments or deadlines, and leave optional
 * fields empty when there's nothing useful to add.
 */
import type { Snapshot } from './report-model'

export const DRAFT_FIELDS = ['summary', 'investigated', 'outstanding', 'next_steps', 'fixes', 'client_notes'] as const
export type DraftField = (typeof DRAFT_FIELDS)[number]
export type Draft = Record<DraftField, string>

export type ManualResult = { label: string; status: string | null }

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`)
const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const trim = (s: string) => s.replace(/[.\s]+$/, '')

const STATUS_PHRASE: Record<string, string> = {
  approval: 'needs your approval before any work begins',
  client_input: 'needs something from you before I can continue',
  investigating: 'I’m looking into it',
  fixed: 'is fixed',
}

export function draftReportText(s: Snapshot, manual: ManualResult[]): Draft {
  const automatedRan = !s.not_verified.some((n) => n.label === 'Automated checks')
  const issues = s.attention
  const fixedVerified = s.fixed.filter((f) => !!(f.verified && String(f.verified).trim()))
  const recordedManual = manual.filter((m) => m.status && m.status !== 'not_applicable' && m.status !== 'not_checked')

  /* ---- Client summary: overall result, issues, unverified items, next action. ---- */
  const sentences: string[] = []
  if (!automatedRan) sentences.push('The automated check didn’t complete this month, so this report covers only what could be checked.')
  else if (!issues.length && !s.not_verified.length && !fixedVerified.length) sentences.push('Everything agreed for this month was checked and passed.')
  else {
    const parts: string[] = []
    if (issues.length) parts.push(plural(issues.length, 'issue'))
    if (s.not_verified.length) parts.push(`${plural(s.not_verified.length, 'item')} that couldn’t be verified`)
    sentences.push(parts.length ? `This month’s review found ${list(parts)}.` : 'No new issues were found this month.')
  }
  if (issues.length === 1) {
    const a = issues[0]
    sentences.push(`${a.title}${a.pages.length ? ` (${list(a.pages)})` : ''} ${STATUS_PHRASE[a.kind] && a.kind !== 'investigating' ? STATUS_PHRASE[a.kind] : 'is something I’m looking into'}.`)
  } else if (issues.length > 1) {
    sentences.push(`The issues are ${list(issues.map((a) => lower(a.title)))}; each one is listed below with what happens next.`)
  }
  if (fixedVerified.length) sentences.push(`${plural(fixedVerified.length, 'item was', 'items were')} fixed and verified.`)
  const approve = s.next_step.approve
  const send = s.next_step.send
  if (approve.length) sentences.push('Please review the work waiting for your approval below.')
  else if (send.length) sentences.push(`To keep going, I need ${list(send.map((x) => trim(x)))} from you.`)
  else if (automatedRan && !issues.length) sentences.push('Nothing is needed from you this month.')
  const summary = sentences.slice(0, 3).join(' ')

  /* ---- What I looked into: checks actually performed, automated versus by hand. ---- */
  const looked: string[] = []
  if (automatedRan) {
    const pages = s.scope.pages.length
    const kinds: Record<string, number> = {}
    for (const d of s.scope.destinations) kinds[d.kind || 'other'] = (kinds[d.kind || 'other'] || 0) + 1
    const dests = Object.entries(kinds).map(([k, n]) => plural(n, `${k === 'other' ? 'linked' : k} page`))
    looked.push(`Automated checks opened ${plural(pages, 'agreed page')}${dests.length ? ` and ${list(dests)}` : ''} on desktop and phone, checking that pages load securely, images show, layouts fit the screen, and links within the site work.`)
  }
  if (recordedManual.length) {
    const passed = recordedManual.filter((m) => m.status === 'passed').map((m) => lower(m.label))
    const other = recordedManual.filter((m) => m.status !== 'passed').map((m) => lower(m.label))
    looked.push(`Checked by hand: ${list([...passed, ...other])}.`)
  }
  const investigated = looked.join(' ')

  /* ---- Still open: unresolved findings not already in the report. ----
   * Needs attention, Not verified, and "Approved and in progress" already list
   * every open item the records hold, so there's nothing to add here; the
   * field stays empty for anything else you want to mention. */
  const outstanding = ''

  /* ---- Anything else for next month: follow ups the records support, no promises. ---- */
  const follow: string[] = []
  const unverifiedDest = s.not_verified.filter((n) => n.label !== 'Automated checks').map((n) => n.label)
  if (unverifiedDest.length) follow.push(`If you’d like ${list(unverifiedDest)} checked by hand next month, let me know.`)
  if (!automatedRan) follow.push('If the automated check doesn’t complete again, I’ll let you know what’s blocking it.')
  const next_steps = follow.join(' ')

  /* ---- Other notes on work: the work ledger already lists recorded work. ---- */
  const fixes = ''

  /* ---- Note for the client: a specific request only when the records call for one. ---- */
  let client_notes = ''
  if (approve.length) client_notes = `To approve ${list(approve.map((x) => trim(x)))}, reply to this email with your go ahead. Nothing starts until you do.`
  else if (send.length) client_notes = `When you have ${list(send.map((x) => trim(x)))}, reply to this email and I’ll take it from there.`

  return { summary, investigated, outstanding, next_steps, fixes, client_notes }
}

/** Facts the suggestions depend on. A change here makes earlier suggestions outdated. */
export function draftSource(s: Snapshot, manual: ManualResult[]) {
  return JSON.stringify({
    counts: s.counts, checklist: s.checklist.map((r) => [r.label, r.state]), attention: s.attention.map((a) => [a.title, a.pages, a.kind, a.note]), fixed: s.fixed.map((f) => [f.title, !!f.verified]),
    not_verified: s.not_verified.map((n) => n.label), approvals: s.approvals.map((a) => a.title), approved_work: s.approved_work.map((w) => w.title),
    work: (s.work_done || []).map((w) => w.what), next: [s.next_step.approve, s.next_step.send], manual: manual.map((m) => [m.label, m.status]),
    scope: [s.scope.pages.length, s.scope.destinations.length],
  })
}
