import 'server-only'

/**
 * Offers awaiting approval. SERVER ONLY.
 *
 * Every price, limit, allowance, response time, priority promise, and policy
 * answer is wrapped in `proposed(...)`. Proposed values are rendered ONLY when
 * drafts are visible, and are left out of the page entirely otherwise. Hiding a
 * badge is never enough. To publish a value, change `proposed(x)` to
 * `approved(x)` after you have signed off on it.
 *
 * Drafts are visible only when one of these is true:
 *   SHOW_DRAFTS=true            (any host, set it on preview builds only)
 *   VERCEL_ENV=preview          (Vercel preview deployments)
 *   NODE_ENV=development        (npm run dev)
 * Any other build, including production on hosts other than Vercel, hides them.
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

/** True when a value is visible only because drafts are on. */
export function isDraft(o: Offer<unknown>): boolean {
  return !o.approved
}

/* ------------------------------------------------------------------ */
/* Packages                                                             */
/* ------------------------------------------------------------------ */

export type PackageSpec = { label: string; value: Offer<string> }

export type Package = {
  id: 'essentials' | 'business' | 'custom'
  interest: 'pkg-essentials' | 'pkg-business' | 'pkg-custom'
  name: string
  forWho: string
  /** 'quote' = price set per proposal. Numbers stay proposed until approved. */
  price: Offer<number | null> | 'discuss'
  specs: PackageSpec[]
  includes: string[]
}

export const packages: Package[] = [
  {
    id: 'essentials',
    interest: 'pkg-essentials',
    name: 'Website Essentials',
    forWho: 'A clear, polished home online for a new or small business.',
    price: proposed(null),
    specs: [
      { label: 'Pages', value: proposed('Up to 3 pages') },
      { label: 'Revisions', value: proposed('2 rounds') },
      { label: 'Writing your copy', value: proposed('Not included') },
      { label: 'Adding your content', value: proposed('Included for the text and photos you provide') },
    ],
    includes: ['Design that works beautifully on phones', 'Contact form or booking link', 'Page titles and descriptions for search', 'Help connecting your domain'],
  },
  {
    id: 'business',
    interest: 'pkg-business',
    name: 'Business Website',
    forWho: 'A fuller site for an established business ready to look the part.',
    price: proposed(null),
    specs: [
      { label: 'Pages', value: proposed('Up to 7 pages') },
      { label: 'Revisions', value: proposed('3 rounds') },
      { label: 'Writing your copy', value: proposed('Editing and polishing of your text') },
      { label: 'Adding your content', value: proposed('Included for the text and photos you provide') },
    ],
    includes: ['Custom design shaped around your brand', 'Booking, contact, or newsletter signup', 'Connections to tools you already use', 'A walkthrough so you know how it all works'],
  },
  {
    id: 'custom',
    interest: 'pkg-custom',
    name: 'Custom Build',
    forWho: 'Stores, payments, member areas, and anything that needs custom features.',
    price: 'discuss',
    specs: [
      { label: 'Pages', value: approved('Scoped together') },
      { label: 'Revisions', value: approved('Set in your proposal') },
      { label: 'Writing your copy', value: proposed('Available as an add on') },
    ],
    includes: ['Online stores and payment flows', 'Logins, portals, or member areas', 'Integrations with outside services', 'A written plan before any building starts'],
  },
]

/* ------------------------------------------------------------------ */
/* Care plans                                                           */
/* ------------------------------------------------------------------ */

/** Flip to true only once uptime monitoring is actually set up. */
export const UPTIME_MONITORING_CONFIGURED = false

export type CarePlan = {
  id: 'steady' | 'active'
  interest: 'care-steady' | 'care-active'
  name: string
  forWho: string
  monthlyPrice: Offer<number | null>
  /** Monthly time allowance for content updates and troubleshooting. */
  timeAllowance: Offer<string | null>
  responseTime: Offer<string | null>
  priority: Offer<string> | null
}

export const carePlans: CarePlan[] = [
  {
    id: 'steady',
    interest: 'care-steady',
    name: 'Steady Care',
    forWho: 'For sites that mostly need to keep working well.',
    monthlyPrice: proposed(null),
    timeAllowance: proposed('1 hour'),
    responseTime: proposed(null),
    priority: null,
  },
  {
    id: 'active',
    interest: 'care-active',
    name: 'Active Care',
    forWho: 'For businesses that update their site often.',
    monthlyPrice: proposed(null),
    timeAllowance: proposed('3 hours'),
    responseTime: proposed(null),
    priority: proposed('Your requests are handled before Steady Care requests'),
  },
]

/** Included in every plan. Descriptive, not quantity commitments. */
export const careIncludes = [
  'Checks of your contact forms and booking links',
  'Troubleshooting when something breaks, using your monthly care time',
  'Software updates and backups, where your platform needs them',
]

export const careExcludes = [
  'New features or new pages',
  'Redesigns',
  'Content that doesn’t exist yet, like menus or photos that still need to be created',
]

export const careBenefits = [
  { title: 'Your content stays current', body: 'Hours, prices, photos, and announcements get updated without you learning the tools.' },
  { title: 'Small issues get caught', body: 'Forms and booking links get checked, so problems are easier to catch early.' },
  { title: 'You know who to call', body: 'When something looks off, you reach the person who knows your site.' },
]

/* ------------------------------------------------------------------ */
/* FAQs                                                                 */
/* ------------------------------------------------------------------ */

export type Faq = { q: string; a: Offer<string> }

export const projectFaqs: Faq[] = [
  {
    q: 'Can you redesign the website I already have?',
    a: approved('Yes. I start by looking at what’s working, what isn’t, and what your visitors need. Sometimes that means a fresh look on your current setup, and sometimes it means rebuilding on something easier to manage. Either way, we decide together before anything changes.'),
  },
  {
    q: 'Do I need a domain before we start?',
    a: approved('No. If you already have one, I’ll connect your new site to it. If not, I’ll help you choose and register one. I recommend keeping it in your name so you always stay in control of it.'),
  },
  {
    q: 'Where will my website be hosted?',
    a: approved('It depends on what we build. I’ll recommend hosting that fits your site and explain it in plain language. Hosting, domains, and tools like booking or email services usually have their own fees, paid to those providers.'),
  },
  {
    q: 'Do I have to write all the words myself?',
    a: approved('You know your business best, so your input matters. Whether writing help is included depends on your project, and your proposal spells it out. I’ll tell you exactly what I need from you and when.'),
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
    a: proposed('APPROVAL NEEDED: ownership of the design, code, and accounts after final payment. Add your policy here.'),
  },
  {
    q: 'Is anything fixed for free after launch?',
    a: proposed('APPROVAL NEEDED: whether there’s a window after launch for fixing issues in the original scope, and how long it lasts.'),
  },
]

export const careFaqs: Faq[] = [
  {
    q: 'What happens after launch?',
    a: approved('I’ll show you around your new site so you’re comfortable with it. If you’d like ongoing help, a care plan covers small updates and regular checks. Bigger changes, like new features or a redesign, are quoted separately.'),
  },
  {
    q: 'Is a care plan required?',
    a: proposed('No. Care plans are there if you want them. Plenty of people prefer to reach out only when they need something, and that works too.'),
  },
  {
    q: 'What counts as a content update?',
    a: proposed('Small changes to things that already exist: text, photos, hours, prices, menu items, or a new announcement. Each plan includes a set amount of time for these each month.'),
  },
  {
    q: 'What if I need more time than my plan includes?',
    a: proposed('APPROVAL NEEDED: how extra time beyond the monthly allowance is quoted or billed, and whether unused time carries over.'),
  },
  {
    q: 'Can you work on a site you didn’t build?',
    a: proposed('APPROVAL NEEDED: whether care plans cover sites built by someone else, and on which platforms.'),
  },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
