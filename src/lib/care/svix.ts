/** Svix signature check used by Resend webhooks. */
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifySvix(body: string, id: string | null, ts: string | null, sig: string | null, secret: string, now = Date.now()): boolean {
  if (!id || !ts || !sig || !/^\d+$/.test(ts)) return false
  if (Math.abs(now / 1000 - Number(ts)) > 300) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest()
  return sig.split(' ').some((part) => {
    const [v, s] = part.split(',')
    if (v !== 'v1' || !s) return false
    const got = Buffer.from(s, 'base64')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

