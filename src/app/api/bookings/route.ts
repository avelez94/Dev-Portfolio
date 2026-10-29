import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { SITE_URL } from '@/content/site'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { formatCallDate, formatCallTime } from '@/lib/time'
import { ACTIVE_BOOKING_STATUSES, STALE_HOLD_MS, holdsTime, openSlots } from '@/lib/availability'

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

/** Best effort: removes a meeting that ended up without a booking. */
async function deleteZoomMeeting(meetingId: string) {
  try {
    const token = await getZoomToken()
    const res = await fetch(`${ZOOM_API}/v2/meetings/${encodeURIComponent(meetingId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok && res.status !== 404) throw new Error(`Zoom delete returned ${res.status}`)
  } catch (err) {
    console.error(`Could not delete orphaned Zoom meeting ${meetingId}; remove it in Zoom:`, err)
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLOT_TAKEN = () => NextResponse.json({ error: 'SLOT_TAKEN', message: 'Someone just took that time.' }, { status: 409 })

async function releaseBooking(id: string) {
  const { error } = await supabaseAdmin.from('bookings').delete().eq('id', id)
  if (error) console.error(`Could not release booking ${id}:`, error)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { intakeId, scheduledAt } = body

    if (!intakeId || !scheduledAt) {
      return NextResponse.json({ error: 'intakeId and scheduledAt required' }, { status: 400 })
    }

    if (typeof intakeId !== 'string' || !UUID_RE.test(intakeId) || typeof scheduledAt !== 'string' || Number.isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const slotIso = new Date(scheduledAt).toISOString()

    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('intake_submissions').select('*').eq('id', intakeId).single()

    if (intakeError || !intake || intake.stage === 'merged') {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    // One active call per lead.
    const { data: mine, error: mineErr } = await supabaseAdmin
      .from('bookings').select('id, status, created_at').eq('intake_id', intakeId).in('status', ACTIVE_BOOKING_STATUSES)
    if (mineErr) throw mineErr
    if (intake.status === 'booked' || (mine || []).some(holdsTime)) {
      return NextResponse.json({ error: 'ALREADY_BOOKED', message: 'This project already has a call booked.' }, { status: 409 })
    }

    // The time must really be open: inside working hours, not blocked, 48 hours out, not taken.
    const day = slotIso.slice(0, 10)
    const prev = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10)
    if (!(await openSlots(prev, day)).includes(slotIso)) {
      const taken = await supabaseAdmin.from('bookings').select('id, status, created_at').eq('scheduled_at', slotIso).in('status', ACTIVE_BOOKING_STATUSES)
      if ((taken.data || []).some(holdsTime)) return SLOT_TAKEN()
      return NextResponse.json({ error: 'SLOT_UNAVAILABLE', message: 'That time isn’t available. Please choose another.' }, { status: 400 })
    }

    // 1. Claim the time. The database allows one active booking per time and per
    //    lead (see 20261029_booking_integrity.sql), so of two simultaneous requests
    //    exactly one insert succeeds. Nothing external is created before this.
    const staleBefore = new Date(Date.now() - STALE_HOLD_MS).toISOString()
    await supabaseAdmin.from('bookings').delete().eq('scheduled_at', slotIso).eq('status', 'holding').lt('created_at', staleBefore)
    await supabaseAdmin.from('bookings').delete().eq('intake_id', intakeId).eq('status', 'holding').lt('created_at', staleBefore)
    let { data: claim, error: claimErr } = await supabaseAdmin
      .from('bookings').insert({ intake_id: intakeId, scheduled_at: slotIso, status: 'holding' }).select().single()
    if (claimErr && (claimErr.code === '22P02' || claimErr.code === '23514')) {
      // The status column doesn't accept "holding" yet (enum or check constraint). Claim as scheduled.
      console.warn('bookings.status rejected "holding"; run supabase/migrations/20261029_booking_integrity.sql')
      ;({ data: claim, error: claimErr } = await supabaseAdmin
        .from('bookings').insert({ intake_id: intakeId, scheduled_at: slotIso, status: 'scheduled' }).select().single())
    }
    if (claimErr || !claim) {
      if (!claimErr) throw new Error('Booking claim returned no row')
      if (claimErr.code === '23505') {
        if (/one_active_per_intake/.test(claimErr.message || '')) {
          return NextResponse.json({ error: 'ALREADY_BOOKED', message: 'This project already has a call booked.' }, { status: 409 })
        }
        return SLOT_TAKEN()
      }
      throw claimErr
    }
    // Same guarantee if the unique index hasn't been created yet: the earliest claim wins.
    const { data: rivals } = await supabaseAdmin
      .from('bookings').select('id, created_at').eq('scheduled_at', slotIso).in('status', ACTIVE_BOOKING_STATUSES)
    const winner = (rivals || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))[0]
    if (winner && winner.id !== claim.id) {
      await releaseBooking(claim.id)
      return SLOT_TAKEN()
    }

    // 2. Create the Zoom meeting. If it fails, release the time; nothing is booked.
    let zoom: { meetingId: string; joinUrl: string; hostUrl: string }
    try {
      zoom = await createZoomMeeting(slotIso, intake.name)
      if (!zoom.joinUrl || !zoom.hostUrl) throw new Error('Zoom returned no meeting link')
    } catch (zoomErr) {
      console.error('Zoom meeting creation failed:', zoomErr)
      await releaseBooking(claim.id)
      return NextResponse.json(
        { error: 'ZOOM_UNAVAILABLE', message: 'Your project details are safe, but the video meeting could not be created just now, so nothing was booked. Please try again in a minute.' },
        { status: 502 }
      )
    }

    // 3. Confirm the booking with its meeting. If that fails, remove both so no
    //    meeting exists without a booking and the time isn't left blocked.
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .update({ zoom_meeting_id: zoom.meetingId, zoom_join_url: zoom.joinUrl, zoom_host_url: zoom.hostUrl, status: 'scheduled' })
      .eq('id', claim.id)
      .select()
      .single()
    if (bookingError || !booking) {
      console.error('Booking confirmation failed:', bookingError)
      await deleteZoomMeeting(zoom.meetingId)
      await releaseBooking(claim.id)
      return NextResponse.json({ error: 'BOOKING_FAILED', message: 'That didn’t go through, and nothing was booked. Please try again in a moment.' }, { status: 500 })
    }

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

    const formattedDate = formatCallDate(slotIso)
    const formattedTime = formatCallTime(slotIso)

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
