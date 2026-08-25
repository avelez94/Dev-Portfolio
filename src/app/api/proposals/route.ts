import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      clientId, clientName, clientEmail, clientBusiness,
      projectTitle, projectType, understood, lineItems, milestones, total,
      depositPct, outOfScope, timeline, startDate, deliveryDate,
      revisions, hourlyRate, nextSteps, message,
    } = body

    const deposit = total * (parseFloat(depositPct) / 100)
    const balance = total - deposit

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

    // Also store SOW data in the proposal for when client accepts
    if (milestones && milestones.length > 0) {
      await supabaseAdmin.from('sows').insert({
        proposal_id: proposal.id,
        client_name: clientName,
        client_email: clientEmail,
        client_business: clientBusiness || null,
        project_title: projectTitle,
        project_type: projectType,
        understood: understood || null,
        out_of_scope: outOfScope || null,
        line_items: milestones,
        total: total || 0,
        deposit: deposit,
        balance: balance,
        deposit_pct: parseFloat(depositPct) || 50,
        timeline: timeline || null,
        start_date: startDate || null,
        delivery_date: deliveryDate || null,
        revisions: revisions || '2',
        hourly_rate: hourlyRate || 65,
        payment_method: 'Stripe, PayPal, Zelle, or Wise',
        status: 'pending',
      })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com'
    const proposalUrl = `${siteUrl}/proposals/${proposal.id}`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: 'alante@alantevelez.com',
      subject: `Project Proposal — ${projectTitle}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#FAF3E8;font-family:Georgia,serif}
  .wrap{max-width:600px;margin:0 auto;padding:48px 24px}
  .logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}
  .logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}
  .divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}
  p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px;white-space:pre-wrap}
  .cta-wrap{background:white;border:1px solid rgba(169,104,96,0.2);border-radius:8px;padding:28px 24px;text-align:center;margin:32px 0}
  .cta{display:inline-block;background:#A96860;color:#FAF3E8 !important;text-decoration:none;padding:16px 40px;font-family:monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;border-radius:4px;font-weight:500}
  .cta-url{font-family:monospace;font-size:11px;color:#8B7D73;margin-top:12px;word-break:break-all}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.15)}
  .footer p{font-size:12px;color:#8B7D73;font-family:monospace;letter-spacing:0.06em}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Full Stack Web Developer</div>
  <div class="divider"></div>
  <p>${message || `Hi ${clientName}, your project proposal for ${projectTitle} is ready for your review.`}</p>
  <div class="cta-wrap">
    <a href="${proposalUrl}" class="cta">Review Your Proposal</a>
    <p class="cta-url">Or copy this link: ${proposalUrl}</p>
  </div>
  <p style="font-size:13px;color:#8B7D73;white-space:normal;">If the button does not work, copy and paste the link above into your browser.</p>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body></html>`
    })

    return NextResponse.json({ success: true, id: proposal.id })
  } catch (err) {
    console.error('Create proposal error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}