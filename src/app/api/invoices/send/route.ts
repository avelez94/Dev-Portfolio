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
    const { clientEmail, clientName, cc, invoiceNumber, invoiceType, totalFee, depositAmount, dueDate, serviceDesc, hours, hourlyRate } = await req.json()
    const m = mail.invoice({ clientName, invoiceNumber, invoiceType, totalFee: Number(totalFee) || 0, depositAmount: Number(depositAmount) || 0, dueDate, serviceDesc, hours, hourlyRate })
    const { error } = await resend.emails.send({ from: BRAND.from, to: clientEmail, cc: cc || BRAND.email, subject: m.subject, html: m.html, text: m.text })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send invoice error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
