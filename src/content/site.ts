/**
 * Shared, client safe content for the public site.
 * Offers that still need approval (prices, limits, allowances, policies)
 * live in ./offers.ts, which is server only.
 *
 * Copy rule: no dashes of any kind in visitor facing text.
 */

/** One fallback for every absolute link (metadata, booking links in emails). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com').replace(/\/+$/, '')
export const CONTACT_EMAIL = 'alante@alantevelez.com'

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
/* ------------------------------------------------------------------ */

export const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services & Pricing' },
  { href: '/care', label: 'Website Care' },
  { href: '/about', label: 'About' },
] as const

/* ------------------------------------------------------------------ */
/* Inquiry interests (validated URL parameter: /?interest=<key>#contact) */
/* ------------------------------------------------------------------ */

export const interestGroups = [
  {
    label: 'Services',
    options: [
      { key: 'new', label: 'New Websites' },
      { key: 'redesign', label: 'Website Redesigns' },
      { key: 'store', label: 'Online Stores' },
      { key: 'booking', label: 'Booking and Payments' },
      { key: 'custom', label: 'Custom Web Applications' },
      { key: 'care', label: 'Website Maintenance' },
    ],
  },
  {
    label: 'Project types',
    options: [
      { key: 'pkg-business', label: 'Business Website' },
      { key: 'pkg-booking', label: 'Booking & Payments' },
      { key: 'pkg-custom', label: 'Custom Website or Application' },
    ],
  },
  {
    label: 'Care plans',
    options: [
      { key: 'care-essential', label: 'Essential Care plan' },
      { key: 'care-business', label: 'Business Care plan' },
      { key: 'care-premium', label: 'Premium Care plan' },
      { key: 'support', label: 'Occasional support' },
    ],
  },
] as const

export const UNSURE = { key: 'unsure', label: 'Not sure yet' } as const

export type InterestKey =
  | (typeof interestGroups)[number]['options'][number]['key']
  | typeof UNSURE.key

const interestLabels = new Map<string, string>([
  ...interestGroups.flatMap((g) => g.options.map((o) => [o.key, o.label] as [string, string])),
  [UNSURE.key, UNSURE.label],
])

/** Returns the key only if it is one we offer. Anything else is ignored. */
export function parseInterest(raw: string | null | undefined): InterestKey | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  return interestLabels.has(key) ? (key as InterestKey) : null
}

export function interestLabel(key: string): string | null {
  return interestLabels.get(key) ?? null
}

/** Every inquiry button leads to the homepage form, optionally preselected. */
export function inquiryHref(interest?: InterestKey) {
  return interest ? `/?interest=${interest}#contact` : '/#contact'
}

/* ------------------------------------------------------------------ */
/* Selected work                                                        */
/* ------------------------------------------------------------------ */

export type Project = {
  slug: string
  name: string
  kicker: string
  url: string
  urlLabel: string
  image: { src: string; width: number; height: number; alt: string }
  /** Sampled from each live site so the card wears the client's own brand. */
  brand: { bg: string; accent: string; swatches: string[] }
  whoFor: string
  whatIBuilt: string
  visitorActions: string[]
  /** Leave null unless the role is verified. */
  role: string | null
  concept: boolean
}

export const projects: Project[] = [
  {
    slug: 'planary',
    name: 'Planary',
    kicker: 'Travel planning',
    url: 'https://planarytravel.com',
    urlLabel: 'planarytravel.com',
    image: {
      src: '/planary.png',
      width: 3438,
      height: 1934,
      alt: 'Planary homepage with the headline "We do the research. You enjoy the trip." beside a photo of a hotel pool on the Amalfi Coast',
    },
    brand: { bg: '#F9F6F1', accent: '#B97452', swatches: ['#F9F6F1', '#B97452', '#2B1D17'] },
    whoFor: 'Travelers who want a trip planned around their style and budget.',
    whatIBuilt: 'A travel planning site where people browse real trips and order a custom itinerary, with secure checkout, a customer dashboard, and an admin panel.',
    visitorActions: ['Plan a custom trip', 'Browse real trips', 'Shop travel guides'],
    role: null,
    concept: false,
  },
  {
    slug: 'rising-sons',
    name: 'Rising Sons Leadership Academy',
    kicker: 'Online learning',
    url: 'https://risingsonsacademy.org',
    urlLabel: 'risingsonsacademy.org',
    image: {
      src: '/rising-sons.png',
      width: 3434,
      height: 1922,
      alt: 'Rising Sons Leadership Academy homepage showing a smiling boy studying at a desk beside books labeled Discipline, Focus, and Confidence',
    },
    brand: { bg: '#0B0B0C', accent: '#C0A16B', swatches: ['#050506', '#C0A16B', '#FFFFFF'] },
    whoFor: 'Families preparing their sons for leadership, manhood, and life.',
    whatIBuilt: 'A virtual academy with a custom video lesson player, individual student access, progress tracking, PayPal payments, and Zoom connected sessions.',
    visitorActions: ['Explore the pathway', 'Join a membership', 'Access lessons'],
    role: null,
    concept: false,
  },
  {
    slug: 'tramaine-crawford',
    name: 'Tramaine Crawford',
    kicker: 'Coaching and consulting',
    url: 'https://tramainecrawford.com',
    urlLabel: 'tramainecrawford.com',
    image: {
      src: '/tramaine.png',
      width: 3446,
      height: 1974,
      alt: 'TLC Leadership Consulting and Coaching homepage with the headline "Helping people grow, lead, and create greater impact" beside a team meeting photo',
    },
    brand: { bg: '#051635', accent: '#BF8B39', swatches: ['#051635', '#BF8B39', '#FFFFFF'] },
    whoFor: 'Leaders, teams, and individuals working with TLC Leadership Consulting and Coaching.',
    whatIBuilt: 'A coaching site where clients learn about the services and book a session through a connected calendar.',
    visitorActions: ['Schedule a conversation', 'Explore services', 'Browse resources'],
    role: null,
    concept: false,
  },
]

/* ------------------------------------------------------------------ */
/* Services                                                             */
/* ------------------------------------------------------------------ */

export type Service = { id: InterestKey; name: string; short: string; body: string }

export const services: Service[] = [
  {
    id: 'new',
    name: 'New Websites',
    short: 'A site that feels like you, from scratch.',
    body: 'Starting from scratch? I’ll help you figure out which pages you actually need and design a site that feels like you.',
  },
  {
    id: 'redesign',
    name: 'Website Redesigns',
    short: 'Keep what works, rebuild the rest.',
    body: 'Outdated, hard to update, or just not you anymore? I keep what’s working and rebuild the rest. A redesign can fit any project type, depending on scope.',
  },
  {
    id: 'store',
    name: 'Online Stores',
    short: 'Sell products with a checkout people trust.',
    body: 'Sell products, gift cards, or digital downloads with a checkout your customers can trust.',
  },
  {
    id: 'booking',
    name: 'Booking and Payments',
    short: 'Appointments, deposits, and class signups.',
    body: 'Let people book appointments, pay deposits, or sign up for classes without the back and forth over text.',
  },
  {
    id: 'custom',
    name: 'Custom Web Applications',
    short: 'Portals, member areas, and custom tools.',
    body: 'Client portals, member areas, dashboards, or a tool built around how your business really works.',
  },
  {
    id: 'care',
    name: 'Website Maintenance',
    short: 'Checks, updates, and help after launch.',
    body: 'Regular checks, a monthly report, flexible time for updates, fixes, or new features, and a real person to reach when something looks off.',
  },
]

/* ------------------------------------------------------------------ */
/* Process                                                              */
/* ------------------------------------------------------------------ */

export const processSteps = [
  { name: 'Let’s Chat', body: 'Tell me about your business and what isn’t working. We hop on a short call to see if we’re a good fit.' },
  { name: 'Plan and Design', body: 'We agree on the pages, the content, and the feel. You see the design direction before I build anything.' },
  { name: 'Build and Review', body: 'I build it, you click around, and we refine it together through two consolidated revision rounds.' },
  { name: 'Launch and Ongoing Care', body: 'We go live together. If you’d like me to keep looking after it, a care plan picks up from there.' },
]

export const youllNeed = [
  'Your words and photos, or a plan for getting them',
  'One person who can give feedback and make decisions',
  'Quick replies along the way, so nothing stalls',
]

/* ------------------------------------------------------------------ */
/* About (verified by Alante)                                           */
/* ------------------------------------------------------------------ */

export const about = {
  location: 'Based in Maryland, working with businesses nationwide.',
  background: 'Bachelor’s degree in Information Technology, with a background in IT support.',
}

export const techGroups = [
  { label: 'Building', items: ['Next.js', 'React', 'TypeScript'] },
  { label: 'Data and logins', items: ['Supabase'] },
  { label: 'Payments', items: ['Stripe', 'PayPal'] },
  { label: 'Email', items: ['Resend'] },
  { label: 'Hosting', items: ['Vercel'] },
  { label: 'Connections', items: ['Zoom', 'Calendly', 'AI APIs', 'Webhooks'] },
]
