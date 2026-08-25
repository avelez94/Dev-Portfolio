import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      clientName, clientEmail, projectTitle, projectType,
      understood, outOfScope, milestones,
      total, deposit, balance, depositPct,
      startDate, deliveryDate, revisions, hourlyRate, paymentMethod,
    } = body

    const { data: sow, error } = await supabaseAdmin.from('sows').insert({
      client_name: clientName,
      client_email: clientEmail,
      project_title: projectTitle,
      project_type: projectType,
      understood: understood || null,
      deliverables: null,
      out_of_scope: outOfScope || null,
      line_items: milestones || [],
      total: total || 0,
      deposit: deposit || 0,
      balance: balance || 0,
      deposit_pct: depositPct || 50,
      start_date: startDate || null,
      delivery_date: deliveryDate || null,
      revisions: revisions || '2',
      hourly_rate: hourlyRate || 65,
      payment_method: paymentMethod || 'Stripe, PayPal, Zelle, or Wise',
      status: 'pending',
    }).select().single()

    if (error) throw error

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alantevelez.com'
    const sowUrl = `${siteUrl}/sows/${sow.id}`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: 'alante@alantevelez.com',
      subject: `Statement of Work — ${projectTitle}`,
      html: `<!DOCTYPE html>
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
  p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px;font-family:Georgia,serif}
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
  <h1 class="heading">Your Statement<br><em>of Work.</em></h1>
  <p>Hi ${clientName}, your Statement of Work for <strong>${projectTitle}</strong> is ready for your review.</p>
  <p>Please review the full scope, deliverables, milestone schedule, and payment details. You can accept or decline directly from the page.</p>
  <div class="cta-wrap">
    <a href="${sowUrl}" class="cta">Review Statement of Work</a>
    <p class="cta-url">Or copy this link: ${sowUrl}</p>
  </div>
  <p style="font-size:13px;color:#8B7D73;">If the button does not work, copy and paste the link above into your browser.</p>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body></html>`
    })

    return NextResponse.json({ success: true, id: sow.id })
  } catch (err) {
    console.error('Create SOW error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}