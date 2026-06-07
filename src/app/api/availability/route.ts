import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start and end required' }, { status: 400 })
    }

    const [{ data: availability }, { data: blockedDates }, { data: blockedSlots }, { data: bookings }] = await Promise.all([
      supabaseAdmin.from('availability').select('*').eq('is_active', true),
      supabaseAdmin.from('blocked_dates').select('*').gte('blocked_date', startDate).lte('blocked_date', endDate),
      supabaseAdmin.from('blocked_slots').select('*').gte('blocked_date', startDate).lte('blocked_date', endDate),
      supabaseAdmin.from('bookings').select('scheduled_at').gte('scheduled_at', new Date(startDate).toISOString()).lte('scheduled_at', new Date(endDate).toISOString()).eq('status', 'scheduled'),
    ])

    const blockedDaySet = new Set((blockedDates || []).map((b: any) => b.blocked_date))
    const bookedSet = new Set((bookings || []).map((b: any) => {
      const d = new Date(b.scheduled_at)
      return `${d.toISOString().split('T')[0]}-${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    }))
    const availMap = new Map((availability || []).map((a: any) => [a.day_of_week, a]))

    const slots: string[] = []
    const now = new Date()
    const minBookingTime = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      const dayOfWeek = current.getDay()

      if (!blockedDaySet.has(dateStr) && availMap.has(dayOfWeek)) {
        const avail = availMap.get(dayOfWeek)
        const [startHour] = avail.start_time.split(':').map(Number)
        const [endHour] = avail.end_time.split(':').map(Number)

        const dayBlockedSlots = (blockedSlots || []).filter((s: any) => s.blocked_date === dateStr)

        for (let hour = startHour; hour < endHour; hour++) {
          for (const minute of [0, 30]) {
            const slotTime = new Date(`${dateStr}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00-04:00`)
            const slotKey = `${dateStr}-${hour}:${String(minute).padStart(2, '0')}`

            const isBlockedSlot = dayBlockedSlots.some((s: any) => {
              const [bStartH, bStartM] = s.start_time.split(':').map(Number)
              const [bEndH, bEndM] = s.end_time.split(':').map(Number)
              const slotMinutes = hour * 60 + minute
              const blockStart = bStartH * 60 + bStartM
              const blockEnd = bEndH * 60 + bEndM
              return slotMinutes >= blockStart && slotMinutes < blockEnd
            })

            if (slotTime >= minBookingTime && !bookedSet.has(slotKey) && !isBlockedSlot) {
              slots.push(slotTime.toISOString())
            }
          }
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return NextResponse.json({ slots })
  } catch (err) {
    console.error('Availability error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}