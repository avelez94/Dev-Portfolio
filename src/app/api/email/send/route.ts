import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const { clientEmail, cc, subject, message, attachment } = await req.json()
    const m = mail.message({ subject: String(subject || ''), message: String(message || '') })
    const { error } = await resend.emails.send({
      from: BRAND.from,
      to: clientEmail,
      cc: cc || BRAND.email,
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(attachment ? { attachments: [{ filename: attachment.name, content: attachment.data }] } : {}),
    })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
