/**
 * The three approved care plans, tied to the published offers so prices and
 * names stay in one place. Stripe Price IDs come from the environment and are
 * the only prices checkout will ever use.
 */
import { carePlans } from '@/content/offers'
import { stripeSim } from './stripe-sim'

export type PlanId = 'essential' | 'business' | 'premium'
export const PLAN_IDS: PlanId[] = ['essential', 'business', 'premium']

export function plan(id: PlanId) {
  const p = carePlans.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown plan ${id}`)
  return {
    id: p.id as PlanId,
    name: p.name,
    monthly: p.monthly,
    /** Included update or troubleshooting minutes. Checks and the report never use this time. */
    includedMinutes: p.minutes ?? 0,
  }
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && (PLAN_IDS as string[]).includes(v)
}

const PRICE_ENV: Record<PlanId, string> = {
  essential: 'STRIPE_PRICE_CARE_ESSENTIAL',
  business: 'STRIPE_PRICE_CARE_BUSINESS',
  premium: 'STRIPE_PRICE_CARE_PREMIUM',
}

export function priceIdFor(id: PlanId): string | null {
  const sim = stripeSim()
  if (sim) return sim.priceId(id)
  return process.env[PRICE_ENV[id]] || null
}

/** Maps an approved Stripe Price ID back to its plan. Unknown prices return null. */
export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null
  for (const id of PLAN_IDS) if (priceIdFor(id) === priceId) return id
  return null
}
