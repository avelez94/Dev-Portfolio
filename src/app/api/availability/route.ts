import { NextRequest, NextResponse } from 'next/server'
import { openSlots } from '@/lib/availability'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start and end required' }, { status: 400 })
    }
    return NextResponse.json({ slots: await openSlots(startDate, endDate) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Availability error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
