import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// GET /api/sows/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('sows').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/sows/[id]/respond
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { action, declineReason } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: sow } = await supabaseAdmin.from('sows').select('*').eq('id', id).single()
    if (!sow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (sow.status !== 'pending') return NextResponse.json({ error: 'Already responded' }, { status: 400 })

    await supabaseAdmin.from('sows').update({
      status: action,
      responded_at: new Date().toISOString(),
      response_ip: ip,
      decline_reason: declineReason || null,
    }).eq('id', id)

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: 'alante@alantevelez.com',
      subject: `SOW ${action} — ${sow.client_name}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:40px 24px}h2{color:#2A2420;margin-bottom:12px}.label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.1em;text-transform:uppercase;margin-top:12px;margin-bottom:4px}.value{font-size:14px;color:#2A2420}</style></head>
<body><h2>SOW ${action} — ${sow.client_name}</h2>
<div class="label">Project</div><div class="value">${sow.project_title}</div>
<div class="label">Total</div><div class="value">$${sow.total.toLocaleString()}</div>
${declineReason ? `<div class="label">Decline reason</div><div class="value">${declineReason}</div>` : ''}
${action === 'accepted' ? '<p style="margin-top:20px;padding:14px 20px;background:#A96860;color:#FAF3E8;font-family:monospace;font-size:12px;border-radius:4px;">Send the contract next</p>' : ''}
</body></html>`,
    })

    if (action === 'accepted') {
      await resend.emails.send({
        from: 'Alante Velez <alante@alantevelez.com>',
        to: sow.client_email,
        subject: `Statement of Work accepted — ${sow.project_title}`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}h1{font-size:32px;font-weight:700;color:#2A2420;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body><h1>SOW<br><em>accepted.</em></h1>
<p>Hi ${sow.client_name}, thank you for accepting the Statement of Work for <strong>${sow.project_title}</strong>.</p>
<p>Your contract will arrive shortly for your review and signature. Once signed, your deposit invoice will follow to officially kick off the project.</p>
<div class="footer">alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</div>
</body></html>`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('SOW respond error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST /api/sows (create)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      proposalId, clientId, clientName, clientEmail, clientBusiness,
      projectTitle, projectType, understood, deliverables, outOfScope,
      lineItems, total, deposit, balance, depositPct,
      timeline, startDate, deliveryDate, revisions, hourlyRate, paymentMethod,
    } = body

    const { data: sow, error } = await supabaseAdmin.from('sows').insert({
      proposal_id: proposalId || null,
      client_id: clientId || null,
      client_name: clientName,
      client_email: clientEmail,
      client_business: clientBusiness || null,
      project_title: projectTitle,
      project_type: projectType,
      understood: understood || null,
      deliverables: deliverables || null,
      out_of_scope: outOfScope || null,
      line_items: lineItems || [],
      total: total || 0,
      deposit: deposit || 0,
      balance: balance || 0,
      deposit_pct: depositPct || 50,
      timeline: timeline || null,
      start_date: startDate || null,
      delivery_date: deliveryDate || null,
      revisions: revisions || '2',
      hourly_rate: hourlyRate || 65,
      payment_method: paymentMethod || 'Stripe, PayPal, Zelle, or Wise',
      status: 'pending',
    }).select().single()

    if (error) throw error

    const sowUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/sows/${sow.id}`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: 'alante@alantevelez.com',
      subject: `Statement of Work — ${projectTitle}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}h1{font-size:32px;font-weight:700;color:#2A2420;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.cta{display:inline-block;background:#A96860;color:#FAF3E8;text-decoration:none;padding:14px 32px;font-family:monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px}.note{font-size:13px;color:#8B7D73;margin-top:8px;font-family:monospace}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body><h1>Your Statement<br><em>of Work.</em></h1>
<p>Hi ${clientName}, your Statement of Work for <strong>${projectTitle}</strong> is ready for your review.</p>
<p>Please review the full scope, deliverables, timeline, and payment details. You can accept or decline directly from the page.</p>
<div style="margin:36px 0"><a href="${sowUrl}" class="cta">Review Statement of Work</a><p class="note">Takes about 3 minutes to review.</p></div>
<div class="footer">alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</div>
</body></html>`,
    })

    return NextResponse.json({ success: true, id: sow.id })
  } catch (err) {
    console.error('Create SOW error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}