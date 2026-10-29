/**
 * Private calendar feed (iCalendar) for the owner's review deadlines.
 * - All day items on the due date (and an optional start reminder), never a
 *   timed block, because the feed can't see the owner's calendar and must not
 *   claim time is free.
 * - Stable UIDs per cycle, with SEQUENCE bumped when a date changes, so a
 *   calendar app updates the existing item instead of adding another.
 * - No attendees or organizer, so no invitations are ever sent.
 */
import { createHash, randomBytes } from 'node:crypto'
import { db, getSettings } from './db'
import { localDate } from './schedule'

const esc = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = (s: string) => s.replace(/-/g, '')

function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--
    out.push(rest.slice(0, cut))
    rest = ' ' + rest.slice(cut)
  }
  out.push(rest)
  return out.join('\r\n')
}

export function newFeedToken() {
  const token = randomBytes(24).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(t: string) {
  return createHash('sha256').update(t).digest('hex')
}

export async function buildFeed(): Promise<string> {
  const settings = await getSettings()
  const tz = settings.timezone
  const since = new Date(Date.now() - 120 * 86400_000).toISOString()
  const cycles = (await db.from('care_cycles').select('*').gte('review_due_at', since).order('review_due_at')).data || []
  const siteIds = [...new Set(cycles.map((c: { site_id: string }) => c.site_id))]
  const sites = siteIds.length ? (await db.from('care_sites').select('id, label, client_id').in('id', siteIds)).data || [] : []
  const clientIds = [...new Set(sites.map((s: { client_id: string }) => s.client_id))]
  const clients = clientIds.length ? (await db.from('clients').select('id, name, business').in('id', clientIds)).data || [] : []
  const reports = cycles.length ? (await db.from('care_reports').select('cycle_id, status').in('cycle_id', cycles.map((c: { id: string }) => c.id))).data || [] : []
  const base = (process.env.CARE_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com').replace(/\/$/, '')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alante Velez//Website Care//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Website Care reviews', `X-WR-TIMEZONE:${tz}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ]
  for (const c of cycles) {
    const site = sites.find((s: { id: string }) => s.id === c.site_id)
    const client = clients.find((x: { id: string }) => x.id === site?.client_id)
    const name = client?.business || client?.name || site?.label || 'Website'
    const status = reports.find((r: { cycle_id: string }) => r.cycle_id === c.id)?.status || 'draft'
    const done = !!c.completed_at
    const flagged = c.billing_flag ? ` (billing: ${c.billing_flag})` : ''
    const link = `${base}/admin/care?cycle=${c.id}`
    const desc = `${site?.label || ''}\nReport: ${status}${flagged}\n${link}`
    const due = localDate(new Date(c.review_due_at), tz)
    const items: { uid: string; date: string; summary: string; alarm: boolean }[] = [
      { uid: `care-${c.id}-due@alantevelez.com`, date: due, summary: `${done ? 'Done: ' : ''}Website Care review due: ${name}`, alarm: !done },
    ]
    if (settings.start_reminder && c.review_start_at && !done) {
      const start = localDate(new Date(c.review_start_at), tz)
      if (start !== due) items.push({ uid: `care-${c.id}-start@alantevelez.com`, date: start, summary: `Start Website Care review: ${name}`, alarm: true })
    }
    for (const it of items) {
      lines.push('BEGIN:VEVENT', `UID:${it.uid}`, `DTSTAMP:${stamp(new Date(c.updated_at))}`, `LAST-MODIFIED:${stamp(new Date(c.updated_at))}`,
        `SEQUENCE:${c.calendar_sequence}`, `DTSTART;VALUE=DATE:${day(it.date)}`, `DTEND;VALUE=DATE:${day(addOne(it.date))}`,
        fold(`SUMMARY:${esc(it.summary)}`), fold(`DESCRIPTION:${esc(desc)}`), fold(`URL:${link}`), 'TRANSP:TRANSPARENT', 'CLASS:PRIVATE',
        'STATUS:CONFIRMED')
      if (it.alarm) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(it.summary)}`), 'TRIGGER;RELATED=START:PT9H', 'END:VALARM')
      lines.push('END:VEVENT')
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

function addOne(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}
