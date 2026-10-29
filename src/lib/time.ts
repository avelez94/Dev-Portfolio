/**
 * Discovery call availability is defined in Eastern Time. The original code
 * used a fixed -04:00 offset, which is an hour off from early November to
 * mid March. These helpers use the real America/New_York offset for each date.
 */
export const BUSINESS_TZ = 'America/New_York'

/** Offset like "-04:00" or "-05:00" for a calendar date (YYYY-MM-DD) in New York. */
export function nyOffset(dateStr: string): string {
  // Noon UTC is always the same calendar date in New York, and well away from the 2am switch.
  const probe = new Date(`${dateStr}T12:00:00Z`)
  const part = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, timeZoneName: 'shortOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value // e.g. "GMT-4"
  const m = part?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return '-05:00'
  return `${m[1]}${m[2].padStart(2, '0')}:${m[3] ?? '00'}`
}

/** A wall clock time in New York on a given date, as a Date. */
export function nyTime(dateStr: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return new Date(`${dateStr}T${hh}:${mm}:00${nyOffset(dateStr)}`)
}

export function formatCallDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: BUSINESS_TZ })
}

export function formatCallTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ, timeZoneName: 'short' })
}
