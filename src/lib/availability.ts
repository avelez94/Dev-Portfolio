import { supabaseAdmin } from '@/lib/supabase-admin'
import { nyTime } from '@/lib/time'

/** Booking rows that hold a time: confirmed calls, and a slot being claimed right now. */
export const ACTIVE_BOOKING_STATUSES = ['scheduled', 'holding']
/** A claim that never got its Zoom link (for example the function was stopped) stops blocking the time after this. */
export const STALE_HOLD_MS = 10 * 60 * 1000

/** True for rows that currently hold their time. */
export function holdsTime(b: { status: string; created_at?: string | null }): boolean {
  if (b.status === 'scheduled') return true
  if (b.status !== 'holding') return false
  return !b.created_at || Date.now() - new Date(b.created_at).getTime() < STALE_HOLD_MS
}

/** Calls can be booked this far ahead of now, at the earliest. */
export const MIN_NOTICE_MS = 48 * 60 * 60 * 1000

type DayHours = { day_of_week: number; start_time: string; end_time: string }
type Block = { blocked_date: string; start_time: string; end_time: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Open discovery call start times (ISO, UTC) between two dates, inclusive.
 * Used by the calendar and, on the server, to check that a requested time is
 * really open before it's booked.
 */
export async function openSlots(startDate: string, endDate: string): Promise<string[]> {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw new Error('Dates must be YYYY-MM-DD')
  // Bookings on the last day of the range, in Eastern Time, end before 06:00 UTC the next day.
  const rangeEnd = new Date(Date.parse(`${endDate}T23:59:59Z`) + 6 * 3600000).toISOString()

  const [{ data: availability, error: availErr }, { data: blockedDates, error: blockedErr }, { data: blockedSlots, error: slotsErr }, { data: bookings, error: bookingsErr }] = await Promise.all([
    supabaseAdmin.from('availability').select('*').eq('is_active', true),
    supabaseAdmin.from('blocked_dates').select('*').gte('blocked_date', startDate).lte('blocked_date', endDate),
    supabaseAdmin.from('blocked_slots').select('*').gte('blocked_date', startDate).lte('blocked_date', endDate),
    supabaseAdmin.from('bookings').select('scheduled_at, status, created_at').gte('scheduled_at', new Date(startDate).toISOString()).lte('scheduled_at', rangeEnd).in('status', ACTIVE_BOOKING_STATUSES),
  ])

  // A failed read must not look like "no times" (or show a booked time as open).
  const readErr = availErr || blockedErr || slotsErr || bookingsErr
  if (readErr) throw readErr

  const blockedDaySet = new Set((blockedDates || []).map((b: { blocked_date: string }) => b.blocked_date))
  // Compare exact instants. The original key used the server's local hour (UTC on
  // Vercel) against Eastern hours, so booked times were never hidden.
  const bookedSet = new Set((bookings || []).filter(holdsTime).map((b: { scheduled_at: string }) => new Date(b.scheduled_at).toISOString()))
  const availMap = new Map((availability || []).map((a: DayHours) => [a.day_of_week, a] as const))

  const slots: string[] = []
  const now = new Date()
  const minBookingTime = new Date(now.getTime() + MIN_NOTICE_MS)
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    // UTC calendar math, so the result doesn't depend on the server's time zone.
    const dayOfWeek = current.getUTCDay()

    if (!blockedDaySet.has(dateStr) && availMap.has(dayOfWeek)) {
      const avail = availMap.get(dayOfWeek)!
      const [startHour] = avail.start_time.split(':').map(Number)
      const [endHour] = avail.end_time.split(':').map(Number)

      const dayBlockedSlots = (blockedSlots || []).filter((s: Block) => s.blocked_date === dateStr)

      for (let hour = startHour; hour < endHour; hour++) {
        for (const minute of [0, 30]) {
          // Real New York offset for this date (EDT or EST), instead of a fixed -04:00.
          const slotTime = nyTime(dateStr, hour, minute)

          const isBlockedSlot = dayBlockedSlots.some((s: Block) => {
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

  return slots
}
