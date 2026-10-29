import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { formatCallDate, formatCallTime } from '@/lib/time'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    // The cron runs once a day (vercel.json), so each run covers the next day's
    // calls: 24 to 48 hours out. The original 24 to 25 hour window only caught
    // calls in one hour of the day, so most reminders were never sent.
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*, intake_submissions(*)')
      .eq('status', 'scheduled')
      .gte('scheduled_at', in24h.toISOString())
      .lt('scheduled_at', in48h.toISOString())

    if (error) throw error
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No reminders needed' })
    }

    let sent = 0

    for (const booking of bookings) {
      const intake = booking.intake_submissions
      if (!intake) continue

      const m = mail.callReminder({
        name: intake.name,
        date: formatCallDate(booking.scheduled_at),
        time: formatCallTime(booking.scheduled_at),
        joinUrl: booking.zoom_join_url,
      })
      try {
        const { error: mailErr } = await resend.emails.send({ from: BRAND.from, to: intake.email, subject: m.subject, html: m.html, text: m.text })
        if (mailErr) throw mailErr
      } catch (mailErr) {
        console.error('Reminder email failed for booking', booking.id, mailErr)
        continue
      }

      sent++
    }

    return NextResponse.json({ sent, message: `Sent ${sent} reminder(s)` })
  } catch (err) {
    console.error('Cron reminder error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}