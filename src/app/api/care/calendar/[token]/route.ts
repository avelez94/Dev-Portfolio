/**
 * Private iCalendar feed of Website Care review dates, for the owner only. The
 * secret link is created in admin settings; only its hash is stored, and
 * creating a new link turns off the old one.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { careEnabled, careOff } from '@/lib/care/config'
import { getSettings } from '@/lib/care/db'
import { buildFeed, hashToken } from '@/lib/care/ics'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (!careEnabled()) return careOff()
  const { token } = await ctx.params
  const clean = String(token || '').replace(/\.ics$/, '')
  const s = await getSettings()
  if (!s.calendar_token_hash || !/^[\w-]{20,64}$/.test(clean)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const a = Buffer.from(hashToken(clean))
  const b = Buffer.from(s.calendar_token_hash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(await buildFeed(), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  })
}
