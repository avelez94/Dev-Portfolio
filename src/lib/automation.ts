/**
 * Booking & Payments already includes the standard confirmations and
 * reminders that the chosen booking and payment services send. Custom
 * Automations & AI Integrations is a separately scoped capability. These
 * helpers keep a Booking & Payments proposal from charging for the included
 * messages a second time. Used by the proposal builder and the proposals API.
 */

export const BOOKING_PROJECT_TYPE = 'Booking & Payments'
export const AUTOMATION_PROJECT_TYPE = 'Custom Automations & AI Integrations'

export const BOOKING_AUTOMATION_NOTE =
  'Booking & Payments already includes the standard booking confirmations and reminders your booking and payment services send. Don’t add a separate automation charge for them. Custom Automations & AI Integrations is scoped and priced separately, for work such as custom workflows between tools or AI features.'

const INCLUDED = /\b(confirmations?|reminders?|booking (?:emails?|notifications?|messages?)|appointment (?:emails?|notifications?|messages?))\b/i
const SEPARATE = /\b(custom|ai|integrations?|crm|workflows?|zapier|make\.com|webhooks?)\b/i

/** Priced lines that read as the included booking confirmations or reminders, not separately scoped automation. */
export function bookingAutomationLines<T extends { description?: string; price?: string | number }>(items: T[]): T[] {
  return items.filter((i) => Number(i.price) > 0 && INCLUDED.test(String(i.description || '')) && !SEPARATE.test(String(i.description || '')))
}
