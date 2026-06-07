import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function getZoomToken() {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64')
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const data = await res.json()
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, clientName, clientEmail, scheduledAt, title } = await req.json()

    if (!clientId || !scheduledAt || !clientEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const token = await getZoomToken()
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: title || 'Project Check-in — ' + clientName,
        type: 2,
        start_time: new Date(scheduledAt).toISOString(),
        duration: 30,
        timezone: 'America/New_York',
        settings: { host_video: true, participant_video: true, waiting_room: true },
      }),
    })

    const zoom = await res.json()

    await supabaseAdmin.from('meetings').insert({
      client_id: clientId,
      scheduled_at: scheduledAt,
      zoom_meeting_id: String(zoom.id),
      zoom_join_url: zoom.join_url,
      zoom_host_url: zoom.start_url,
      title: title || 'Project Check-in',
      status: 'scheduled',
    })

    const formattedDate = new Date(scheduledAt).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    const formattedTime = new Date(scheduledAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short'
    })

    await resend.emails.send({
      from: 'Alante Velez <onboarding@resend.dev>',
      to: clientEmail,
      subject: `Meeting scheduled — ${formattedDate}`,
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
  <h1 class="heading">Meeting<br><em>scheduled.</em></h1>
  <p>Hi ${clientName}, a project meeting has been scheduled. See the details below and use the Zoom link to join.</p>
  <div class="detail-box">
    <div class="detail-label">Meeting</div>
    <div class="detail-value">${title || 'Project Check-in'}</div>
    <div class="detail-label">Date</div>
    <div class="detail-value">${formattedDate}</div>
    <div class="detail-label">Time</div>
    <div class="detail-value">${formattedTime}</div>
    <div class="detail-label">Duration</div>
    <div class="detail-value">30 minutes</div>
  </div>
  <a href="${zoom.join_url}" class="cta">Join Zoom Meeting</a>
  <div class="footer">
    <p>Alante Velez &nbsp;·&nbsp; Full Stack Web Developer</p>
  </div>
</div>
</body></html>`
    })

    return NextResponse.json({ success: true, joinUrl: zoom.join_url, hostUrl: zoom.start_url })
  } catch (err) {
    console.error('Schedule meeting error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}