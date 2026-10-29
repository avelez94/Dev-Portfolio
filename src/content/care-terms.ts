/**
 * Website Care agreement wording for the flexible plan time method
 * (approved policy, November 2026). The version is stored on each enrolled
 * website once its agreement is confirmed, so clients enrolled under earlier
 * wording are flagged for review before this method applies to them.
 * Earlier issued agreements are kept as they were.
 * Copy rule: no dashes in client facing text.
 */
import { STANDARD_HOURLY_RATE } from '@/lib/terms'

export const CARE_TERMS_VERSION = 'care-flex-2026-11'

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
