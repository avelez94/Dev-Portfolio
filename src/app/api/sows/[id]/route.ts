import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { SITE_URL } from '@/content/site'
import { NO_STORE, UUID_RE, publicSow } from '@/lib/public-docs'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  const { data, error } = await supabaseAdmin.from('sows').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  return NextResponse.json(publicSow(data), { headers: NO_STORE })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { action, declineReason } = await req.json()
    if (action !== 'accepted' && action !== 'declined') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: sow } = await supabaseAdmin.from('sows').select('*').eq('id', id).single()
    if (!sow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (sow.status !== 'pending') return NextResponse.json({ error: 'Already responded' }, { status: 400 })

    await supabaseAdmin.from('sows').update({
      status: action,
      responded_at: new Date().toISOString(),
      response_ip: ip,
      decline_reason: declineReason || null,
    }).eq('id', id)

    const sowNote = mail.responseAdmin({ kind: 'SOW', action, clientName: sow.client_name, clientEmail: sow.client_email, projectTitle: sow.project_title, total: sow.total, declineReason, adminUrl: `${SITE_URL}/admin` })
    const { error: mailErr_sowNote } = await resend.emails.send({ from: BRAND.adminFrom, to: BRAND.email, subject: sowNote.subject, html: sowNote.html, text: sowNote.text })
    if (mailErr_sowNote) console.error('Email failed:', mailErr_sowNote)

    if (action === 'accepted') {
      const sowThanks = mail.sowAcceptedClient({ clientName: sow.client_name, projectTitle: sow.project_title })
      const { error: mailErr_sowThanks } = await resend.emails.send({ from: BRAND.from, to: sow.client_email, subject: sowThanks.subject, html: sowThanks.html, text: sowThanks.text })
      if (mailErr_sowThanks) console.error('Email failed:', mailErr_sowThanks)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('SOW respond error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}