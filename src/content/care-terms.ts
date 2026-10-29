/**
 * Website Care billing, cancellation and refund wording, approved by Alante on
 * October 29, 2026. One source for the public FAQ, the care terms page, the
 * checkout invitation, Stripe Checkout text, the owner's guide and the pricing
 * guide, so the wording never drifts.
 *
 * Changing anything a client agrees to means a NEW terms version: bump
 * CARE_TERMS_VERSION. Existing subscribers keep the version they accepted until
 * they accept the new one (the admin flags who still needs to).
 *
 * Not approved yet (deliberately absent here): a grace period for failed
 * payments and dispute handling.
 *
 * Copy rule: no dashes in client facing text.
 */
import { BRAND } from '@/lib/brand'

export const CARE_TERMS_VERSION = '2026-10-29'
export const CARE_TERMS_EFFECTIVE = 'October 29, 2026'
export const CARE_TERMS_PATH = '/care/terms'

/** Required client facing line about automatic checks. Never promise instant completion. */
export const CARE_QUEUED_LINE = 'Your monthly website check is automatically queued when payment is confirmed.'

export const careBillingFaq = {
  q: 'Can I cancel my care plan or get a refund?',
  a: 'Care plans are billed monthly in advance. Once payment is confirmed, your monthly website check is automatically queued and that period’s payment is non-refundable, except where required by law. You can cancel before your next billing date to stop future renewals. Your current plan remains available until the end of the period you’ve paid for, and unused time doesn’t roll over. If you notice a duplicate or incorrect charge, contact me so I can investigate and correct it.',
}

/** How a client cancels. Email always works; a Stripe billing link is added when one is configured. */
export const CARE_CANCEL_ROUTE = `To cancel, email me at ${BRAND.email} (or reply to any of my care emails) before your next billing date. I’ll stop future renewals and confirm in writing.`

/** Shown before checkout (invitation email, Stripe Checkout submit text). Stripe allows up to 1,200 characters. */
export const CARE_CHECKOUT_DISCLOSURE =
  'Your plan is billed monthly in advance and renews each month on the same date until you cancel. ' +
  `${CARE_QUEUED_LINE} ` +
  'Payments are non-refundable once confirmed, except where required by law. ' +
  'Cancel before your next billing date to stop future renewals; your plan stays available until the end of the period you’ve paid for, with no prorated refund. ' +
  'If you see a duplicate or incorrect charge, contact me and I’ll investigate and correct it.'

/** The acknowledgment next to Stripe's required terms checkbox (Markdown link supported by Stripe). */
export function careTermsAcceptanceText(baseUrl: string) {
  return `I agree to the [Website Care terms](${baseUrl}${CARE_TERMS_PATH}) (version ${CARE_TERMS_VERSION}), including monthly billing in advance and the cancellation and refund terms.`
}

export type TermsSection = { id: string; heading: string; body: string[] }

export const careTermsSections: TermsSection[] = [
  {
    id: 'service',
    heading: 'The service',
    body: [
      'Website Care is an optional monthly plan for one website we’ve agreed on. Each paid month includes automated checks of the agreed pages and links, my review of the agreed manual checklist, and a monthly health report that I review before it’s sent.',
      'Business and Premium Care also include a set amount of time each month for content updates or troubleshooting. Anything beyond that is estimated first, and nothing extra starts until you approve it.',
    ],
  },
  {
    id: 'setup',
    heading: 'Before your plan starts',
    body: [
      'Before I send a checkout link, we agree on the website address, the pages and services that get checked, and the manual checklist, and you confirm that you’re authorized to have the website checked.',
      'If the agreed setup changes later, I confirm it with you before checking the new scope. If a renewal is paid while the setup is waiting to be confirmed or care is paused, I keep that month’s paid review and hold the check until we’ve sorted it out.',
    ],
  },
  {
    id: 'billing',
    heading: 'Billing and your monthly check',
    body: [
      'Care plans are billed monthly in advance through Stripe. Your plan renews on the same date each month until you cancel.',
      `Successful payment starts the paid service period and automatically starts that period’s review. ${CARE_QUEUED_LINE} Checks run in the order they’re queued, and I review the results before your report is sent, so the report isn’t instant.`,
      'If a payment fails, Stripe may retry it. A monthly check starts only for a period that has been paid.',
    ],
  },
  {
    id: 'refunds',
    heading: 'Refunds',
    body: [
      'Payments are non-refundable after successful payment, except where required by law.',
      'Included time renews each month and unused time doesn’t roll over.',
    ],
  },
  {
    id: 'cancel',
    heading: 'Cancelling',
    body: [
      'You can cancel future renewals at any time before your next billing date.',
      CARE_CANCEL_ROUTE,
      'Cancellation takes effect at the end of the period you’ve paid for, and your plan stays available until then. Cancelling doesn’t create a prorated refund for the rest of that period.',
    ],
  },
  {
    id: 'billing-errors',
    heading: 'Duplicate or incorrect charges',
    body: [
      'If you notice a duplicate or incorrect charge, contact me so I can investigate and correct it. The refund terms above never stop me from correcting a billing error.',
      'If something prevents me from providing a month you’ve paid for, I’ll review it and contact you about it.',
    ],
  },
  {
    id: 'reports',
    heading: 'What the checks cover',
    body: [
      'Automated checks are read only. A page opening doesn’t prove that booking, payment or form delivery works unless that item is on the manual checklist and I check it by hand.',
      'The monthly report isn’t a security, accessibility or compliance certification.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    body: [
      `These are version ${CARE_TERMS_VERSION} of the Website Care terms, effective ${CARE_TERMS_EFFECTIVE}. You accept them when you start your plan.`,
      'If I update the terms, your plan stays on the version you accepted until you agree to the new one.',
    ],
  },
]
