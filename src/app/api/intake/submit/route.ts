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
      to: 'alante.v@gmail.com',
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
  body { background: #2C1A0E; font-family: Georgia, sans-serif; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 48px 24px; }
  .logo { font-family: Georgia, serif; font-size: 18px; color: #C4704A; margin-bottom: 40px; }
  .divider { height: 1px; background: rgba(196,112,74,0.2); margin: 32px 0; }
  .heading { font-family: Georgia, serif; font-size: 32px; font-weight: 700; color: #FAF6F0; line-height: 1.1; margin-bottom: 20px; }
  .heading em { font-style: italic; color: #C4704A; }
  p { font-size: 15px; line-height: 1.75; color: rgba(250,246,240,0.65); margin-bottom: 16px; }
  p strong { color: #FAF6F0; font-weight: 500; }
  .cta { display: inline-block; background: #C4704A; color: #FAF6F0; text-decoration: none; padding: 14px 32px; font-family: 'Courier New', monospace; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; }
  .note { font-size: 13px; color: rgba(250,246,240,0.4); margin-top: 8px; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(196,112,74,0.15); }
  .footer p { font-size: 13px; color: rgba(250,246,240,0.3); margin: 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
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
    <p>Alante Velez &nbsp;·&nbsp; Full Stack Web Developer</p>
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
  body { background: #0F0F0F; font-family: Georgia, sans-serif; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
  .heading { font-family: Georgia, serif; font-size: 22px; color: #FAF6F0; margin-bottom: 8px; }
  .heading span { color: #C4704A; }
  .sub { font-size: 13px; color: rgba(250,246,240,0.4); margin-bottom: 28px; font-family: 'Courier New', monospace; }
  .label { font-family: 'Courier New', monospace; font-size: 11px; color: #C4704A; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
  .value { font-size: 14px; color: #FAF6F0; line-height: 1.6; margin-bottom: 16px; }
  .divider { height: 1px; background: #2a2a2a; margin: 24px 0; }
  .cta { display: inline-block; background: #C4704A; color: #0F0F0F; text-decoration: none; padding: 12px 24px; font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
</style>
</head>
<body>
<div class="wrap">
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
</div>
</body>
</html>`
}
