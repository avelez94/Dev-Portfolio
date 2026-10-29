/**
 * Time zone aware scheduling for review cycles. Everything is computed in the
 * owner's configured time zone, then stored as UTC timestamps.
 */

export type CareSettings = {
  timezone: string
  working_days: number[]
  work_start: string
  work_end: string
  review_minutes: number
  review_window_days: number
  lead_days: number
  start_reminder: boolean
  overdue_reminder_hours: number
  overdue_reminder_max: number
  notify_email: string | null
  grace_days: number | null
  billing_attention_after_failures: number
  refund_handling: string
  dispute_handling: string
  immediate_cancel_handling: string
  policy_approved_at: string | null
  policy_approved_note: string | null
  calendar_token_hash: string | null
  calendar_token_created_at: string | null
}

export function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(d)) o[p.type] = p.value
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second }
}

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(d: Date, tz: string): string {
  const p = parts(d, tz)
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** The UTC instant for a wall clock time in a time zone (handles daylight saving). */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm || 0)
  let guess = wall
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(guess), tz)
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s)
    guess = guess + (wall - asUtc)
  }
  return new Date(guess)
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/** ISO weekday, 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return w === 0 ? 7 : w
}

function workingDay(date: string, days: number[]): boolean {
  return days.length === 0 || days.includes(isoWeekday(date))
}

export type CycleDates = { scanAfter: Date; reviewStartAt: Date; reviewDueAt: Date; dueDate: string; startDate: string }

/**
 * Review dates for a paid period that began at periodStart (the subscription
 * anniversary, so clients spread out naturally).
 * - The automated check may start as soon as the period is paid.
 * - The review is due windowDays later, at the end of the working day, moved
 *   back to the nearest working day (never before the day after the scan).
 * - The start reminder is leadDays working days before the deadline.
 */
export function cycleDates(periodStart: Date, s: Pick<CareSettings, 'timezone' | 'working_days' | 'work_start' | 'work_end' | 'review_window_days' | 'lead_days'>, windowOverride?: number | null, now = new Date()): CycleDates {
  const tz = s.timezone
  const scanAfter = new Date(Math.max(periodStart.getTime(), now.getTime() - 60_000))
  const firstDay = localDate(periodStart, tz)
  const window = windowOverride || s.review_window_days
  let due = addDays(firstDay, window)
  const earliest = addDays(localDate(scanAfter, tz), 1)
  while (!workingDay(due, s.working_days) && due > earliest) due = addDays(due, -1)
  let start = due
  let steps = s.lead_days
  while (steps > 0 && start > earliest) {
    start = addDays(start, -1)
    if (workingDay(start, s.working_days)) steps--
  }
  return {
    scanAfter,
    reviewDueAt: zonedToUtc(due, s.work_end, tz),
    reviewStartAt: zonedToUtc(start, s.work_start, tz),
    dueDate: due,
    startDate: start,
  }
}

export function formatInTz(d: Date | string, tz: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(d))
}

export function formatDateOnly(d: Date | string, tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(d))
}
