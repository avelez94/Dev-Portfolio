import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { SITE_URL } from '@/content/site'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { formatCallDate, formatCallTime } from '@/lib/time'

const resend = new Resend(process.env.RESEND_API_KEY)
const ZOOM_OAUTH = process.env.ZOOM_OAUTH_BASE || 'https://zoom.us'
const ZOOM_API = process.env.ZOOM_API_BASE || 'https://api.zoom.us'

async function getZoomToken() {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64')
  const res = await fetch(
    `${ZOOM_OAUTH}/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const data = await res.json()
  return data.access_token
}

async function createZoomMeeting(scheduledAt: string, clientName: string) {
  const token = await getZoomToken()
  const res = await fetch(`${ZOOM_API}/v2/users/me/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: `Discovery call: ${clientName}`,
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

    // Create the Zoom meeting first. If Zoom fails, nothing is booked and the
    // visitor can simply try again; no booking is saved with a broken link.
    let zoom: { meetingId: string; joinUrl: string; hostUrl: string }
    try {
      zoom = await createZoomMeeting(scheduledAt, intake.name)
      if (!zoom.joinUrl || !zoom.hostUrl) throw new Error('Zoom returned no meeting link')
    } catch (zoomErr) {
      console.error('Zoom meeting creation failed:', zoomErr)
      return NextResponse.json(
        { error: 'ZOOM_UNAVAILABLE', message: 'Your project details are safe, but the video meeting could not be created just now, so nothing was booked. Please try again in a minute.' },
        { status: 502 }
      )
    }

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

    const formattedDate = formatCallDate(scheduledAt)
    const formattedTime = formatCallTime(scheduledAt)

    // The booking is saved. Email problems are logged, never reported as a failed booking.
    let emailed = false
    try {
      const m = mail.callConfirmed({ name: intake.name, date: formattedDate, time: formattedTime, joinUrl: zoom.joinUrl })
      const { error } = await resend.emails.send({ from: BRAND.from, to: intake.email, subject: m.subject, html: m.html, text: m.text })
      if (error) throw error
      emailed = true
    } catch (mailErr) {
      console.error('Booking client email failed:', mailErr)
    }
    try {
      const m = mail.callAdmin({
        name: intake.name, email: intake.email, business: intake.business,
        type: intake.project_type, description: intake.description,
        budget: intake.budget, timeline: intake.timeline, heard: intake.heard_from,
        priority: intake.priority, notes: intake.notes, details: intake.details ?? null,
        date: formattedDate, time: formattedTime,
        hostUrl: zoom.hostUrl, joinUrl: zoom.joinUrl, adminUrl: `${SITE_URL}/admin`,
      })
      const { error } = await resend.emails.send({ from: BRAND.adminFrom, to: BRAND.email, replyTo: intake.email, subject: m.subject, html: m.html, text: m.text })
      if (error) throw error
    } catch (mailErr) {
      console.error('Booking admin email failed:', mailErr)
    }

    // Only what the visitor needs. The Zoom host link is never sent to the browser.
    return NextResponse.json({ success: true, booking: { id: booking.id, scheduled_at: booking.scheduled_at, join_url: zoom.joinUrl }, emailed })
  } catch (err) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
