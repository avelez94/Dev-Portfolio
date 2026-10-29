/**
 * Public sample reports for the Website Care page. Fictional businesses on
 * example.com addresses, built with the real report model so the samples
 * match exactly what clients receive. Nothing here reads client data.
 * Copy rule: no dashes in client facing text.
 */
import { buildReport, type FindingIn, type ModelInput } from '@/lib/care/report-model'
import { plan } from '@/lib/care/plans'

const pass = (check_key: string, url: string, viewport: string | null = 'desktop'): FindingIn => ({ check_key, status: 'passed', url, viewport, issue_code: 'ok' })
const pageSet = (url: string) => [
  pass('page_load', url, 'desktop'), pass('page_load', url, 'mobile'), pass('https', url, 'desktop'),
  pass('images', url, 'desktop'), pass('images', url, 'mobile'), pass('overflow', url, 'desktop'), pass('overflow', url, 'mobile'),
]

function base(p: Pick<ModelInput, 'client' | 'recipient' | 'site' | 'pages' | 'destinations'> & { planId: 'essential' | 'business' | 'premium' }): Omit<ModelInput, 'findings' | 'earlierFindings' | 'manual' | 'notes' | 'content'> {
  const pl = plan(p.planId)
  return {
    reportId: 'sample', cycleId: 'sample', version: 1, sample: true,
    client: p.client, recipient: p.recipient, site: p.site, pages: p.pages, destinations: p.destinations,
    plan: { id: pl.id, name: pl.name, includedMinutes: pl.includedMinutes },
    period: { start: 'Wed, October 1, 2026', end: 'Sun, November 1, 2026', label: 'October 2026' },
    reviewDate: 'Thu, October 2, 2026',
    scanStatus: 'succeeded',
  }
}

/* ------------------------------------------------------------------ */
/* Sample 1: nothing outstanding                                        */
/* ------------------------------------------------------------------ */

const bakeryPages = [
  { label: 'Home', url: 'https://www.example.com/' },
  { label: 'Menu', url: 'https://www.example.com/menu' },
  { label: 'Visit us', url: 'https://www.example.com/visit' },
  { label: 'Contact', url: 'https://www.example.com/contact' },
]
const bakery = buildReport({
  ...base({
    planId: 'business',
    client: { name: 'Jordan Reyes', business: 'Harbor Street Bakery' },
    recipient: { name: 'Jordan Reyes', email: 'owner@example.com' },
    site: { label: 'Harbor Street Bakery', url: 'https://www.example.com' },
    pages: bakeryPages,
    destinations: [{ label: 'Catering order form', url: 'https://orders.example.com/catering', kind: 'booking' }],
  }),
  findings: [
    ...bakeryPages.flatMap((p) => pageSet(p.url)),
    pass('internal_links', 'https://www.example.com', null),
    pass('destination', 'https://orders.example.com/catering'),
  ],
  earlierFindings: [],
  manual: [
    { item_id: 'visual', label: 'Desktop and phone appearance look right', status: 'passed', note: 'Checked on a laptop and a phone.' },
    { item_id: 'content', label: 'Hours, prices, and contact details are correct', status: 'passed', note: 'Matches the hours you sent on September 28.' },
    { item_id: 'contact-form', label: 'Contact form message arrives in the inbox', status: 'passed', note: 'Test message arrived in your shared inbox.' },
    { item_id: 'payments', label: 'Online payment test', status: 'not_applicable' },
  ],
  notes: [],
  content: {
    summary: 'Your site is in good shape this month. Every agreed check passed, and the contact form test message reached your inbox.',
    fixes: 'Updated the holiday hours on the home and visit pages (10 minutes of your included time).',
  },
})

/* ------------------------------------------------------------------ */
/* Sample 2: one issue and one item not verified                        */
/* ------------------------------------------------------------------ */

// The same explanation is used for both booking items, so the report lists them together once.
const BOOKING_NOTE = 'The automated check was blocked. The booking service was also unavailable during my manual review, so I couldn’t verify booking. I’ll recheck next week.'

const physioPages = [
  { label: 'Home', url: 'https://physio.example.com/' },
  { label: 'Services', url: 'https://physio.example.com/services' },
  { label: 'Team', url: 'https://physio.example.com/team' },
  { label: 'Contact', url: 'https://physio.example.com/contact' },
]
const team = 'https://physio.example.com/team'
const physio = buildReport({
  ...base({
    planId: 'business',
    client: { name: 'Sam Patel', business: 'Northside Physio' },
    recipient: { name: 'Sam Patel', email: 'frontdesk@example.com' },
    site: { label: 'Northside Physio', url: 'https://physio.example.com' },
    pages: physioPages,
    destinations: [{ label: 'Online booking', url: 'https://booking.example.com/northside', kind: 'booking' }],
  }),
  findings: [
    ...physioPages.flatMap((p) => pageSet(p.url).filter((f) => !(p.url === team && f.check_key === 'overflow' && f.viewport === 'mobile'))),
    { check_key: 'overflow', issue_code: 'overflow', status: 'failed', url: team, viewport: 'mobile', evidence: { overflow_px: 212 } },
    pass('internal_links', 'https://physio.example.com', null),
    { check_key: 'destination', issue_code: 'blocked_by_site', status: 'could_not_check', url: 'https://booking.example.com/northside', viewport: 'desktop', evidence: { http_status: 403 } },
  ],
  // An earlier check this month found a broken link; it was fixed and the recheck no longer finds it.
  earlierFindings: [{ check_key: 'internal_links', issue_code: 'link_broken', status: 'failed', url: 'https://physio.example.com/old-pricing', evidence: { found_on: 'https://physio.example.com/services', http_status: 404 } }],
  manual: [
    { item_id: 'visual', label: 'Desktop appearance looks right', status: 'passed', note: 'Checked on a laptop.' },
    { item_id: 'content', label: 'Hours, prices, and contact details are correct', status: 'passed', note: 'Matches your September price list.' },
    { item_id: 'booking', label: 'Booking shows open times and the steps make sense', status: 'not_checked', reason: BOOKING_NOTE },
  ],
  notes: [
    { group_key: 'overflow:overflow', resolution: 'approval', client_note: 'Rebuilding the team section so photos resize on phones' },
    { group_key: 'destination:blocked_by_site', resolution: null, client_note: BOOKING_NOTE },
    { group_key: 'internal_links:link_broken', resolution: 'fixed', verification_note: 'Rechecked automatically: no longer found.', client_note: '' },
  ],
  content: {
    summary: 'One issue needs your approval: the team page doesn’t fit phone screens. I couldn’t verify online booking this month; details are below.',
    fixes: 'Fixed a broken link on the services page that pointed to the old pricing page (5 minutes of your included time).',
    estimate: 'about 1.5 hours, $150',
    extra_work_reason: 'Rebuilding the team section is redesign work, which your plan quotes separately. Your 30 included minutes cover content updates and troubleshooting, so they don’t apply to this. The broken link fix used 5 of them, and the other 25 stay available this month.',
  },
})

export const CARE_SAMPLES = [
  { slug: 'all-clear', title: 'No outstanding issues', business: 'Harbor Street Bakery', snapshot: bakery },
  { slug: 'needs-attention', title: 'An issue and an unverified item', business: 'Northside Physio', snapshot: physio },
] as const

export function careSample(slug: string) {
  return CARE_SAMPLES.find((s) => s.slug === slug) || null
}
