/**
 * The Website Care introduction, offered when you mark a project complete in
 * Pipeline. You see the recipient and the email before confirming; it is
 * sent at most once per project (the database enforces it, so reopening and
 * completing again never sends a second one) and recorded under the client.
 *
 * It's skipped when the client already has active Care. It only introduces
 * the plans: after the client chooses one, you confirm the scope and send the
 * personalized online agreement (agreement.ts), and signature, payment and
 * the first scan follow as before. Client emails follow the same allowlist as
 * every care email (config.ts), so nothing reaches a real client until client
 * emails are switched on for them.
 */
import { Resend } from 'resend'
import { db, must, CareError, logActivity, type Row } from './db'
import { clientEmailAllowed } from './config'
import { careIntroduction, type IntroPlan } from './emails'
import { isMissingColumn } from './cycles'
import { carePlans } from '@/content/offers'
import { BRAND } from '@/lib/brand'
import { SITE_URL } from '@/content/site'

export const INTRO_MIGRATION = 'supabase/pending/website-care/20261109_care_introductions.sql'
const missingTable = (e: { code?: string; message?: string } | null | undefined) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .*care_introductions.* does not exist|Could not find the table/i.test(e.message ?? '') || isMissingColumn(e))

export function introPlans(): IntroPlan[] {
  return carePlans.map((p) => ({
    name: p.name, price: `$${p.monthly}`, forWho: p.forWho,
    time: p.minutes ? `Includes ${p.minutes} minutes a month for updates or troubleshooting` : 'Checks and a monthly report; updates quoted separately',
  }))
}

/** A client has active Care when one of their websites is enrolled and paid up: an active Stripe subscription, or a paid period that hasn't ended. */
export async function activeCare(clientId: string): Promise<{ active: boolean; site?: string }> {
  const sites = ((await db.from('care_sites').select('id, label, enrollment_status, stripe_subscription_id, subscription_status, paid_through').eq('client_id', clientId)).data || []) as Row[]
  const now = Date.now()
  for (const s of sites.filter((x) => x.enrollment_status !== 'ended')) {
    if (s.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(s.subscription_status || '')) return { active: true, site: s.label }
    if (s.paid_through && new Date(s.paid_through).getTime() > now) return { active: true, site: s.label }
    const open = (await db.from('care_cycles').select('id').eq('site_id', s.id).gt('period_end', new Date().toISOString()).limit(1)).data || []
    if (open.length) return { active: true, site: s.label }
  }
  return { active: false }
}

async function context(clientId: string, projectId?: string | null) {
  const client = must(await db.from('clients').select('id, name, email, business').eq('id', clientId).maybeSingle(), 'Client')
  if (!client) throw new CareError('That client record does not exist.', 404)
  // The project being completed: the one named, otherwise the client's most recent active one.
  let project: Row | null = null
  if (projectId) project = (await db.from('projects').select('id, name, client_id, status').eq('id', projectId).maybeSingle()).data
  else project = (await db.from('projects').select('id, name, client_id, status').eq('client_id', clientId).neq('status', 'lost').order('created_at', { ascending: false }).limit(1).maybeSingle()).data
  if (project && project.client_id !== clientId) throw new CareError('That project belongs to another client.', 422)
  const key = project ? `project:${project.id}` : `client:${clientId}`
  return { client, project, key }
}

/** What the completion dialog shows: recipient, whether it can or will be sent, and the email itself. Sends nothing. */
export async function introductionPreview(clientId: string, projectId?: string | null) {
  const { client, project, key } = await context(clientId, projectId)
  const recipient = { name: client.name || '', email: String(client.email || '').trim() }
  const prev = await db.from('care_introductions').select('id, status, recipient_email, finished_at, created_at').eq('dedupe_key', key).maybeSingle()
  const migration = missingTable(prev.error) ? INTRO_MIGRATION : null
  const sent = prev.data && prev.data.status !== 'failed' ? { at: prev.data.finished_at || prev.data.created_at, to: prev.data.recipient_email, status: prev.data.status } : null
  const care = await activeCare(clientId)
  const allowed = recipient.email ? clientEmailAllowed(recipient.email) : { ok: false, reason: 'This client has no email address.' }
  const m = careIntroduction({ name: recipient.name, business: client.business || '', projectName: project?.name || client.business || '', plans: introPlans(), careUrl: `${SITE_URL}/care` })
  let skip: string | null = null
  if (migration) skip = `The database needs ${migration} before introductions can be sent.`
  else if (sent) skip = `Already sent for this project on ${new Date(sent.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${sent.to}. It’s sent once per project.`
  else if (care.active) skip = `${client.business || client.name} already has active Website Care (${care.site}).`
  else if (!recipient.email) skip = 'This client has no email address.'
  else if (!allowed.ok) skip = allowed.reason || 'Client emails are switched off for this address.'
  return { recipient, project: project ? { id: project.id, name: project.name } : null, can_send: !skip, skip, sent, active_care: care.active, email: m }
}

let mailer: Resend | null = null

/**
 * Sends the introduction once for the project. The record is claimed before
 * sending, so two clicks or a reopened project can't send twice; a failed
 * send can be retried.
 */
export async function sendIntroduction(clientId: string, projectId: string | null | undefined, actor: string) {
  const pre = await introductionPreview(clientId, projectId)
  if (!pre.can_send) throw new CareError(pre.skip || 'The introduction can’t be sent.', 409)
  const { client, project, key } = await context(clientId, projectId)
  const row = { client_id: clientId, project_id: project?.id || null, dedupe_key: key, recipient_name: pre.recipient.name, recipient_email: pre.recipient.email, subject: pre.email.subject, status: 'sending', sent_by: actor }
  let claim = await db.from('care_introductions').insert(row).select('*').single()
  if (claim.error?.code === '23505') {
    // Only a failed earlier attempt may be retried.
    const retry = await db.from('care_introductions').update({ ...row, error: null, finished_at: null, created_at: new Date().toISOString() }).eq('dedupe_key', key).eq('status', 'failed').select('*')
    if (!retry.data?.length) throw new CareError('The introduction was already sent for this project. It’s sent once per project.', 409)
    claim = { ...claim, data: retry.data[0], error: null } as typeof claim
  }
  if (claim.error) throw new CareError(missingTable(claim.error) ? `The database needs ${INTRO_MIGRATION} before introductions can be sent.` : claim.error.message, missingTable(claim.error) ? 503 : 500)
  const rec = claim.data
  mailer ??= new Resend(process.env.RESEND_API_KEY)
  try {
    const { data, error } = await mailer.emails.send(
      { from: BRAND.from, to: pre.recipient.email, replyTo: BRAND.email, subject: pre.email.subject, html: pre.email.html, text: pre.email.text },
      { idempotencyKey: `care-intro-${rec.id}-${Date.parse(rec.created_at)}` },
    )
    if (error) throw new Error(error.message || 'The email provider refused it.')
    await db.from('care_introductions').update({ status: 'sent', provider_message_id: data?.id || null, finished_at: new Date().toISOString() }).eq('id', rec.id)
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300)
    await db.from('care_introductions').update({ status: 'failed', error: msg, finished_at: new Date().toISOString() }).eq('id', rec.id)
    throw new CareError(`The introduction wasn’t sent: ${msg} The project is still marked complete; send it again with Website Care introduction in the client’s panel.`, 502)
  }
  await logActivity({ actor, action: 'care_introduction_sent', detail: { client: client.id, project: project?.id || null, to: pre.recipient.email } })
  return { sent_to: pre.recipient.email, introduction_id: rec.id }
}
