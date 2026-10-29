/**
 * The hourly care tick (Vercel cron). Every step is idempotent, so a missed or
 * repeated run is harmless: it recovers stalled scans, queues scans that were
 * missed during an outage, sends start and overdue reminders within their
 * limits, and retries owner notifications.
 */
import { db, getSettings } from './db'
import { enqueueScan, dispatchRunner } from './cycles'
import { queueReminder, queueBillingNotice, retryPendingNotifications } from './notify'

export async function careTick(now = new Date()) {
  const out: Record<string, unknown> = {}
  const settings = await getSettings()

  const rec = await db.rpc('care_recover_scan_runs')
  out.recovered = rec.data?.[0] || rec.data || null

  // Queued runs that can no longer be claimed (attempts used up) are failed, not left waiting.
  const stuck = (await db.from('care_scan_runs').select('id, cycle_id, attempts, max_attempts').eq('status', 'queued')).data || []
  for (const r of stuck.filter((x: { attempts: number; max_attempts: number }) => x.attempts >= x.max_attempts)) {
    await db.from('care_scan_runs').update({ status: 'failed', error: 'No attempts left.', finished_at: now.toISOString() }).eq('id', r.id).eq('status', 'queued')
    await db.from('care_cycles').update({ scan_state: 'failed' }).eq('id', r.cycle_id)
  }

  // Missed scheduling: paid cycles on confirmed sites that never got a scan queued.
  const confirmed = (await db.from('care_sites').select('id').eq('enrollment_status', 'confirmed')).data || []
  const ids = confirmed.map((s: { id: string }) => s.id)
  let queued = 0
  if (ids.length) {
    const pending = (await db.from('care_cycles').select('id, hold_reason, scan_after').in('site_id', ids).eq('scan_state', 'not_started').is('completed_at', null).lte('scan_after', now.toISOString())).data || []
    for (const c of pending) {
      try { await enqueueScan(c.id, 'scheduled', 'scheduler'); queued++ } catch (e) { console.error('care enqueue failed', (e as Error).message) }
    }
  }
  out.queued = queued

  const ready = (await db.from('care_scan_runs').select('id', { count: 'exact', head: true }).eq('status', 'queued').lte('available_at', now.toISOString())).count || 0
  out.dispatch = ready ? await dispatchRunner() : 'none waiting'

  // Reminders. Start reminder once per cycle; overdue reminders spaced and capped.
  const open = (await db.from('care_cycles').select('*').is('completed_at', null).is('hold_reason', null).lte('review_start_at', now.toISOString())).data || []
  let reminders = 0
  for (const c of open) {
    if (settings.start_reminder && new Date(c.review_due_at) > now) {
      if (await queueReminder(c, 'start', 0)) reminders++
    }
    if (new Date(c.review_due_at) < now && c.reminders_sent < settings.overdue_reminder_max) {
      const last = c.last_reminder_at ? new Date(c.last_reminder_at).getTime() : 0
      if (now.getTime() - last >= settings.overdue_reminder_hours * 3600_000) {
        const n = c.reminders_sent + 1
        const upd = await db.from('care_cycles').update({ reminders_sent: n, last_reminder_at: now.toISOString() }).eq('id', c.id).eq('reminders_sent', c.reminders_sent).select('id')
        if (upd.data?.length && (await queueReminder(c, 'overdue', n))) reminders++
      }
    }
  }
  out.reminders = reminders

  // Grace period notice (only when a grace period has been set).
  if (settings.grace_days !== null) {
    const late = (await db.from('care_sites').select('*').in('billing_state', ['attention', 'past_due', 'unpaid']).not('billing_attention_since', 'is', null)).data || []
    for (const s of late) {
      if (now.getTime() - new Date(s.billing_attention_since).getTime() > settings.grace_days * 86400_000) {
        await queueBillingNotice(s, `grace:${s.billing_attention_since}`, 'Grace period over', `Payment has needed attention for more than ${settings.grace_days} days. No review starts until a period is paid.`)
      }
    }
  }

  out.notifications = await retryPendingNotifications()
  return out
}
