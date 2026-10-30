/**
 * Contextual suggestions for the text fields across Website Care: issue
 * notes for the client, how a fix was verified, manual checklist notes and
 * reasons, work descriptions, and estimate scope, deliverables and schedule.
 *
 * Pure (no server imports): the admin screens show the same suggestions the
 * server checks against. The rules:
 * - A suggestion only fills a field when you choose to use it. Text you wrote
 *   is never replaced unless you choose Replace.
 * - Suggestions never decide anything: they don't set a result, a decision,
 *   an approval, or record work. They describe what you already chose.
 * - Nothing claims work was done or a fix was verified unless the data shows
 *   it (an automated recheck), or you confirm you checked it yourself. Those
 *   suggestions carry needs_confirmation, and the server refuses to save that
 *   exact text without your confirmation.
 * Copy rule: no dashes in client facing text.
 */

export type FieldSuggestion = { text: string; needs_confirmation: boolean; basis: string }

type Group = { title: string; pages?: string[]; devices?: string[]; what?: string; why?: string }

const listPages = (pages: string[] = []) => (pages.length === 0 ? 'the agreed pages' : pages.length <= 3 ? pages.join(', ') : `${pages.slice(0, 3).join(', ')} and ${pages.length - 3} more`)
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const devicesText = (d: string[] = []) => (d.length === 2 ? 'on desktop and phone' : d[0] === 'mobile' ? 'on phones' : d[0] === 'desktop' ? 'on desktop' : '')

/** What the client reads next to the decision you chose. Nothing is suggested without a decision. */
export function issueClientNote(g: Group, resolution: string | null | undefined): FieldSuggestion | null {
  const where = listPages(g.pages)
  switch (resolution) {
    case 'approval':
      return { text: `Fixing “${g.title}” on ${where} (estimate below)`, needs_confirmation: false, basis: 'Describes the work you marked as needing approval. Add the estimate before you send.' }
    case 'client_input':
      return { text: `What you’d like done about “${g.title}” on ${where}`, needs_confirmation: false, basis: 'Says what you need from the client; edit it to name the exact detail.' }
    case 'investigating':
      return { text: `I’m finding the cause of “${g.title}” on ${where}`, needs_confirmation: false, basis: 'You marked this as being looked into. It doesn’t promise a fix date.' }
    case 'fixed':
      return { text: `Fixed “${g.title}” on ${where}`, needs_confirmation: false, basis: 'You marked this fixed. The report still needs how you verified it.' }
    default:
      return null
  }
}

/**
 * How the fix was verified. From an automated recheck when the latest check no
 * longer finds the issue; otherwise a hand check you must confirm you did.
 */
export function verificationNote(g: Group, resolution: string | null | undefined, evidence: { clearedOnRecheck: boolean; recheckedOn?: string | null }): FieldSuggestion | null {
  if (resolution !== 'fixed') return null
  if (evidence.clearedOnRecheck) {
    return { text: `Rechecked automatically${evidence.recheckedOn ? ` on ${evidence.recheckedOn}` : ''}: no longer found.`, needs_confirmation: false, basis: 'The latest automated check no longer finds this issue.' }
  }
  const dev = devicesText(g.devices)
  return {
    text: `Checked by hand after the fix${dev ? ` ${dev}` : ''}: “${lower(g.title)}” no longer appears on ${listPages(g.pages)}.`,
    needs_confirmation: true,
    basis: 'No automated recheck shows this yet. Use it only if you checked it yourself.',
  }
}

/** A manual checklist note or reason, for the result you already recorded. */
export function manualSuggestion(m: { label: string; status: string | null | undefined }): { note?: FieldSuggestion; reason?: FieldSuggestion } {
  switch (m.status) {
    case 'passed':
      return { note: { text: `Checked by hand: ${lower(m.label)}.`, needs_confirmation: true, basis: 'Says you checked this yourself. Confirm before using it.' } }
    case 'failed':
      return { note: { text: `Checked by hand: this needs attention. ${m.label} isn’t right yet.`, needs_confirmation: true, basis: 'Says you checked this yourself and found a problem. Add what you saw.' } }
    case 'not_checked':
      return { reason: { text: 'I didn’t check this by hand this month. I’ll check it next month.', needs_confirmation: false, basis: 'Explains a skipped check; it claims nothing was verified.' } }
    case 'could_not_check':
      return { reason: { text: 'I couldn’t check this by hand this month because it wasn’t available when I looked. I’ll try again next month.', needs_confirmation: false, basis: 'Explains why the check couldn’t be done; edit it with the actual reason.' } }
    default:
      return {}
  }
}

/** True when this text is a suggestion that claims a hand check, so saving it needs your confirmation. */
export function needsConfirmation(text: string | null | undefined, candidates: (FieldSuggestion | null | undefined)[]): boolean {
  const t = String(text || '').trim()
  return !!t && candidates.some((c) => c && c.needs_confirmation && c.text.trim() === t)
}

/** The client facing description for a recorded work line: the task’s wording, with the quantity and what it was for. */
export function workDescription(line: { preset_description?: string | null; name?: string | null; quantity: number }, ctx: { estimateTitle?: string | null; issueTitle?: string | null } = {}): FieldSuggestion | null {
  const base = (line.preset_description || line.name || '').trim().replace(/\.$/, '')
  if (!base) return null
  const qty = line.quantity > 1 ? ` (${line.quantity})` : ''
  const why = ctx.estimateTitle ? `, for the approved “${ctx.estimateTitle}”` : ctx.issueTitle ? `, to fix “${ctx.issueTitle}”` : ''
  return { text: `${base}${qty}${why}.`, needs_confirmation: false, basis: 'Built from the task and quantity you chose. It describes only what you’re recording.' }
}

/** A starting estimate for an issue the client needs to approve. Prices and minutes stay yours to enter. */
export function estimateFromIssue(g: Group): { title: FieldSuggestion; scope: FieldSuggestion; deliverables: FieldSuggestion; schedule: FieldSuggestion } {
  const where = listPages(g.pages)
  const dev = devicesText(g.devices)
  const basis = 'From the issue in this month’s check. Minutes and price are left for you.'
  return {
    title: { text: `Fix: ${g.title}`, needs_confirmation: false, basis },
    scope: { text: `Fix “${lower(g.title)}” on ${where}${dev ? ` ${dev}` : ''}.${g.what ? ` What the check found: ${g.what}` : ''}`, needs_confirmation: false, basis },
    deliverables: { text: `${where} updated so “${lower(g.title)}” no longer appears${dev ? ` ${dev}` : ''}, checked after the change and confirmed in the next report.`, needs_confirmation: false, basis },
    schedule: { text: 'Starts after you approve this estimate. I’ll confirm the date when you approve.', needs_confirmation: false, basis: 'Doesn’t promise a date before approval.' },
  }
}
