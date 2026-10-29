/**
 * Website Care agreement wording for the flexible plan time method
 * (approved policy, November 2026). The version is stored on each enrolled
 * website once its agreement is confirmed, so clients enrolled under earlier
 * wording are flagged for review before this method applies to them.
 * Earlier issued agreements are kept as they were.
 * Copy rule: no dashes in client facing text.
 */
import { STANDARD_HOURLY_RATE } from '@/lib/terms'
import { BRAND } from '@/lib/brand'

/** The plan time method (flexible time, standard minutes). The work ledger checks this. */
export const CARE_TERMS_VERSION = 'care-flex-2026-11'

/**
 * The complete care agreement a client signs: the plan time terms above plus
 * billing, cancellation and refunds (approved Oct 29, 2026). A client who
 * hasn't signed this version is flagged; existing agreements are never
 * replaced silently. Change it whenever signed wording changes.
 */
export const CARE_AGREEMENT_VERSION = 'care-agreement-2026-11'
export const CARE_TERMS_EFFECTIVE = 'November 1, 2026'
export const CARE_TERMS_PATH = '/care/terms'

export const CARE_FLEXIBLE_TIME =
  'Your included time is flexible. Use it toward updates, fixes, new pages, or new features. For larger requests, I’ll explain how your available time applies and quote any additional work before we begin.'

export const CARE_STANDARD_MINUTES =
  'Work is counted in standard minutes from an agreed schedule of common tasks, and each task includes a set allowance for testing. It isn’t timed with a stopwatch, so you know in advance how much plan time a request uses.'

/** The approved additional work rate. Standard minutes measure plan time only; they never set this price. */
export const CARE_ADDITIONAL_PRICING =
  `Additional work is $${STANDARD_HOURLY_RATE} an hour with a one hour minimum, or a fixed quote we agree on. Standard minutes measure your included plan time; they don’t set the price of additional work.`

export type CareTermsSection = { title: string; body: string[] }

/** The care agreement terms, in order. Shown on the Website Care page and in the pricing guide. */
export const CARE_TERMS: CareTermsSection[] = [
  {
    title: 'What every plan includes',
    body: [
      'Monthly checks of the pages, forms, and booking links we agree on, and a monthly health report reviewed by me.',
      'Essential Care includes checks and reports. Any work on the site is quoted separately and starts only after you approve.',
    ],
  },
  {
    title: 'Included plan time',
    body: [
      'Business Care includes 30 minutes and Premium Care includes 90 minutes in each billing period.',
      CARE_FLEXIBLE_TIME,
      'Unused time doesn’t roll over to the next billing period.',
    ],
  },
  {
    title: 'How time is counted',
    body: [
      CARE_STANDARD_MINUTES,
      'Work that isn’t on the schedule gets an agreed standard allowance before it starts. Monthly checks, preparing your report, and fixing defects covered by your launch guarantee don’t use plan time.',
    ],
  },
  {
    title: 'Larger requests',
    body: [
      'Larger work gets an agreed scope and schedule first. I’ll show the standard minutes it needs, how much of your available time applies, and the price of any additional work.',
      CARE_ADDITIONAL_PRICING,
      'Approving an estimate holds your included minutes for that work in the current billing period only. Any additional cost needs your approval before that additional work starts, and a change in scope needs a revised estimate. Nothing is charged automatically.',
    ],
  },
  {
    title: 'What’s always separate',
    body: [
      'Hosting, domains, subscriptions, licenses, and other provider costs are paid separately.',
      'There’s no round the clock emergency service or guaranteed fix deadline. Care plans are optional.',
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Billing, cancellation and refunds (approved Oct 29, 2026)            */
/* ------------------------------------------------------------------ */

/** Required client facing line about the automatic check. Never promise instant completion. */
export const CARE_QUEUED_LINE = 'Your monthly website check is automatically queued when payment is confirmed.'

export const careBillingFaq = {
  q: 'Can I cancel my care plan or get a refund?',
  a: 'Care plans are billed monthly in advance. Once payment is confirmed, your monthly website check is automatically queued and that period’s payment is non-refundable, except where required by law. You can cancel before your next billing date to stop future renewals. Your current plan remains available until the end of the period you’ve paid for, and unused time doesn’t roll over. If you notice a duplicate or incorrect charge, contact me so I can investigate and correct it.',
}

/** How a client cancels. */
export const CARE_CANCEL_ROUTE = `To cancel, email me at ${BRAND.email} (or reply to any of my care emails) before your next billing date. I’ll stop future renewals and confirm in writing.`

/** Shown with the payment step (agreement page, Stripe Checkout submit text). Stripe allows up to 1,200 characters. */
export const CARE_CHECKOUT_DISCLOSURE =
  'Your plan is billed monthly in advance and renews each month on the same date until you cancel. ' +
  `${CARE_QUEUED_LINE} ` +
  'Payments are non-refundable once confirmed, except where required by law. ' +
  'Cancel before your next billing date to stop future renewals; your plan stays available until the end of the period you’ve paid for, with no prorated refund. ' +
  'If you see a duplicate or incorrect charge, contact me and I’ll investigate and correct it.'

/** The billing sections of the agreement, after the plan time sections. */
export const CARE_BILLING_TERMS: CareTermsSection[] = [
  {
    title: 'Before your plan starts',
    body: [
      'We agree on the website address, the pages and services that get checked, and the manual checklist, and you confirm that you’re authorized to have the website checked. That scope is listed in this agreement.',
      'You sign this agreement first. Payment unlocks once it’s signed, and you get a signed PDF copy by email.',
      'If the agreed scope changes later, I confirm it with you before checking the new scope. If a renewal is paid while the scope is waiting to be confirmed or care is paused, I keep that month’s paid review and hold the check until we’ve sorted it out.',
    ],
  },
  {
    title: 'Billing and your monthly check',
    body: [
      'Care plans are billed monthly in advance through Stripe. Your plan renews on the same date each month until you cancel.',
      `Successful payment starts the paid service period and automatically starts that period’s review. ${CARE_QUEUED_LINE} Checks run in the order they’re queued, and I review the results before your report is sent, so the report isn’t instant.`,
      'If a payment fails, Stripe may retry it. A monthly check starts only for a period that has been paid.',
    ],
  },
  {
    title: 'Refunds',
    body: ['Payments are non-refundable after successful payment, except where required by law.'],
  },
  {
    title: 'Cancelling',
    body: [
      'You can cancel future renewals at any time before your next billing date.',
      CARE_CANCEL_ROUTE,
      'Cancellation takes effect at the end of the period you’ve paid for, and your plan stays available until then. Cancelling doesn’t create a prorated refund for the rest of that period.',
    ],
  },
  {
    title: 'Duplicate or incorrect charges',
    body: [
      'If you notice a duplicate or incorrect charge, contact me so I can investigate and correct it. The refund terms above never stop me from correcting a billing error.',
      'If something prevents me from providing a month you’ve paid for, I’ll review it and contact you about it.',
    ],
  },
  {
    title: 'What the checks cover',
    body: [
      'Automated checks are read only. A page opening doesn’t prove that booking, payment or form delivery works unless that item is on the manual checklist and I check it by hand.',
      'The monthly report isn’t a security, accessibility or compliance certification.',
    ],
  },
  {
    title: 'Changes to these terms',
    body: [
      `This is version ${CARE_AGREEMENT_VERSION} of the Website Care agreement, effective ${CARE_TERMS_EFFECTIVE}.`,
      'If I update the terms, your plan stays on the version you signed until you sign the new one.',
    ],
  },
]

/** The complete agreement: plan time terms, then billing terms. The terms page and the signed agreement read this. */
export const CARE_AGREEMENT_TERMS: CareTermsSection[] = [...CARE_TERMS, ...CARE_BILLING_TERMS]
