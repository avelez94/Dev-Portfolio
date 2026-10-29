/**
 * Owner notifications. Each one has a dedupe key, so a retried scan or a
 * repeated cron run can't send the same notice twice, and failed sends are
 * retried a limited number of times. A failed email never changes the review.
 */
import { Resend } from 'resend'
import { BRAND } from '@/lib/brand'
import { db, getSettings, logActivity, type Row } from './db'
import { appUrl } from './config'
import { formatInTz } from './schedule'
import * as mail from './emails'
import { groupFindings } from './report-model'

let resend: Resend | null = null
const client = () => (resend ??= new Resend(process.env.RESEND_API_KEY))

export async function ownerEmail(): Promise<string> {
  const s = await getSettings()
  return s.notify_email || process.env.CARE_NOTIFY_EMAIL || BRAND.email
}

export function reviewLink(cycleId: string) {
  return `${appUrl()}/admin/care?cycle=${cycleId}`
}

async function queue(n: { dedupe_key: string; kind: string; cycle_id?: string | null; run_id?: string | null; subject: string; payload: Record<string, unknown> }) {
  const to_email = await ownerEmail()
  const ins = await db.from('care_notifications').insert({ ...n, to_email }).select('*').single()
  if (ins.error) {
    if (ins.error.code === '23505') return null // already queued or sent
    console.error('care notification queue failed', ins.error.message)
    return null
  }
  await deliver(ins.data)
  return ins.data
}

export async function queueScanNotification(runId: string) {
  const run = (await db.from('care_scan_runs').select('*').eq('id', runId).single()).data
  if (!run) return
  const cycle = (await db.from('care_cycles').select('*').eq('id', run.cycle_id).single()).data
  const site = (await db.from('care_sites').select('*').eq('id', run.site_id).single()).data
  if (!cycle || !site) return
  const client = (await db.from('clients').select('name, business').eq('id', site.client_id).maybeSingle()).data
  const settings = await getSettings()
  const findings = (await db.from('care_findings').select('check_key, issue_code, url, viewport, status, observed, evidence').eq('run_id', runId)).data || []
  const manual = (await db.from('care_manual_results').select('label, status').eq('cycle_id', cycle.id)).data || []
  const name = client?.business || client?.name || site.label
  // Grouped like the report: one line per issue type with its pages, not one per page and device.
  const groups = groupFindings(findings, run.config?.pages || [], run.config?.destinations || [])
  const fmt = (g: { title: string; pages: string[]; count: number }) => `${g.title}: ${g.pages.slice(0, 4).join(', ')}${g.pages.length > 4 ? ` and ${g.pages.length - 4} more` : ''}`.slice(0, 240)
  const payload = {
    client: name, site: site.label, siteUrl: site.site_url, due: formatInTz(cycle.review_due_at, settings.timezone),
    counts: run.summary?.counts || {}, outcome: run.status, error: run.error, attempts: run.attempts,
    attention: groups.filter((g) => g.severity === 'issue').map(fmt),
    couldNot: groups.filter((g) => g.severity === 'unverified').map(fmt),
    manualOpen: manual.filter((m: { status: string | null }) => !m.status || m.status === 'needs_review').map((m: { label: string }) => m.label),
    link: reviewLink(cycle.id),
  }
  const ok = run.status === 'succeeded'
  await queue({ dedupe_key: `scan:${runId}`, kind: ok ? 'scan_done' : 'scan_problem', cycle_id: cycle.id, run_id: runId, subject: ok ? 'scan done' : 'scan problem', payload })
}

export async function queueReminder(cycle: Row, kind: 'start' | 'overdue', n: number) {
  const site = (await db.from('care_sites').select('*').eq('id', cycle.site_id).single()).data
  if (!site) return null
  const client = (await db.from('clients').select('name, business').eq('id', site.client_id).maybeSingle()).data
  const settings = await getSettings()
  const report = (await db.from('care_reports').select('status').eq('cycle_id', cycle.id).maybeSingle()).data
  const manual = (await db.from('care_manual_results').select('label, status').eq('cycle_id', cycle.id)).data || []
  return queue({
    dedupe_key: `${kind}:${cycle.id}:${n}`, kind: kind === 'start' ? 'review_start' : 'review_overdue', cycle_id: cycle.id, subject: kind,
    payload: {
      client: client?.business || client?.name || site.label, site: site.label, due: formatInTz(cycle.review_due_at, settings.timezone), link: reviewLink(cycle.id),
      overdue: kind === 'overdue', reportStatus: report?.status || 'draft',
      manualOpen: manual.filter((m: { status: string | null }) => !m.status || m.status === 'needs_review').map((m: { label: string }) => m.label),
    },
  })
}

export async function queueBillingNotice(site: Row, key: string, state: string, detail: string) {
  const client = (await db.from('clients').select('name, business').eq('id', site.client_id).maybeSingle()).data
  return queue({
    dedupe_key: `billing:${site.id}:${key}`, kind: 'billing_attention', subject: 'billing',
    payload: { client: client?.business || client?.name || site.label, site: site.label, state, detail, link: `${appUrl()}/admin/care?site=${site.id}` },
  })
}

function render(n: { kind: string; payload: Row }) {
  // Payloads are written by this module (queueScanNotification, queueReminder, queueBillingNotice).
  const p = n.payload as never
  switch (n.kind) {
    case 'scan_done': return mail.scanDone(p)
    case 'scan_problem': return mail.scanProblem(p)
    case 'review_start':
    case 'review_overdue': return mail.reviewReminder(p)
    case 'billing_attention': return mail.billingAttention(p)
    default: throw new Error(`Unknown notification ${n.kind}`)
  }
}

export async function deliver(n: Row) {
  const now = new Date()
  try {
    const m = render(n as { kind: string; payload: Row })
    const { data, error } = await client().emails.send({ from: BRAND.adminFrom, to: n.to_email, subject: m.subject, html: m.html, text: m.text })
    if (error) throw new Error(error.message || 'Email provider refused the message')
    await db.from('care_notifications').update({ status: 'sent', attempts: n.attempts + 1, sent_at: now.toISOString(), provider_message_id: data?.id || null, subject: m.subject, error: null }).eq('id', n.id)
    return true
  } catch (e) {
    const attempts = n.attempts + 1
    const exhausted = attempts >= n.max_attempts
    await db.from('care_notifications').update({
      status: exhausted ? 'failed' : 'pending', attempts, error: String((e as Error).message || e).slice(0, 300),
      next_attempt_at: new Date(now.getTime() + 15 * 60_000 * 2 ** (attempts - 1)).toISOString(),
    }).eq('id', n.id)
    if (exhausted) await logActivity({ cycle_id: n.cycle_id, actor: 'system', action: 'notification_failed', detail: { kind: n.kind, error: String((e as Error).message).slice(0, 200) } })
    return false
  }
}

export async function retryPendingNotifications(limit = 20) {
  const due = (await db.from('care_notifications').select('*').eq('status', 'pending').lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at').limit(limit)).data || []
  let sent = 0
  for (const n of due) if (await deliver(n)) sent++
  return { tried: due.length, sent }
}
