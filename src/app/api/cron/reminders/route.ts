import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*, intake_submissions(*)')
      .eq('status', 'scheduled')
      .gte('scheduled_at', in24h.toISOString())
      .lte('scheduled_at', in25h.toISOString())

    if (error) throw error
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No reminders needed' })
    }

    let sent = 0

    for (const booking of bookings) {
      const intake = booking.intake_submissions
      if (!intake) continue

      const formattedDate = new Date(booking.scheduled_at).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
      const formattedTime = new Date(booking.scheduled_at).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
        timeZone: 'America/New_York', timeZoneName: 'short'
      })

      // Email to client
      await resend.emails.send({
        from: 'Alante Velez <alante@alantevelez.com>',
        to: intake.email,
        subject: `Reminder — your discovery call is coming up`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#2C1A0E;font-family:Georgia,sans-serif}
  .wrap{max-width:600px;margin:0 auto;padding:48px 24px}
  .logo{font-family:Georgia,serif;font-size:18px;color:#C4704A;margin-bottom:40px}
  .divider{height:1px;background:rgba(196,112,74,0.2);margin:32px 0}
  .heading{font-family:Georgia,serif;font-size:32px;font-weight:700;color:#FAF6F0;line-height:1.1;margin-bottom:20px}
  .heading em{font-style:italic;color:#C4704A}
  p{font-size:15px;line-height:1.75;color:rgba(250,246,240,0.65);margin-bottom:16px}
  .detail-box{background:#3d2a1a;border-left:3px solid #C4704A;padding:20px 24px;margin:28px 0}
  .detail-label{font-family:'Courier New',monospace;font-size:11px;color:#C4704A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px}
  .detail-value{font-size:15px;color:#FAF6F0;margin-bottom:16px}
  .detail-value:last-child{margin-bottom:0}
  .cta{display:inline-block;background:#C4704A;color:#FAF6F0;text-decoration:none;padding:14px 32px;font-family:'Courier New',monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;margin:8px 0}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(196,112,74,0.15)}
  .footer p{font-size:13px;color:rgba(250,246,240,0.3);margin:0}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="divider"></div>
  <h1 class="heading">See you<br><em>soon.</em></h1>
  <p>Hi ${intake.name}, just a reminder that your discovery call is coming up soon. I have reviewed your project details and I am ready to dive in.</p>
  <div class="detail-box">
    <div class="detail-label">Date</div>
    <div class="detail-value">${formattedDate}</div>
    <div class="detail-label">Time</div>
    <div class="detail-value">${formattedTime}</div>
    <div class="detail-label">Duration</div>
    <div class="detail-value">20 minutes</div>
  </div>
  <a href="${booking.zoom_join_url}" class="cta">Join Zoom Call</a>
  <p style="margin-top:24px;">If you need to reschedule, just reply to this email.</p>
  <div class="footer">
    <p>Alante Velez &nbsp;·&nbsp; Full Stack Web Developer</p>
  </div>
</div>
</body></html>`
      })

      sent++
    }

    return NextResponse.json({ sent, message: `Sent ${sent} reminder(s)` })
  } catch (err) {
    console.error('Cron reminder error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}