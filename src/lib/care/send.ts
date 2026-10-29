/**
 * Sending an approved report. The attachment is the exact PDF stored at
 * approval (its SHA 256 is checked before sending). One send per approved
 * version can be in flight or accepted at a time, enforced by the database.
 * "Accepted" means the email provider took the message; it is not proof of
 * delivery to the inbox.
 */
import { createHash } from 'node:crypto'
import { Resend } from 'resend'
import { BRAND } from '@/lib/brand'
import { db, must, CareError, getObject, logActivity, REPORTS_BUCKET } from './db'
import { clientEmailAllowed } from './config'
import { clientReport, defaultClientMessage } from './emails'

let resend: Resend | null = null
const client = () => (resend ??= new Resend(process.env.RESEND_API_KEY))

export async function sendPreview(cycleId: string) {
  const report = must(await db.from('care_reports').select('*').eq('cycle_id', cycleId).single(), 'Report')
  if (!report.current_approval_id) throw new CareError('Approve the report before sending.', 409)
  const approval = must(await db.from('care_report_approvals').select('*').eq('id', report.current_approval_id).single(), 'Approval')
  const snap = approval.snapshot
  const subject = `Your website health report for ${snap.period.label}`
  const message = defaultClientMessage({ name: snap.recipient.name, monthLabel: snap.period.label, siteLabel: snap.site.label })
  const filename = `Health report ${snap.site.label} ${snap.period.label}.pdf`.replace(/[^\w .]/g, '')
  return {
    approval_id: approval.id, version: approval.version, recipient_name: snap.recipient.name, recipient_email: snap.recipient.email,
    subject, message, filename, pdf_sha256: approval.pdf_sha256, approved_by: approval.approved_by, approved_at: approval.approved_at,
    allowed: clientEmailAllowed(snap.recipient.email),
  }
}

export async function sendReport(cycleId: string, body: { approval_id?: string; confirm_email?: string; subject?: string; message?: string }, actor: string) {
  const report = must(await db.from('care_reports').select('*').eq('cycle_id', cycleId).single(), 'Report')
  if (report.status !== 'approved' || !report.current_approval_id) throw new CareError('Only an approved report can be sent. Approve the latest version first.', 409)
  if (body.approval_id !== report.current_approval_id) throw new CareError('The approved version changed. Reopen the send screen.', 409)
  const approval = must(await db.from('care_report_approvals').select('*').eq('id', report.current_approval_id).single(), 'Approval')
  if (approval.invalidated_at) throw new CareError('This approval is no longer valid.', 409)
  const to = String(approval.snapshot.recipient.email || '').trim()
  if (!to) throw new CareError('There is no recipient email on the approved report.', 422)
  if (String(body.confirm_email || '').trim().toLowerCase() !== to.toLowerCase()) throw new CareError(`Type the recipient address exactly (${to}) to confirm.`, 422)
  const allowed = clientEmailAllowed(to)
  if (!allowed.ok) throw new CareError(allowed.reason!, 403)
  const subject = String(body.subject || '').trim().slice(0, 200)
  const message = String(body.message || '').trim().slice(0, 5000)
  if (subject.length < 3 || message.length < 3) throw new CareError('Add a subject and message.', 422)

  const ins = await db.from('care_report_sends').insert({
    report_id: report.id, approval_id: approval.id, recipient_name: approval.snapshot.recipient.name, recipient_email: to, subject, message,
    pdf_path: approval.pdf_path, pdf_sha256: approval.pdf_sha256, sent_by: actor,
  }).select('*').single()
  if (ins.error) {
    if (ins.error.code === '23505') throw new CareError('This version was already sent (or is sending right now). It will not be sent twice.', 409)
    throw new CareError(ins.error.message, 500)
  }
  const send = ins.data
  const finish = async (patch: Record<string, unknown>) => db.from('care_report_sends').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', send.id)
  let pdf: Buffer
  try {
    pdf = await getObject(REPORTS_BUCKET, approval.pdf_path)
  } catch {
    await finish({ status: 'failed', error: 'The approved PDF could not be loaded. Nothing was sent.' })
    throw new CareError('The approved PDF could not be loaded. Nothing was sent.', 500)
  }
  if (createHash('sha256').update(pdf).digest('hex') !== approval.pdf_sha256) {
    await finish({ status: 'failed', error: 'The stored PDF does not match the approved file. Nothing was sent.' })
    throw new CareError('The stored PDF does not match the approved file. Nothing was sent.', 500)
  }
  const snap = approval.snapshot
  const m = clientReport({ subject, message, snap })
  const filename = `Health report ${snap.site.label} ${snap.period.label}.pdf`.replace(/[^\w .]/g, '')
  try {
    const { data, error } = await client().emails.send(
      { from: BRAND.from, to, replyTo: BRAND.email, subject: m.subject, html: m.html, text: m.text, attachments: [{ filename, content: pdf.toString('base64') }] },
      { idempotencyKey: `care-send-${send.id}` },
    )
    if (error) throw new Error(error.message || 'The email provider refused the message.')
    await finish({ status: 'accepted', provider_message_id: data?.id || null })
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300)
    await finish({ status: 'failed', error: msg })
    await logActivity({ cycle_id: cycleId, actor, action: 'report_send_failed', detail: { version: approval.version, error: msg } })
    throw new CareError(`Sending failed: ${msg} The approved report is kept; you can retry without rerunning the checks.`, 502)
  }
  const now = new Date().toISOString()
  await db.from('care_reports').update({ status: 'sent', updated_at: now }).eq('id', report.id).eq('current_approval_id', approval.id)
  const cycle = must(await db.from('care_cycles').select('id, site_id').eq('id', cycleId).single(), 'Cycle')
  await db.from('care_cycles').update({ completed_at: now, updated_at: now }).eq('id', cycleId)
  await db.from('care_sites').update({ last_completed_review_at: now, updated_at: now }).eq('id', cycle.site_id)
  await logActivity({ cycle_id: cycleId, site_id: cycle.site_id, actor, action: 'report_sent', detail: { version: approval.version, to, send_id: send.id } })
  return { send_id: send.id, status: 'accepted' }
}

/** A send stuck in "sending" (the server stopped mid send) can be marked failed after a wait, with a warning to check first. */
export async function markStuckSend(sendId: string, actor: string) {
  const s = must(await db.from('care_report_sends').select('*').eq('id', sendId).single(), 'Send')
  if (s.status !== 'sending') throw new CareError('Only a send that is still marked sending can be changed.', 409)
  if (Date.now() - new Date(s.created_at).getTime() < 10 * 60_000) throw new CareError('Wait 10 minutes before changing a send in progress.', 409)
  await db.from('care_report_sends').update({ status: 'failed', error: 'Marked not sent by the owner after it stopped responding. Check the email provider log before retrying.', finished_at: new Date().toISOString() }).eq('id', sendId).eq('status', 'sending')
  await logActivity({ actor, action: 'report_send_marked_failed', detail: { send_id: sendId } })
}
