import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      name, email, business, type, description,
      existing, assets, integrations, references,
      timeline, budget, heard, priority, anything,
    } = body

    const { data: submission, error } = await supabaseAdmin
      .from('intake_submissions')
      .insert({
        name,
        email,
        business: business || null,
        project_type: type,
        description,
        budget: budget || null,
        timeline: timeline || null,
        heard_from: heard,
        priority: priority || null,
        notes: anything || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/book?ref=${submission.id}`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: email,
      subject: 'Got your project details — here is your next step',
      html: getClientEmailHtml({ name, bookingUrl }),
    })

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: 'alante@alantevelez.com',
      subject: `New intake submission from ${name}`,
      html: getAdminEmailHtml({ name, email, business, type, description, budget, timeline, heard, priority, anything, submissionId: submission.id }),
    })

    return NextResponse.json({ success: true, id: submission.id })
  } catch (err) {
    console.error('Intake error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

function getClientEmailHtml({ name, bookingUrl }: { name: string; bookingUrl: string }) {
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
  .cta { display: inline-block; background: #A96860; color: #FAF3E8; text-decoration: none; padding: 14px 32px; font-family: monospace; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 2px; }
  .note { font-size: 13px; color: #8B7D73; margin-top: 8px; font-family: monospace; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(169,104,96,0.15); }
  .footer p { font-size: 12px; color: #8B7D73; margin: 0; font-family: monospace; letter-spacing: 0.06em; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Full Stack Web Developer</div>
  <div class="divider"></div>
  <h1 class="heading">Got your<br><em>details.</em></h1>
  <p>Hi ${name}, your project submission came through and I have everything I need to prepare for our conversation.</p>
  <p>Your next step is to <strong>schedule your discovery call</strong>. It is a focused 20 minute conversation where we will confirm scope, timeline, and fit. I will have already reviewed your submission before we get on the call.</p>
  <div style="margin: 36px 0;">
    <a href="${bookingUrl}" class="cta">Schedule Your Discovery Call</a>
    <p class="note">Takes about 60 seconds. Pick a time that works for you.</p>
  </div>
  <p>If you have any questions before the call, just reply to this email.</p>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body>
</html>`
}

function getAdminEmailHtml({ name, email, business, type, description, budget, timeline, heard, priority, anything, submissionId }: any) {
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin`
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
  .label { font-family: monospace; font-size: 11px; color: #A96860; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
  .value { font-size: 14px; color: #2A2420; line-height: 1.6; margin-bottom: 16px; font-family: Georgia, serif; }
  .cta { display: inline-block; background: #A96860; color: #FAF3E8; text-decoration: none; padding: 12px 24px; font-family: monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 2px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(169,104,96,0.15); }
  .footer p { font-size: 12px; color: #8B7D73; font-family: monospace; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Admin Notification</div>
  <div class="divider"></div>
  <p class="heading">New submission from <span>${name}</span></p>
  <p class="sub">No call booked yet. Review when they schedule.</p>
  <div class="label">Name</div><div class="value">${name}</div>
  <div class="label">Email</div><div class="value">${email}</div>
  <div class="label">Business</div><div class="value">${business || 'Not provided'}</div>
  <div class="divider"></div>
  <div class="label">Project type</div><div class="value">${type}</div>
  <div class="label">Description</div><div class="value">${description}</div>
  <div class="label">Budget</div><div class="value">${budget || 'Not provided'}</div>
  <div class="label">Timeline</div><div class="value">${timeline || 'Not provided'}</div>
  <div class="divider"></div>
  <div class="label">How they found you</div><div class="value">${heard}</div>
  <div class="label">Top priority</div><div class="value">${priority || 'Not provided'}</div>
  <div class="label">Additional notes</div><div class="value">${anything || 'None'}</div>
  <div class="divider"></div>
  <a href="${adminUrl}" class="cta">View in Admin Dashboard</a>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body>
</html>`
}