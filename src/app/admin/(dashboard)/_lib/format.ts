/** Date, time, and money formatting shared by the admin pages. */
export const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
export const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }
export function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) }
export function fmtShort(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
export function fmtDayFull(dateStr: string) { return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }
export function countdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'Now'
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000)
  if (h > 48) return Math.floor(h / 24) + 'd'
  if (h > 0) return h + 'h ' + m + 'm'
  return m + 'm'
}
export function fmtRelative(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d + 'd ago'
}
export function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number)
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h >= 12 ? 'pm' : 'am')
}
export function fmtMoney(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
