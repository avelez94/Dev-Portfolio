import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      clientId, clientName, clientEmail, clientBusiness,
      projectTitle, projectType, understood, lineItems, total,
      depositPct, outOfScope, timeline, nextSteps, message,
    } = body

    const { data: proposal, error } = await supabaseAdmin
      .from('proposals')
      .insert({
        client_id: clientId || null,
        client_name: clientName,
        client_email: clientEmail,
        client_business: clientBusiness || null,
        project_title: projectTitle,
        project_type: projectType,
        understood: understood || null,
        line_items: lineItems || [],
        total: total || 0,
        deposit_pct: parseFloat(depositPct) || 50,
        out_of_scope: outOfScope || null,
        timeline: timeline || null,
        next_steps: nextSteps || null,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    const proposalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/proposals/${proposal.id}`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: 'alante@alantevelez.com',
      subject: `Project Proposal — ${projectTitle}`,
      html: getProposalEmailHtml({ clientName, projectTitle, proposalUrl, message }),
    })

    return NextResponse.json({ success: true, id: proposal.id })
  } catch (err) {
    console.error('Create proposal error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

function getProposalEmailHtml({ clientName, projectTitle, proposalUrl, message }: any) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#FAF3E8;font-family:Georgia,serif}
  .wrap{max-width:600px;margin:0 auto;padding:48px 24px}
  .logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}
  .logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}
  .divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}
  .heading{font-size:32px;font-weight:700;color:#2A2420;line-height:1.1;margin-bottom:20px}
  .heading em{font-style:italic;color:#A96860}
  p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}
  .cta{display:inline-block;background:#A96860;color:#FAF3E8;text-decoration:none;padding:14px 32px;font-family:monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px}
  .note{font-size:13px;color:#8B7D73;margin-top:8px;font-family:monospace}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.15)}
  .footer p{font-size:12px;color:#8B7D73;font-family:monospace;letter-spacing:0.06em}
  .message-box{background:white;border:1px solid rgba(169,104,96,0.2);border-radius:6px;padding:20px 24px;margin-bottom:24px}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Full Stack Web Developer</div>
  <div class="divider"></div>
  <h1 class="heading">Your proposal<br><em>is ready.</em></h1>
  ${message ? `<div class="message-box"><p style="white-space:pre-wrap;margin:0;">${message}</p></div>` : `<p>Hi ${clientName}, your project proposal for <strong>${projectTitle}</strong> is ready for your review.</p>`}
  <p>Click the button below to view your proposal. You can accept or decline directly from the page.</p>
  <div style="margin:36px 0">
    <a href="${proposalUrl}" class="cta">Review Your Proposal</a>
    <p class="note">Takes about 2 minutes to review.</p>
  </div>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body></html>`
}