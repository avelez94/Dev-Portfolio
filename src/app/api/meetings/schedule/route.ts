import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { formatCallDate, formatCallTime } from '@/lib/time'

const ZOOM_OAUTH = process.env.ZOOM_OAUTH_BASE || 'https://zoom.us'
const ZOOM_API = process.env.ZOOM_API_BASE || 'https://api.zoom.us'

const resend = new Resend(process.env.RESEND_API_KEY)

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

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const { clientId, clientName, clientEmail, scheduledAt, title, cc } = await req.json()

    if (!clientId || !scheduledAt || !clientEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const token = await getZoomToken()
    const res = await fetch(`${ZOOM_API}/v2/users/me/meetings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: title || 'Project check in: ' + clientName,
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


    const m = mail.meetingScheduled({
      name: clientName,
      title: title || 'Project Check-in',
      date: formatCallDate(scheduledAt),
      time: formatCallTime(scheduledAt),
      joinUrl: zoom.join_url,
    })
    const { error: mailErr } = await resend.emails.send({
      from: BRAND.from,
      to: clientEmail,
      cc: cc || BRAND.email,
      subject: m.subject,
      html: m.html,
      text: m.text,
    })
    if (mailErr) console.error('Meeting email failed:', mailErr)

    return NextResponse.json({ success: true, joinUrl: zoom.join_url, hostUrl: zoom.start_url })
  } catch (err) {
    console.error('Schedule meeting error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}