import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

/**
 * Admin only API routes (sending documents, invoices, emails, meetings) must
 * come from a signed in admin. The admin pages are already protected by the
 * proxy; this closes the same gap for the API routes they call.
 * Returns a 401 response to send back, or null when the request is allowed.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_SECRET_TOKEN
  const token = req.cookies.get('admin_token')?.value
  if (!expected || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}
