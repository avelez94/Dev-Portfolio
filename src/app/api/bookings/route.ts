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

async function createZoomMeeting(scheduledAt: string, clientName: string) {
  const token = await getZoomToken()
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: `Discovery Call — ${clientName}`,
      type: 2,
      start_time: new Date(scheduledAt).toISOString(),
      duration: 20,
      timezone: 'America/New_York',
      settings: { host_video: true, participant_video: true, waiting_room: true, auto_recording: 'none' },
    }),
  })
  const data = await res.json()
  return { meetingId: String(data.id), joinUrl: data.join_url, hostUrl: data.start_url }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { intakeId, scheduledAt } = body

    if (!intakeId || !scheduledAt) {
      return NextResponse.json({ error: 'intakeId and scheduledAt required' }, { status: 400 })
    }

    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('intake_submissions').select('*').eq('id', intakeId).single()

    if (intakeError || !intake) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    const minBookingTime = new Date(Date.now() + 48 * 60 * 60 * 1000)
    if (new Date(scheduledAt) < minBookingTime) {
      return NextResponse.json({ error: 'Slot must be at least 48 hours from now' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('bookings').select('id').eq('scheduled_at', scheduledAt).eq('status', 'scheduled').single()

    if (existing) {
      return NextResponse.json({ error: 'Slot already taken' }, { status: 409 })
    }

    const zoom = await createZoomMeeting(scheduledAt, intake.name)

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings').insert({
        intake_id: intakeId,
        scheduled_at: scheduledAt,
        zoom_meeting_id: zoom.meetingId,
        zoom_join_url: zoom.joinUrl,
        zoom_host_url: zoom.hostUrl,
        status: 'scheduled',
      }).select().single()

    if (bookingError) throw bookingError

    await supabaseAdmin.from('intake_submissions').update({ status: 'booked' }).eq('id', intakeId)

    const { data: existingClient } = await supabaseAdmin
      .from('clients').select('id').eq('intake_id', intakeId).single()

    if (!existingClient) {
      await supabaseAdmin.from('clients').insert({
        intake_id: intakeId,
        booking_id: booking.id,
        name: intake.name,
        email: intake.email,
        business: intake.business || null,
        pipeline_stage: 'discovery_call',
        platform: 'direct',
        notes: null,
      })
    }

    const formattedDate = new Date(scheduledAt).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const formattedTime = new Date(scheduledAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
    })

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: intake.email,
      subject: `Your discovery call is confirmed — ${formattedDate}`,
      html: getClientConfirmationHtml({ name: intake.name, date: formattedDate, time: formattedTime, joinUrl: zoom.joinUrl }),
    })

    await resend.emails.send({
      from: 'Portfolio <alante@alantevelez.com>',
      to: 'alante@alantevelez.com',
      subject: `Discovery call booked — ${intake.name} on ${formattedDate}`,
      html: getAdminNotificationHtml({
        name: intake.name, email: intake.email, business: intake.business,
        projectType: intake.project_type, description: intake.description,
        budget: intake.budget, timeline: intake.timeline,
        priority: intake.priority, notes: intake.notes,
        date: formattedDate, time: formattedTime,
        hostUrl: zoom.hostUrl, joinUrl: zoom.joinUrl,
      }),
    })

    return NextResponse.json({ success: true, booking })
  } catch (err) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

function getClientConfirmationHtml({ name, date, time, joinUrl }: {
  name: string; date: string; time: string; joinUrl: string
}) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #FAF3E8; font-family: Georgia, serif; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 48px 24px; }
  .logo { font-family: Georgia, serif; font-size: 18px; font-weight: 700; color: #2A2420; margin-bottom: 4px; }
  .logo-sub { font-family: monospace; font-size: 11px; color: #8B7D73; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 40px; }
  .divider { height: 1px; background: rgba(169,104,96,0.2); margin: 32px 0; }
  .heading { font-family: Georgia, serif; font-size: 32px; font-weight: 700; color: #2A2420; line-height: 1.1; margin-bottom: 20px; }
  .heading em { font-style: italic; color: #A96860; }
  p { font-size: 15px; line-height: 1.75; color: #3D3630; margin-bottom: 16px; font-family: Georgia, serif; }
  p strong { color: #2A2420; font-weight: 600; }
  .detail-box { background: #FFFFFF; border: 1px solid rgba(169,104,96,0.2); border-left: 3px solid #A96860; padding: 20px 24px; margin: 28px 0; border-radius: 4px; }
  .detail-label { font-family: monospace; font-size: 11px; color: #A96860; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; margin-top: 12px; }
  .detail-label:first-child { margin-top: 0; }
  .detail-value { font-size: 15px; color: #2A2420; margin-bottom: 4px; font-family: Georgia, serif; }
  .cta { display: inline-block; background: #A96860; color: #FAF3E8; text-decoration: none; padding: 14px 32px; font-family: monospace; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 8px 0; border-radius: 2px; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(169,104,96,0.15); }
  .footer p { font-size: 12px; color: #8B7D73; margin: 0; font-family: monospace; letter-spacing: 0.06em; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Full Stack Web Developer</div>
  <div class="divider"></div>
  <h1 class="heading">Call<br><em>confirmed.</em></h1>
  <p>Hi ${name}, your discovery call is booked. I will have reviewed your project details before we get on the call so we can skip the small talk and get straight to it.</p>
  <div class="detail-box">
    <div class="detail-label">Date</div>
    <div class="detail-value">${date}</div>
    <div class="detail-label">Time</div>
    <div class="detail-value">${time}</div>
    <div class="detail-label">Duration</div>
    <div class="detail-value">20 minutes</div>
    <div class="detail-label">Format</div>
    <div class="detail-value">Zoom video call</div>
  </div>
  <a href="${joinUrl}" class="cta">Join Zoom Call</a>
  <p style="margin-top: 24px;">Have your project references, existing logins, or any questions ready. If you need to reschedule, just reply to this email.</p>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body>
</html>`
}

function getAdminNotificationHtml({ name, email, business, projectType, description, budget, timeline, priority, notes, date, time, hostUrl, joinUrl }: any) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #FAF3E8; font-family: Georgia, serif; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
  .logo { font-family: Georgia, serif; font-size: 18px; font-weight: 700; color: #2A2420; margin-bottom: 4px; }
  .logo-sub { font-family: monospace; font-size: 11px; color: #8B7D73; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 28px; }
  .divider { height: 1px; background: rgba(169,104,96,0.2); margin: 24px 0; }
  .heading { font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: #2A2420; margin-bottom: 4px; }
  .heading span { color: #A96860; font-style: italic; }
  .sub { font-size: 12px; color: #8B7D73; margin-bottom: 28px; font-family: monospace; letter-spacing: 0.06em; }
  .call-box { background: #FFFFFF; border: 1px solid rgba(169,104,96,0.2); border-left: 3px solid #A96860; padding: 20px 24px; margin: 24px 0; border-radius: 4px; }
  .label { font-family: monospace; font-size: 11px; color: #A96860; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; margin-top: 12px; }
  .label:first-child { margin-top: 0; }
  .value { font-size: 14px; color: #2A2420; line-height: 1.6; margin-bottom: 4px; font-family: Georgia, serif; }
  .value a { color: #A96860; }
  .cta { display: inline-block; background: #A96860; color: #FAF3E8; text-decoration: none; padding: 12px 24px; font-family: monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-right: 12px; margin-top: 8px; border-radius: 2px; }
  .cta-ghost { display: inline-block; border: 1px solid #A96860; color: #A96860; text-decoration: none; padding: 12px 24px; font-family: monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 8px; border-radius: 2px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(169,104,96,0.15); }
  .footer p { font-size: 12px; color: #8B7D73; font-family: monospace; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Admin Notification</div>
  <div class="divider"></div>
  <p class="heading">Discovery call booked — <span>${name}</span></p>
  <p class="sub">Review their intake form below before the call</p>
  <div class="call-box">
    <div class="label">Date and time</div>
    <div class="value">${date} at ${time}</div>
    <div class="label">Zoom host link</div>
    <div class="value"><a href="${hostUrl}">${hostUrl}</a></div>
    <div class="label">Client join link</div>
    <div class="value"><a href="${joinUrl}" style="color:#8B7D73;">${joinUrl}</a></div>
  </div>
  <div class="divider"></div>
  <div class="label">Name</div><div class="value">${name}</div>
  <div class="label">Email</div><div class="value">${email}</div>
  <div class="label">Business</div><div class="value">${business || 'Not provided'}</div>
  <div class="divider"></div>
  <div class="label">Project type</div><div class="value">${projectType}</div>
  <div class="label">Description</div><div class="value">${description}</div>
  <div class="label">Budget</div><div class="value">${budget || 'Not provided'}</div>
  <div class="label">Timeline</div><div class="value">${timeline || 'Not provided'}</div>
  <div class="divider"></div>
  <div class="label">Top priority</div><div class="value">${priority || 'Not provided'}</div>
  <div class="label">Additional notes</div><div class="value">${notes || 'None'}</div>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body>
</html>`
}