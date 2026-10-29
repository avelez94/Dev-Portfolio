import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { nyTime } from '@/lib/time'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start and end required' }, { status: 400 })
    }

    // Bookings on the last day of the range, in Eastern Time, end before 06:00 UTC the next day.
    const rangeEnd = new Date(Date.parse(`${endDate}T23:59:59Z`) + 6 * 3600000).toISOString()

    const [{ data: availability, error: availErr }, { data: blockedDates, error: blockedErr }, { data: blockedSlots, error: slotsErr }, { data: bookings, error: bookingsErr }] = await Promise.all([
      supabaseAdmin.from('availability').select('*').eq('is_active', true),
      supabaseAdmin.from('blocked_dates').select('*').gte('blocked_date', startDate).lte('blocked_date', endDate),
      supabaseAdmin.from('blocked_slots').select('*').gte('blocked_date', startDate).lte('blocked_date', endDate),
      supabaseAdmin.from('bookings').select('scheduled_at').gte('scheduled_at', new Date(startDate).toISOString()).lte('scheduled_at', rangeEnd).eq('status', 'scheduled'),
    ])

    // A failed read must not look like "no times" (or show a booked time as open).
    const readErr = availErr || blockedErr || slotsErr || bookingsErr
    if (readErr) throw readErr

    const blockedDaySet = new Set((blockedDates || []).map((b: any) => b.blocked_date))
    // Compare exact instants. The original key used the server's local hour (UTC on
    // Vercel) against Eastern hours, so booked times were never hidden.
    const bookedSet = new Set((bookings || []).map((b: { scheduled_at: string }) => new Date(b.scheduled_at).toISOString()))
    const availMap = new Map((availability || []).map((a: any) => [a.day_of_week, a]))

    const slots: string[] = []
    const now = new Date()
    const minBookingTime = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      // UTC calendar math, so the result doesn't depend on the server's time zone.
      const dayOfWeek = current.getUTCDay()

      if (!blockedDaySet.has(dateStr) && availMap.has(dayOfWeek)) {
        const avail = availMap.get(dayOfWeek)
        const [startHour] = avail.start_time.split(':').map(Number)
        const [endHour] = avail.end_time.split(':').map(Number)

        const dayBlockedSlots = (blockedSlots || []).filter((s: any) => s.blocked_date === dateStr)

        for (let hour = startHour; hour < endHour; hour++) {
          for (const minute of [0, 30]) {
            // Real New York offset for this date (EDT or EST), instead of a fixed -04:00.
            const slotTime = nyTime(dateStr, hour, minute)

            const isBlockedSlot = dayBlockedSlots.some((s: any) => {
              const [bStartH, bStartM] = s.start_time.split(':').map(Number)
              const [bEndH, bEndM] = s.end_time.split(':').map(Number)
              const slotMinutes = hour * 60 + minute
              const blockStart = bStartH * 60 + bStartM
              const blockEnd = bEndH * 60 + bEndM
              return slotMinutes >= blockStart && slotMinutes < blockEnd
            })

            if (slotTime >= minBookingTime && !bookedSet.has(slotTime.toISOString()) && !isBlockedSlot) {
              slots.push(slotTime.toISOString())
            }
          }
        }
      }
      current.setUTCDate(current.getUTCDate() + 1)
    }

    return NextResponse.json({ slots })
  } catch (err) {
    console.error('Availability error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}