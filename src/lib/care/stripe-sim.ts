/**
 * The preview demo's stand in for Stripe. The demo installs it (see
 * src/lib/demo/stripe-sim.ts) and it answers only inside a demo request, so
 * the real checkout, invitation, and webhook code runs unchanged against
 * simulated Stripe objects. Everywhere else this returns null and nothing
 * changes.
 */
import type Stripe from 'stripe'

export type StripeSim = { stripe: Stripe; priceId: (plan: string) => string }

const g = globalThis as typeof globalThis & { __careStripeSim?: () => StripeSim | null }

export const stripeSim = (): StripeSim | null => g.__careStripeSim?.() ?? null

export function installStripeSim(get: () => StripeSim | null) {
  g.__careStripeSim = get
}
