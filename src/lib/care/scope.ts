/**
 * Suggested enrollment scope and the manual checks a website must have.
 * Pure (no server imports), so the admin form and the server apply the same
 * rules. Suggestions only fill the form; every item stays editable. Required
 * checks can be reworded but not removed while what requires them is in the
 * scope: a booking destination needs the booking check, a contact form needs
 * the contact form check, and so on.
 */
export type Page = { url: string; label: string }
export type Destination = { kind: 'contact' | 'booking' | 'checkout' | 'other'; url: string; label: string }
export type ChecklistItem = { id: string; label: string; category: string; instructions?: string }

export const CHECKLIST_TEMPLATE: ChecklistItem[] = [
  { id: 'visual-desktop', category: 'Appearance', label: 'Desktop appearance looks right', instructions: 'Compare the desktop screenshots with the live site. Look for broken layouts, missing images, and overlapping text.' },
  { id: 'visual-mobile', category: 'Appearance', label: 'Mobile appearance looks right', instructions: 'Check the mobile screenshots and open the site on a phone.' },
  { id: 'content-details', category: 'Content', label: 'Hours, prices, and contact details are correct', instructions: 'Compare against the details the client last confirmed.' },
  { id: 'contact-form', category: 'Forms', label: 'Contact form sends and arrives in the inbox', instructions: 'Send one clearly labeled test message and confirm it reaches the agreed inbox.' },
  { id: 'booking', category: 'Booking', label: 'Booking shows availability and the steps make sense', instructions: 'Open the booking page and look at availability. Do not book a real appointment.' },
  { id: 'payments', category: 'Payments', label: 'Payment works through the approved test process', instructions: 'Only if the client approved a test process in writing. Otherwise mark Not applicable.' },
  { id: 'updates-backups', category: 'Maintenance', label: 'Updates or backups verified', instructions: 'Only where updates or backups are in the agreed scope.' },
]

type ScopeIn = { site_url?: string; pages?: Page[]; destinations?: Destination[]; features?: string; manual_checklist?: ChecklistItem[] }
export type Requirement = { id: string; reason: string }

const mentions = (text: string, re: RegExp) => re.test(String(text || '').toLowerCase())

/** The manual checks this scope requires, with why. */
export function requiredChecks(s: ScopeIn): Requirement[] {
  const kinds = new Set((s.destinations || []).map((d) => d.kind))
  const f = s.features || ''
  const r: Requirement[] = [
    { id: 'visual-desktop', reason: 'Every plan checks the agreed pages by hand on a desktop.' },
    { id: 'visual-mobile', reason: 'Every plan checks the agreed pages by hand on a phone.' },
  ]
  if (kinds.has('booking') || mentions(f, /\bbook(ing|ings)?\b|appointment|reservation/)) r.push({ id: 'booking', reason: 'The scope includes online booking. Opening the booking page doesn’t prove booking works.' })
  if (kinds.has('contact') || mentions(f, /contact form|\bforms?\b|inquiry|enquiry/)) r.push({ id: 'contact-form', reason: 'The scope includes a form. Opening the page doesn’t prove messages arrive.' })
  if (kinds.has('checkout') || mentions(f, /checkout|payment|\bshop\b|store|order online|cart/)) r.push({ id: 'payments', reason: 'The scope includes payments. Record a result each month; use Not applicable with a reason if no test process is approved.' })
  if (mentions(f, /update|backup|plugin|wordpress/)) r.push({ id: 'updates-backups', reason: 'The scope mentions updates or backups.' })
  return r
}

/** Required checks missing from the checklist (matched by id). */
export function missingRequired(s: ScopeIn): (Requirement & { label: string })[] {
  const have = new Set((s.manual_checklist || []).map((m) => m.id))
  return requiredChecks(s).filter((x) => !have.has(x.id)).map((x) => ({ ...x, label: CHECKLIST_TEMPLATE.find((t) => t.id === x.id)?.label || x.id }))
}

export type ScopeSuggestion = {
  pages: (Page & { why: string })[]
  checklist: (ChecklistItem & { required: boolean; why: string })[]
}

/**
 * A starting scope to review: the home page, an existing contact page guess
 * only when the scope mentions one, every required check, and the content
 * details check. Nothing is saved until you save the form.
 */
export function suggestScope(s: ScopeIn): ScopeSuggestion {
  const pages: ScopeSuggestion['pages'] = []
  const existing = new Set((s.pages || []).map((p) => p.url))
  let origin = ''
  try { origin = new URL(String(s.site_url || '')).origin } catch { /* no address yet */ }
  if (origin && !existing.has(`${origin}/`)) pages.push({ url: `${origin}/`, label: 'Home', why: 'The home page is always checked.' })
  const req = requiredChecks(s)
  const checklist: ScopeSuggestion['checklist'] = []
  for (const r of req) {
    const t = CHECKLIST_TEMPLATE.find((x) => x.id === r.id)
    if (t) checklist.push({ ...t, required: true, why: r.reason })
  }
  if (!req.some((r) => r.id === 'content-details')) {
    const t = CHECKLIST_TEMPLATE.find((x) => x.id === 'content-details')!
    checklist.push({ ...t, required: false, why: 'Suggested: hours, prices and contact details change often.' })
  }
  return { pages, checklist }
}
