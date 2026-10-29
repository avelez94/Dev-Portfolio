import 'server-only'

/**
 * Offers and policies. SERVER ONLY.
 *
 * Everything in this file is approved by Alante (October 2026) EXCEPT values
 * wrapped in `proposed(...)`. Proposed values render only when drafts are
 * visible and are left out of the page entirely otherwise. To publish one,
 * change `proposed(x)` to `approved(x)` after signing off on it.
 *
 * Drafts are visible only when one of these is true:
 *   SHOW_DRAFTS=true            (any host, set it on preview builds only)
 *   VERCEL_ENV=preview          (Vercel preview deployments)
 *   NODE_ENV=development        (npm run dev)
 * Any other build, including production on hosts other than Vercel, hides them.
 *
 * After editing this file, regenerate the pricing guide PDF (docs/OFFER_UPDATES.md).
 * `npm run build` fails until the PDF matches.
 *
 * Copy rule: no dashes of any kind in visitor facing text.
 */

export const SHOW_DRAFTS =
  process.env.SHOW_DRAFTS === 'true' ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.NODE_ENV === 'development'

export type Offer<T> = { value: T; approved: boolean }

const proposed = <T,>(value: T): Offer<T> => ({ value, approved: false })
const approved = <T,>(value: T): Offer<T> => ({ value, approved: true })

/** The value if it may be shown in this build, otherwise null. */
export function shown<T>(o: Offer<T>): T | null {
  return o.approved || SHOW_DRAFTS ? o.value : null
}

export function isDraft(o: Offer<unknown>): boolean {
  return !o.approved
}

export function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

/* ------------------------------------------------------------------ */
/* Project categories (approved)                                        */
/* ------------------------------------------------------------------ */

export type Package = {
  id: 'business' | 'booking' | 'custom'
  interest: 'pkg-business' | 'pkg-booking' | 'pkg-custom'
  name: string
  forWho: string
  priceLabel: string
  price: number
  listLabel: string
  items: string[]
  notes: string[]
  cta: string
}

export const packages: Package[] = [
  {
    id: 'business',
    interest: 'pkg-business',
    name: 'Business Website',
    forWho: 'For businesses that need a professional online presence and a clear way for visitors to inquire.',
    priceLabel: 'Starting at',
    price: 1500,
    listLabel: 'Includes',
    items: [
      'Up to five core pages',
      'Design tailored to your business',
      'Layouts that work well on phones',
      'One inquiry form and links to your social profiles',
      'Basic page titles and search descriptions',
      'Entry of the text and images you provide, with light editing',
      'Two consolidated revision rounds within the agreed scope',
      'Connecting your domain',
      'A handoff walkthrough',
    ],
    notes: [
      'A simple link to a booking page you already use can be included.',
      'Full copywriting, branding, photography, extra pages, large content moves, and new functionality are quoted separately.',
    ],
    cta: 'Ask About a Business Website',
  },
  {
    id: 'booking',
    interest: 'pkg-booking',
    name: 'Booking & Payments',
    forWho: 'For businesses that want customers to book appointments and pay online.',
    priceLabel: 'Starting at',
    price: 2500,
    listLabel: 'Everything in Business Website, plus',
    items: [
      'Setup and connection of one agreed booking service',
      'One agreed payment flow, such as an appointment deposit',
      'The standard confirmations your chosen services support',
      'Testing of the full booking and payment journey',
    ],
    notes: [
      'I use existing booking and payment services where they fit. Fully custom scheduling, complex pricing rules, multiple workflows, and extra integrations are quoted separately.',
      'Provider subscriptions and transaction fees are separate.',
    ],
    cta: 'Ask About Booking & Payments',
  },
  {
    id: 'custom',
    interest: 'pkg-custom',
    name: 'Custom Website or Application',
    forWho: 'For online stores, portals, membership sites, academies, dashboards, and custom business tools.',
    priceLabel: 'Projects starting at',
    price: 5000,
    listLabel: 'Possible features',
    items: [
      'Accounts and logins',
      'Permissions for different kinds of users',
      'Databases for your records',
      'Payments, subscriptions, or online sales',
      'Lessons and course content',
      'Reporting and dashboards',
      'Automated emails and workflows',
    ],
    notes: [
      'Not every feature is included at the starting price. We choose what your project needs together.',
      'Every custom project starts with discovery and a written scope. Larger projects may use milestone payments.',
    ],
    cta: 'Discuss a Custom Project',
  },
]

/* ------------------------------------------------------------------ */
/* Payments, revisions, and the period after launch (approved)          */
/* ------------------------------------------------------------------ */

export const projectTerms = [
  {
    title: 'Payments',
    body: 'For standard website projects, 50% is due upfront to reserve your spot and begin work. The remaining 50% is due at delivery, before public launch or final handoff. Larger custom projects use payment milestones defined in the proposal.',
  },
  {
    title: 'Revisions',
    body: 'You get two consolidated revision rounds within the agreed scope. A round is one collected list of feedback, so gather everything you’d like changed and send it together.',
  },
  {
    title: 'Changes to the plan',
    body: 'New features or changes to the agreed scope get their own estimate before any work on them begins.',
  },
  {
    title: '30 days after launch',
    body: 'If you find a defect in the work I delivered, measured against the agreed scope, report it within 30 days of launch and I’ll fix it without using any paid care time. New requests, your own changes, and changes made by outside services are handled separately.',
  },
]

/* ------------------------------------------------------------------ */
/* The three separate costs (approved)                                  */
/* ------------------------------------------------------------------ */

export const costs = [
  { name: 'Project fee', body: 'Design, development, testing, and launch of your site.' },
  { name: 'Provider costs', body: 'Your domain, hosting, booking tools, email delivery, and any other services the project needs.' },
  { name: 'Optional care fee', body: 'Agreed checks, content updates, and support after launch, if you choose a care plan.' },
]

export const costsNote =
  'Wherever practical, provider accounts are set up in your name and billed to you directly, so you stay in control. Which services your project needs, and what they charge, is reviewed together for each project.'

/* ------------------------------------------------------------------ */
/* Care plans (approved)                                                */
/* ------------------------------------------------------------------ */

/** Flip to true only once uptime monitoring is actually set up. */
export const UPTIME_MONITORING_CONFIGURED = false

export type CarePlan = {
  id: 'essential' | 'business' | 'premium'
  interest: 'care-essential' | 'care-business' | 'care-premium'
  name: string
  forWho: string
  monthly: number
  /** Monthly time for content updates or troubleshooting. null = none included. */
  minutes: number | null
  items: string[]
  cta: string
}

export const carePlans: CarePlan[] = [
  {
    id: 'essential',
    interest: 'care-essential',
    name: 'Essential Care',
    forWho: 'Regular checks so you know your site is working.',
    monthly: 59,
    minutes: null,
    items: [
      'Scheduled monthly checks of agreed pages, contact forms, and booking links, where applicable',
      'A brief monthly status update',
      'Content changes and fixes you request are quoted separately',
    ],
    cta: 'Ask About Essential Care',
  },
  {
    id: 'business',
    interest: 'care-business',
    name: 'Business Care',
    forWho: 'Checks plus time each month for small updates.',
    monthly: 129,
    minutes: 30,
    items: ['Everything in Essential Care', 'Up to 30 minutes a month for content updates or troubleshooting'],
    cta: 'Ask About Business Care',
  },
  {
    id: 'premium',
    interest: 'care-premium',
    name: 'Premium Care',
    forWho: 'Checks plus more time for sites that change often.',
    monthly: 249,
    minutes: 90,
    items: ['Everything in Essential Care', 'Up to 90 minutes a month for content updates or troubleshooting'],
    cta: 'Ask About Premium Care',
  },
]

export const updateExamples = [
  'Changing business hours or contact details',
  'Replacing an existing photo',
  'Updating posted prices',
  'Editing existing text or links',
]

export const careBoundaries = [
  'For 30 days after launch, defects in the work I delivered are fixed without using any care time.',
  'Included time renews each month and doesn’t roll over.',
  'Troubleshooting and diagnosis count toward your included time.',
  'Larger fixes are estimated, and you approve them before any extra work begins.',
  'New pages, new features, redesigns, large content changes, and emergency recovery are quoted separately.',
  'Hosting, domains, provider subscriptions, and transaction fees are separate.',
  'There’s no round the clock emergency service or guaranteed fix deadline.',
  'Care plans are optional.',
]

export const careUpdatesNote =
  'If your platform needs software updates or backup checks, they’re only part of your plan when they’re written into your agreed care scope.'

export const careBenefits = [
  { title: 'Regular checks', body: 'Agreed pages, forms, and booking links get checked every month.' },
  { title: 'A monthly status update', body: 'A short note each month so you know where things stand.' },
  { title: 'Time for updates', body: 'Business and Premium Care include monthly time for small changes and troubleshooting.' },
]

/* ------------------------------------------------------------------ */
/* Occasional support (approved)                                        */
/* ------------------------------------------------------------------ */

export const HOURLY_RATE = 100

export const occasionalSupport = [
  'You can ask for help without a monthly care plan.',
  `Occasional work is ${formatUSD(HOURLY_RATE)} an hour with a one hour minimum, or a fixed quote for a defined project.`,
  'We agree on an estimate before any work begins.',
  'If you’re on a care plan, anything beyond your included time needs your approval before extra charges apply.',
  'For websites I didn’t build, I start with an initial review before agreeing to ongoing support. The review is scoped and quoted like any other work.',
]

/* ------------------------------------------------------------------ */
/* FAQs                                                                 */
/* ------------------------------------------------------------------ */

export type Faq = { q: string; a: Offer<string> }

export const projectFaqs: Faq[] = [
  {
    q: 'Can you redesign the website I already have?',
    a: approved('Yes. A redesign can fit any of the three project types, depending on what your site needs. I start by looking at what’s working and what isn’t, then we agree on the scope before anything changes.'),
  },
  {
    q: 'What does the starting price cover?',
    a: approved('Each starting price covers the baseline scope listed on its card. Your final price depends on your requirements and is confirmed in a written proposal before any work begins.'),
  },
  {
    q: 'Do I need a domain before we start?',
    a: approved('No. If you already have one, I’ll connect your new site to it. If not, I’ll help you choose and register one, ideally in your own name so you stay in control of it.'),
  },
  {
    q: 'Is hosting included?',
    a: approved('Hosting is a provider cost, separate from the project fee. Which hosting and services your site needs, and what they charge, is reviewed for your project, with accounts in your name where practical.'),
  },
  {
    q: 'Do I have to write all the words myself?',
    a: approved('A Business Website includes entering the text and images you provide, with light editing. Full copywriting is quoted separately if you’d like help writing from scratch.'),
  },
  {
    q: 'How long does a website take?',
    a: approved('It depends on the size of the project and how quickly content and feedback come together. You’ll get a timeline in your proposal before any work begins.'),
  },
  {
    q: 'Do you work with businesses like mine?',
    a: approved('Probably! I work with small businesses, service providers, consultants, creators, restaurants, salons, child care programs, and more. If you’re not sure, just ask.'),
  },
  {
    q: 'Who owns the website when it’s finished?',
    a: approved(
      'Ownership of the completed website and custom work created for your project transfers to you once final payment is received and handoff is complete. Until then, that work remains my property. Third party software, fonts, images, and services remain subject to their respective licenses and terms.'
    ),
  },
]
