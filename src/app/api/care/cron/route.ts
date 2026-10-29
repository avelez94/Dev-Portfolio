/**
 * Hourly Website Care tick, called by Vercel Cron with CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { careEnabled, secretMatches } from '@/lib/care/config'
import { careTick } from '@/lib/care/cron'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secretMatches(auth, process.env.CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!careEnabled()) return NextResponse.json({ skipped: 'Website Care is switched off.' })
  try {
    return NextResponse.json(await careTick())
  } catch (e) {
    console.error('care tick failed', (e as Error).message)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}
