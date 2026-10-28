/**
 * Small in memory sliding window limiter.
 *
 * Serverless instances each keep their own memory, so this is a first line of
 * defense against bursts, not a global guarantee. The intake route pairs it
 * with a per email check against the database, which is shared.
 */

type Hits = number[]
const buckets = new Map<string, Hits>()
const MAX_KEYS = 5000

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const since = now - windowMs
  const hits = (buckets.get(key) ?? []).filter((t) => t > since)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) }
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > MAX_KEYS) {
    // Drop the oldest keys so memory stays bounded.
    for (const k of buckets.keys()) {
      buckets.delete(k)
      if (buckets.size <= MAX_KEYS * 0.8) break
    }
  }
  return { ok: true, retryAfterSec: 0 }
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
