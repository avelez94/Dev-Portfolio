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
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  const data = await res.json()
  return data.access_token
}

async function createZoomMeeting(scheduledAt: string, clientName: string) {
  const token = await getZoomToken()

  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: `Discovery Call — ${clientName}`,
      type: 2,
      start_time: new Date(scheduledAt).toISOString(),
      duration: 20,
      timezone: 'America/New_York',
      settings: {
        host_video: true,
        participant_video: true,
        waiting_room: true,
        auto_recording: 'none',
      },
    }),
  })

  const data = await res.json()
  return {
    meetingId: String(data.id),
    joinUrl: data.join_url,
    hostUrl: data.start_url,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { intakeId, scheduledAt } = body

    if (!intakeId || !scheduledAt) {
      return NextResponse.json(
        { error: 'intakeId and scheduledAt required' },
        { status: 400 }
      )
    }

    // Get intake submission
    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('intake_submissions')
      .select('*')
      .eq('id', intakeId)
      .single()

    if (intakeError || !intake) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    // Check slot is still available (48hr rule + not already booked)
    const minBookingTime = new Date(Date.now() + 48 * 60 * 60 * 1000)
    if (new Date(scheduledAt) < minBookingTime) {
      return NextResponse.json(
        { error: 'Slot must be at least 48 hours from now' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('scheduled_at', scheduledAt)
      .eq('status', 'scheduled')
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Slot already taken' },
        { status: 409 }
      )
    }

    // Create Zoom meeting
    const zoom = await createZoomMeeting(scheduledAt, intake.name)

    // Save booking to Supabase
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        intake_id: intakeId,
        scheduled_at: scheduledAt,
        zoom_meeting_id: zoom.meetingId,
        zoom_join_url: zoom.joinUrl,
        zoom_host_url: zoom.hostUrl,
        status: 'scheduled',
      })
      .select()
      .single()

    if (bookingError) throw bookingError

    // Update intake status to booked
    await supabaseAdmin
      .from('intake_submissions')
      .update({ status: 'booked' })
      .eq('id', intakeId)

    // Auto-create client in pipeline
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('intake_id', intakeId)
      .single()

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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const formattedTime = new Date(scheduledAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })

    // Send confirmation email to client
    await resend.emails.send({
      from: 'Alante Velez <onboarding@resend.dev>',
      to: intake.email,
      subject: `Your discovery call is confirmed — ${formattedDate}`,
      html: getClientConfirmationHtml({
        name: intake.name,
        date: formattedDate,
        time: formattedTime,
        joinUrl: zoom.joinUrl,
      }),
    })

    // Send notification email to you
    await resend.emails.send({
      from: 'Portfolio <onboarding@resend.dev>',
      to: 'alante.v@gmail.com',
      subject: `Discovery call booked — ${intake.name} on ${formattedDate}`,
      html: getAdminNotificationHtml({
        name: intake.name,
        email: intake.email,
        business: intake.business,
        projectType: intake.project_type,
        description: intake.description,
        budget: intake.budget,
        timeline: intake.timeline,
        priority: intake.priority,
        notes: intake.notes,
        date: formattedDate,
        time: formattedTime,
        hostUrl: zoom.hostUrl,
        joinUrl: zoom.joinUrl,
      }),
    })

    return NextResponse.json({ success: true, booking })
  } catch (err) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

function getClientConfirmationHtml({ name, date, time, joinUrl }: {
  name: string
  date: string
  time: string
  joinUrl: string
}) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #2C1A0E; font-family: Georgia, sans-serif; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 48px 24px; }
  .logo { font-family: Georgia, serif; font-size: 18px; color: #C4704A; margin-bottom: 40px; }
  .divider { height: 1px; background: rgba(196,112,74,0.2); margin: 32px 0; }
  .heading { font-family: Georgia, serif; font-size: 32px; font-weight: 700; color: #FAF6F0; line-height: 1.1; margin-bottom: 20px; }
  .heading em { font-style: italic; color: #C4704A; }
  p { font-size: 15px; line-height: 1.75; color: rgba(250,246,240,0.65); margin-bottom: 16px; }
  p strong { color: #FAF6F0; font-weight: 500; }
  .detail-box { background: #3d2a1a; border-left: 3px solid #C4704A; padding: 20px 24px; margin: 28px 0; }
  .detail-label { font-family: 'Courier New', monospace; font-size: 11px; color: #C4704A; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
  .detail-value { font-size: 15px; color: #FAF6F0; margin-bottom: 16px; }
  .detail-value:last-child { margin-bottom: 0; }
  .cta { display: inline-block; background: #C4704A; color: #FAF6F0; text-decoration: none; padding: 14px 32px; font-family: 'Courier New', monospace; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 8px 0; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(196,112,74,0.15); }
  .footer p { font-size: 13px; color: rgba(250,246,240,0.3); margin: 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
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
    <p>Alante Velez &nbsp;·&nbsp; Full Stack Web Developer</p>
  </div>
</div>
</body>
</html>`
}

function getAdminNotificationHtml({
  name, email, business, projectType, description,
  budget, timeline, priority, notes, date, time, hostUrl, joinUrl
}: any) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0F0F0F; font-family: Georgia, sans-serif; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
  .heading { font-family: Georgia, serif; font-size: 22px; color: #FAF6F0; margin-bottom: 8px; }
  .heading span { color: #C4704A; }
  .sub { font-size: 13px; color: rgba(250,246,240,0.4); margin-bottom: 28px; font-family: 'Courier New', monospace; }
  .label { font-family: 'Courier New', monospace; font-size: 11px; color: #C4704A; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
  .value { font-size: 14px; color: #FAF6F0; line-height: 1.6; margin-bottom: 16px; }
  .divider { height: 1px; background: #2a2a2a; margin: 24px 0; }
  .call-box { background: #1a1a1a; border: 1px solid #C4704A; padding: 20px 24px; margin: 24px 0; }
  .cta { display: inline-block; background: #C4704A; color: #0F0F0F; text-decoration: none; padding: 12px 24px; font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-right: 12px; margin-top: 8px; }
  .cta-ghost { display: inline-block; border: 1px solid #C4704A; color: #C4704A; text-decoration: none; padding: 12px 24px; font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 8px; }
</style>
</head>
<body>
<div class="wrap">
  <p class="heading">Discovery call booked — <span>${name}</span></p>
  <p class="sub">Review their intake form below before the call</p>
  <div class="call-box">
    <div class="label">Date and time</div>
    <div class="value">${date} at ${time}</div>
    <div class="label">Zoom host link</div>
    <div class="value"><a href="${hostUrl}" style="color: #C4704A;">${hostUrl}</a></div>
    <div class="label">Client join link</div>
    <div class="value"><a href="${joinUrl}" style="color: rgba(250,246,240,0.4);">${joinUrl}</a></div>
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
</div>
</body>
</html>`
}