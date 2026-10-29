/**
 * Website enrollment: validation, the setup fingerprint, and confirmation.
 * Payment alone never starts a scan: a site must be confirmed by the owner
 * (website, authorization, and checklist), and any later change to what gets
 * checked returns it to draft until it is confirmed again.
 */
import { createHash, randomUUID } from 'node:crypto'
import { db, must, CareError, logActivity, type Row } from './db'
import { isPlanId, type PlanId } from './plans'
import { checkUrlShape, checkUrlResolves, normalizeDomain, hostInDomains } from './url-safety'

export const LIMIT_DEFAULTS = { maxPages: 15, maxLinks: 60, concurrency: 2, navTimeoutMs: 30000, runTimeoutMs: 360000 }
export const LIMIT_CAPS = { maxPages: 25, maxLinks: 150, concurrency: 3, navTimeoutMs: 45000, runTimeoutMs: 480000 }

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

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export type SiteInput = {
  client_id: string
  label: string
  site_url: string
  approved_domains: string[]
  plan: PlanId
  /** The client's agreed monthly price in whole dollars; null until recorded. */
  agreed_monthly_price: number | null
  pages: Page[]
  destinations: Destination[]
  features: string
  manual_checklist: ChecklistItem[]
  recipient_name: string
  recipient_email: string
  review_window_days: number | null
  scan_limits: Record<string, number>
  is_additional_site: boolean
  additional_site_terms: string
  internal_notes: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validates and normalizes what the admin form sends. Returns field errors. */
export function parseSiteInput(body: Record<string, unknown>): { value: SiteInput; errors: string[] } {
  const errors: string[] = []
  const client_id = str(body.client_id, 64)
  if (!/^[0-9a-f-]{36}$/i.test(client_id)) errors.push('Choose the client record this website belongs to.')
  const label = str(body.label, 120) || 'Website'
  const plan = body.plan
  if (!isPlanId(plan)) errors.push('Choose a care plan.')
  const site_url = str(body.site_url, 500)
  const approved_domains = Array.from(new Set((Array.isArray(body.approved_domains) ? body.approved_domains : String(body.approved_domains || '').split(/[\s,]+/))
    .map((d) => normalizeDomain(String(d))).filter(Boolean))).slice(0, 10)
  if (!approved_domains.length) errors.push('Add at least one approved domain.')
  const shape = checkUrlShape(site_url, approved_domains)
  if (!shape.ok) errors.push(`Website address: ${shape.reason}`)

  const pagesIn = Array.isArray(body.pages) ? body.pages : []
  const pages: Page[] = []
  for (const p of pagesIn.slice(0, LIMIT_CAPS.maxPages)) {
    const url = str((p as Page)?.url, 500)
    if (!url) continue
    const c = checkUrlShape(url, approved_domains)
    if (!c.ok) errors.push(`Page ${url}: ${c.reason}`)
    pages.push({ url: c.ok ? c.url.toString() : url, label: str((p as Page)?.label, 80) || new URL(c.ok ? c.url : 'https://x/').pathname })
  }
  if (pagesIn.length > LIMIT_CAPS.maxPages) errors.push(`Up to ${LIMIT_CAPS.maxPages} agreed pages per website.`)

  const destinations: Destination[] = []
  for (const d of (Array.isArray(body.destinations) ? body.destinations : []).slice(0, 10)) {
    const url = str((d as Destination)?.url, 500)
    if (!url) continue
    const kind = ['contact', 'booking', 'checkout', 'other'].includes((d as Destination)?.kind) ? (d as Destination).kind : 'other'
    // Destinations may be on a third party (a booking service, a checkout page) because
    // each one is listed here explicitly. They are only opened, never used.
    const c = checkUrlShape(url)
    if (!c.ok) errors.push(`Destination ${url}: ${c.reason}`)
    destinations.push({ kind, url: c.ok ? c.url.toString() : url, label: str((d as Destination)?.label, 80) || kind })
  }

  const manual_checklist: ChecklistItem[] = []
  const seen = new Set<string>()
  for (const it of (Array.isArray(body.manual_checklist) ? body.manual_checklist : []).slice(0, 30)) {
    const lab = str((it as ChecklistItem)?.label, 160)
    if (!lab) continue
    let id = str((it as ChecklistItem)?.id, 60).replace(/[^a-z0-9-]/gi, '').toLowerCase() || randomUUID().slice(0, 8)
    while (seen.has(id)) id = `${id}-${randomUUID().slice(0, 4)}`
    seen.add(id)
    manual_checklist.push({ id, label: lab, category: str((it as ChecklistItem)?.category, 40) || 'Other', instructions: str((it as ChecklistItem)?.instructions, 400) })
  }

  const recipient_email = str(body.recipient_email, 200).toLowerCase()
  if (recipient_email && !EMAIL_RE.test(recipient_email)) errors.push('Report recipient email is not valid.')

  const rw = body.review_window_days === null || body.review_window_days === '' || body.review_window_days === undefined ? null : Number(body.review_window_days)
  if (rw !== null && (!Number.isInteger(rw) || rw < 1 || rw > 28)) errors.push('Review window must be 1 to 28 days.')

  const limitsIn = (body.scan_limits && typeof body.scan_limits === 'object' ? body.scan_limits : {}) as Record<string, unknown>
  const scan_limits: Record<string, number> = {}
  for (const k of Object.keys(LIMIT_DEFAULTS) as (keyof typeof LIMIT_DEFAULTS)[]) {
    const n = Number(limitsIn[k])
    if (limitsIn[k] !== undefined && limitsIn[k] !== '' && Number.isFinite(n)) scan_limits[k] = Math.max(1, Math.min(LIMIT_CAPS[k], Math.round(n)))
  }

  const priceIn = body.agreed_monthly_price
  const agreed_monthly_price = priceIn === null || priceIn === undefined || priceIn === '' ? null : Number(priceIn)
  if (agreed_monthly_price !== null && (!Number.isInteger(agreed_monthly_price) || agreed_monthly_price < 0 || agreed_monthly_price > 100000)) errors.push('Agreed monthly price must be a whole dollar amount.')

  const is_additional_site = body.is_additional_site === true
  const additional_site_terms = str(body.additional_site_terms, 400)

  return {
    value: {
      client_id, label, site_url: shape.ok ? shape.url.toString() : site_url, approved_domains, plan: plan as PlanId, agreed_monthly_price, pages, destinations,
      features: str(body.features, 2000), manual_checklist, recipient_name: str(body.recipient_name, 120), recipient_email,
      review_window_days: rw, scan_limits, is_additional_site, additional_site_terms, internal_notes: str(body.internal_notes, 4000),
    },
    errors,
  }
}

/** Fingerprint of everything that decides what gets checked and for whom. */
export function setupHash(s: Pick<SiteInput, 'site_url' | 'approved_domains' | 'pages' | 'destinations' | 'manual_checklist' | 'scan_limits' | 'client_id'>): string {
  const canon = JSON.stringify({
    c: s.client_id, u: s.site_url, d: [...s.approved_domains].sort(), p: s.pages.map((p) => p.url), x: s.destinations.map((d) => [d.kind, d.url]),
    m: s.manual_checklist.map((m) => [m.id, m.label]), l: s.scan_limits,
  })
  return createHash('sha256').update(canon).digest('hex')
}

export function limitsFor(site: { scan_limits?: Record<string, number> | null }) {
  return { ...LIMIT_DEFAULTS, ...(site.scan_limits || {}) }
}

/** The frozen configuration a scan run uses, so later edits don't change a run in flight. */
export function scanConfig(site: Row) {
  const pages: Page[] = site.pages?.length ? site.pages : [{ url: site.site_url, label: 'Home' }]
  return {
    site_url: site.site_url,
    approved_domains: site.approved_domains,
    pages,
    destinations: site.destinations || [],
    limits: limitsFor(site),
    viewports: { desktop: { width: 1366, height: 900 }, mobile: { width: 390, height: 844 } },
  }
}

/** Checks a second website for the same client has written pricing terms. */
export async function assertSitePricing(input: SiteInput, siteId?: string) {
  const res = await db.from('care_sites').select('id, enrollment_status').eq('client_id', input.client_id).neq('enrollment_status', 'ended')
  const others = (res.data || []).filter((s: { id: string }) => s.id !== siteId)
  if (others.length > 0 && (!input.is_additional_site || input.additional_site_terms.length < 5)) {
    throw new CareError('This client already has an enrolled website. A second website needs its own plan or written pricing terms (mark it as an additional site and describe the agreed price).')
  }
}

export async function assertClient(clientId: string) {
  const c = await db.from('clients').select('id, name, email, business').eq('id', clientId).maybeSingle()
  if (c.error) throw new CareError(c.error.message, 500)
  if (!c.data) throw new CareError('That client record does not exist.', 400)
  return c.data as { id: string; name: string | null; email: string | null; business: string | null }
}

/** Confirmation gate. Checks DNS too, so a domain pointing at a private network is refused. */
export async function confirmSite(siteId: string, body: { authorization_note?: string; confirm_website?: boolean; confirm_authorization?: boolean; confirm_checklist?: boolean }, actor: string) {
  const site = must(await db.from('care_sites').select('*').eq('id', siteId).single(), 'Website')
  const problems: string[] = []
  if (!body.confirm_website) problems.push('Confirm the website address and pages are the agreed scope.')
  if (!body.confirm_authorization) problems.push('Confirm the client authorized these checks.')
  if (!body.confirm_checklist) problems.push('Confirm the manual checklist.')
  const note = str(body.authorization_note, 1000)
  if (note.length < 5) problems.push('Describe how the client authorized the checks (for example, the signed care agreement and date).')
  if (!site.recipient_email) problems.push('Add the report recipient email.')
  if (!site.manual_checklist?.length) problems.push('Add at least one manual checklist item.')
  if (site.enrollment_status === 'ended') problems.push('This website has ended care. Create a new enrollment instead.')
  const check = await checkUrlResolves(site.site_url, site.approved_domains)
  if (!check.ok) problems.push(`Website address: ${check.reason}`)
  for (const p of site.pages || []) {
    if (!hostInDomains(new URL(p.url).hostname, site.approved_domains)) problems.push(`Page ${p.url} is outside the approved domains.`)
  }
  if (problems.length) throw new CareError(problems.join(' '), 422)
  await assertClient(site.client_id)
  const hash = setupHash(site)
  const upd = await db.from('care_sites')
    .update({ enrollment_status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_hash: hash, authorization_note: note, updated_at: new Date().toISOString() })
    .eq('id', siteId).select('*').single()
  const saved = must(upd, 'Website')
  await logActivity({ site_id: siteId, actor, action: 'enrollment_confirmed', detail: { hash: hash.slice(0, 12) } })
  return saved
}
