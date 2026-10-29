/**
 * Website Care switches and environment checks. The whole feature is off unless
 * WEBSITE_CARE_ENABLED is exactly "true". With it off, every care endpoint
 * answers 404 and nothing reads or writes the care tables.
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { SITE_URL } from '@/content/site'

export function careEnabled(): boolean {
  return process.env.WEBSITE_CARE_ENABLED === 'true'
}

export function careOff(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

export function appUrl(): string {
  return (process.env.CARE_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/$/, '')
}

/** Constant time comparison for shared secrets (runner token, cron secret). */
export function secretMatches(given: string | null | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Client report emails only go to addresses allowed here until
 * CARE_CLIENT_EMAIL_LIVE is "true". Development and preview keep this on, so a
 * test can never email a real client. Patterns support a trailing * wildcard
 * in the local part, like alante.v+*@gmail.com.
 */
export function clientEmailAllowed(email: string): { ok: boolean; reason?: string } {
  if (process.env.CARE_CLIENT_EMAIL_LIVE === 'true') return { ok: true }
  const list = (process.env.CARE_EMAIL_ALLOWLIST || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const e = email.trim().toLowerCase()
  const hit = list.some((p) => {
    if (!p.includes('*')) return p === e
    const re = new RegExp('^' + p.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^@]*') + '$')
    return re.test(e)
  })
  return hit
    ? { ok: true }
    : { ok: false, reason: 'Client emails are switched off in this environment. Only addresses on the test allowlist can receive client emails.' }
}

/** Test only host map for fixture websites. Refused on production deploys. */
export function testHostMap(): Record<string, string> {
  const raw = process.env.CARE_TEST_HOSTS
  if (!raw || isProductionDeploy()) return {}
  try {
    const m = JSON.parse(raw)
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}
