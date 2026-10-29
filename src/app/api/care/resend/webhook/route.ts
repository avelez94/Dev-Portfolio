/**
 * Resend delivery events for sent care reports (optional; needs
 * RESEND_WEBHOOK_SECRET). Signed with Svix: HMAC SHA256 over
 * "id.timestamp.body" with the base64 secret after "whsec_". Only this tells us
 * a report was delivered or bounced; without it, a sent report stays
 * "accepted by the email provider, delivery not confirmed".
 */
import { NextRequest, NextResponse } from 'next/server'
import { careEnabled, careOff } from '@/lib/care/config'
import { db, logActivity } from '@/lib/care/db'
import { verifySvix } from '@/lib/care/svix'

const RANK: Record<string, number> = { unknown: 0, delayed: 1, delivered: 2, bounced: 3, complained: 3 }
const MAP: Record<string, string> = { 'email.delivered': 'delivered', 'email.delivery_delayed': 'delayed', 'email.bounced': 'bounced', 'email.complained': 'complained' }

export async function POST(req: NextRequest) {
  if (!careEnabled()) return careOff()
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const body = await req.text()
  const id = req.headers.get('svix-id')
  if (!verifySvix(body, id, req.headers.get('svix-timestamp'), req.headers.get('svix-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  let ev: { type?: string; data?: { email_id?: string } }
  try { ev = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const status = MAP[ev.type || '']
  const emailId = ev.data?.email_id
  const ins = await db.from('care_email_events').insert({ id, type: String(ev.type || '').slice(0, 60), email_id: emailId || null })
  if (ins.error?.code === '23505') return NextResponse.json({ received: true, duplicate: true })
  if (!status || !emailId) return NextResponse.json({ received: true, ignored: true })
  const send = (await db.from('care_report_sends').select('id, report_id, delivery_status').eq('provider_message_id', emailId).maybeSingle()).data
  if (!send) return NextResponse.json({ received: true, ignored: 'not a care report email' })
  // Never step backwards (a late "delayed" can't undo "delivered" or "bounced").
  if (RANK[status] > RANK[send.delivery_status || 'unknown']) {
    await db.from('care_report_sends').update({ delivery_status: status, delivery_at: new Date().toISOString() }).eq('id', send.id)
    await logActivity({ actor: 'resend', action: `report_${status}`, detail: { send_id: send.id } })
  }
  return NextResponse.json({ received: true })
}
