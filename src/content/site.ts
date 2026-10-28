/**
 * Editable content for the public homepage.
 *
 * Anything marked APPROVAL NEEDED is a proposal, not a live offer.
 * Prices are intentionally null until approved.
 *
 * Draft markers ("Draft" stamps, unapproved FAQs, placeholder prices) are
 * visible in local dev and Vercel preview deployments. On the production
 * deployment, unapproved FAQs are hidden and null prices read "Quote on request".
 *
 * Copy rule: no dashes of any kind in visitor facing text.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com').replace(/\/$/, '')
export const CONTACT_EMAIL = 'alante@alantevelez.com'

/** Show draft markers everywhere except the production deployment. */
export const SHOW_DRAFTS = process.env.VERCEL_ENV !== 'production'

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
  /** Sampled from the live site screenshot so each card wears the client's own brand. */
  brand: { bg: string; ink: string; accent: string; swatches: string[] }
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
    brand: { bg: '#F9F6F1', ink: '#2B1D17', accent: '#B97452', swatches: ['#F9F6F1', '#B97452', '#2B1D17'] },
    whoFor: 'Travelers who want a trip planned around their style, budget, and goals, without spending weeks on research.',
    whatIBuilt:
      'A travel planning website where people browse real trips and order a custom itinerary, with secure checkout, a customer dashboard, and an admin panel for managing orders.',
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
    brand: { bg: '#0B0B0C', ink: '#FFFFFF', accent: '#C0A16B', swatches: ['#050506', '#C0A16B', '#FFFFFF'] },
    whoFor: 'Families who want to be intentional about preparing their sons for leadership, manhood, and life.',
    whatIBuilt:
      'A virtual academy with a custom video lesson player, individual student access, progress tracking, PayPal payments, and Zoom connected sessions.',
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
    brand: { bg: '#051635', ink: '#FFFFFF', accent: '#BF8B39', swatches: ['#051635', '#BF8B39', '#FFFFFF'] },
    whoFor: 'Leaders, teams, and individuals working with Tramaine Crawford through TLC Leadership Consulting and Coaching.',
    whatIBuilt:
      'A coaching website where clients learn about the services and schedule a session through a connected booking calendar.',
    visitorActions: ['Schedule a conversation', 'Explore services', 'Browse resources'],
    role: null,
    concept: false,
  },
]

/* ------------------------------------------------------------------ */
/* Services                                                             */
/* ------------------------------------------------------------------ */

export type Service = { id: string; name: string; body: string; href?: string; hrefLabel?: string }

export const services: Service[] = [
  {
    id: 'new',
    name: 'New Websites',
    body: 'Starting from scratch? I’ll help you figure out which pages you actually need and design a site that feels like you.',
  },
  {
    id: 'redesign',
    name: 'Website Redesigns',
    body: 'Outdated, hard to update, or just not you anymore? I keep what’s working and rebuild the rest.',
  },
  {
    id: 'store',
    name: 'Online Stores',
    body: 'Sell products, gift cards, or digital downloads with a checkout your customers can trust.',
  },
  {
    id: 'booking',
    name: 'Booking and Payments',
    body: 'Let people book appointments, pay deposits, or sign up for classes without the back and forth over text.',
  },
  {
    id: 'custom',
    name: 'Custom Web Applications',
    body: 'Client portals, member areas, dashboards, or a tool built around how your business really works.',
  },
  {
    id: 'care',
    name: 'Website Maintenance',
    body: 'Small updates, regular checks, and a real person to reach when something looks off.',
    href: '#care',
    hrefLabel: 'See care plans',
  },
]

/** Options for the "type of help" field. Keep in sync with services above. */
export const helpOptions = [...services.map((s) => s.name), 'Not sure yet']

/* ------------------------------------------------------------------ */
/* Packages (APPROVAL NEEDED: every number and limit below)             */
/* ------------------------------------------------------------------ */

export type Package = {
  id: string
  name: string
  forWho: string
  /** Starting price in USD. null = not approved yet. */
  startingAt: number | null
  pages: string
  revisions: string
  copywriting: string
  contentEntry: string
  includes: string[]
}

export const packages: Package[] = [
  {
    id: 'essentials',
    name: 'Website Essentials',
    forWho: 'A clear, polished home online for a new or small business.',
    startingAt: null,
    pages: 'Up to 3 pages',
    revisions: '2 rounds',
    copywriting: 'Not included',
    contentEntry: 'Included for the text and photos you provide',
    includes: [
      'Design that works beautifully on phones',
      'Contact form or booking link',
      'Page titles and descriptions for search',
      'Help connecting your domain',
    ],
  },
  {
    id: 'business',
    name: 'Business Website',
    forWho: 'A fuller site for an established business ready to look the part.',
    startingAt: null,
    pages: 'Up to 7 pages',
    revisions: '3 rounds',
    copywriting: 'Editing and polishing of your text',
    contentEntry: 'Included for the text and photos you provide',
    includes: [
      'Custom design shaped around your brand',
      'Booking, contact, or newsletter signup',
      'Connections to tools you already use',
      'A walkthrough so you know how it all works',
    ],
  },
  {
    id: 'custom',
    name: 'Custom Build',
    forWho: 'Stores, payments, member areas, and anything that needs custom features.',
    startingAt: null,
    pages: 'Scoped together',
    revisions: 'Set in your proposal',
    copywriting: 'Available as an add on',
    contentEntry: 'Scoped together',
    includes: [
      'Online stores and payment flows',
      'Logins, portals, or member areas',
      'Integrations with outside services',
      'A written plan before any building starts',
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Care plans (APPROVAL NEEDED: prices, update counts, response times)  */
/* ------------------------------------------------------------------ */

/** Flip to true only once uptime monitoring is actually set up. */
export const UPTIME_MONITORING_CONFIGURED = false

export type CarePlan = {
  id: string
  name: string
  forWho: string
  /** Monthly price in USD. null = not approved yet. */
  monthly: number | null
  /** Small content updates per month. null = not approved yet. */
  updatesPerMonth: number | null
  /** Response time wording. null = not approved yet (never shown in production). */
  responseTime: string | null
  extras: string[]
}

export const carePlans: CarePlan[] = [
  {
    id: 'steady',
    name: 'Steady Care',
    forWho: 'For sites that mostly need to keep working well.',
    monthly: null,
    updatesPerMonth: null,
    responseTime: null,
    extras: [],
  },
  {
    id: 'active',
    name: 'Active Care',
    forWho: 'For businesses that change their site often.',
    monthly: null,
    updatesPerMonth: null,
    responseTime: null,
    extras: ['A larger monthly allowance of content updates', 'Priority in my queue over Steady Care requests'],
  },
]

export const careIncludes = [
  'Monthly checks of your contact forms and booking links',
  'Troubleshooting when something stops working',
  'Software updates and backups, where your platform needs them',
]

export const careExcludes = [
  'New features or new pages',
  'Redesigns',
  'Content you haven’t sent yet, like new photos or menus that still need to be written',
]

/* ------------------------------------------------------------------ */
/* Process                                                              */
/* ------------------------------------------------------------------ */

export const processSteps = [
  {
    name: 'Let’s Chat',
    body: 'Tell me about your business and what isn’t working. We hop on a short call to see if we’re a good fit.',
  },
  {
    name: 'Plan and Design',
    body: 'We agree on the pages, the content, and the feel. You see the design direction before I build anything.',
  },
  {
    name: 'Build and Review',
    body: 'I build it, you click around, and we refine it together in a set number of review rounds.',
  },
  {
    name: 'Launch and Ongoing Care',
    body: 'We go live together. If you’d like me to keep looking after it, a care plan picks up from there.',
  },
]

export const youllNeed = [
  'Your words and photos, or a plan for getting them',
  'One person who can give feedback and make decisions',
  'Quick replies along the way, so nothing stalls',
]

/* ------------------------------------------------------------------ */
/* FAQs (draft: true = unapproved policy, hidden in production)         */
/* ------------------------------------------------------------------ */

export type Faq = { q: string; a: string; draft?: boolean }

export const faqs: Faq[] = [
  {
    q: 'Can you redesign the website I already have?',
    a: 'Yes. I start by looking at what’s working, what isn’t, and what your visitors need. Sometimes that means a fresh look on your current setup, and sometimes it means rebuilding on something easier to manage. Either way, we decide together before anything changes.',
  },
  {
    q: 'Do I need a domain before we start?',
    a: 'No. If you already have one, I’ll connect your new site to it. If not, I’ll help you choose and register one. I recommend keeping it in your name so you always stay in control of it.',
  },
  {
    q: 'Where will my website be hosted?',
    a: 'It depends on what we build. I’ll recommend hosting that fits your site and explain it in plain language. Hosting, domains, and tools like booking or email services usually have their own fees, paid to those providers.',
  },
  {
    q: 'Do I have to write all the words myself?',
    a: 'You know your business best, so your input matters. Each package spells out whether writing help is included. I can always enter the text and photos you send, and I’ll tell you exactly what I need and when.',
  },
  {
    q: 'What happens after launch?',
    a: 'I’ll show you around your new site so you’re comfortable with it. If you’d like ongoing help, a care plan covers small updates and regular checks. Bigger changes, like new features or a redesign, are quoted separately.',
  },
  {
    q: 'Is a care plan required?',
    a: 'No. Care plans are there if you want them. Plenty of people prefer to reach out only when they need something, and that works too.',
    draft: true,
  },
  {
    q: 'Who owns the website when it’s finished?',
    a: 'APPROVAL NEEDED: ownership of the design, code, and accounts after final payment. Add your policy here.',
    draft: true,
  },
  {
    q: 'Is anything fixed for free after launch?',
    a: 'APPROVAL NEEDED: whether there’s a window after launch for fixing issues in the original scope, and how long it lasts.',
    draft: true,
  },
  {
    q: 'How long does a website take?',
    a: 'It depends on the size of the project and how quickly content and feedback come together. You’ll get a timeline in your proposal before any work begins.',
  },
  {
    q: 'Do you work with businesses like mine?',
    a: 'Probably! I work with small businesses, service providers, consultants, creators, restaurants, salons, child care programs, and more. If you’re not sure, just ask.',
  },
]

/* ------------------------------------------------------------------ */
/* Tech details (lower on the page for the curious)                     */
/* ------------------------------------------------------------------ */

export const techGroups = [
  { label: 'Building', items: ['Next.js', 'React', 'TypeScript'] },
  { label: 'Data and logins', items: ['Supabase'] },
  { label: 'Payments', items: ['Stripe', 'PayPal'] },
  { label: 'Email', items: ['Resend'] },
  { label: 'Hosting', items: ['Vercel'] },
  { label: 'Connections', items: ['Zoom', 'Calendly', 'AI APIs', 'Webhooks'] },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
