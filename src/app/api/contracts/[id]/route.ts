import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// GET /api/contracts/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('contracts').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/contracts/[id]/sign
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { signatureImage, signerName } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: contract } = await supabaseAdmin.from('contracts').select('*').eq('id', id).single()
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (contract.status === 'signed') return NextResponse.json({ error: 'Already signed' }, { status: 400 })

    const signedAt = new Date().toISOString()

    await supabaseAdmin.from('contracts').update({
      status: 'signed',
      signature_image: signatureImage,
      signer_name: signerName,
      signed_at: signedAt,
      signer_ip: ip,
    }).eq('id', id)

    const signedDate = new Date(signedAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: 'alante@alantevelez.com',
      subject: `Contract signed — ${contract.client_name}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:40px 24px}h2{color:#2A2420;margin-bottom:12px}.label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.1em;text-transform:uppercase;margin-top:12px;margin-bottom:4px}.value{font-size:14px;color:#2A2420}.next{margin-top:20px;padding:14px 20px;background:#A96860;color:#FAF3E8;font-family:monospace;font-size:12px;border-radius:4px;letter-spacing:0.08em}</style></head>
<body><h2>Contract signed — ${contract.client_name}</h2>
<div class="label">Project</div><div class="value">${contract.project_title}</div>
<div class="label">Signer</div><div class="value">${signerName}</div>
<div class="label">Signed at</div><div class="value">${signedDate}</div>
<div class="label">IP address</div><div class="value">${ip}</div>
<div class="label">Total fee</div><div class="value">$${contract.total_fee.toLocaleString()}</div>
<div class="label">Deposit due</div><div class="value">$${contract.deposit.toLocaleString()}</div>
<div class="next">Send the deposit invoice now to kick off the project</div>
</body></html>`,
    })

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: contract.client_email,
      subject: `Contract signed — ${contract.project_title}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}h1{font-size:32px;font-weight:700;color:#2A2420;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.detail{background:white;border:1px solid rgba(169,104,96,0.2);border-left:3px solid #A96860;padding:20px 24px;border-radius:4px;margin:24px 0}.label{font-family:monospace;font-size:10px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px;margin-top:10px}.label:first-child{margin-top:0}.value{font-size:14px;color:#2A2420}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body><h1>Contract<br><em>signed.</em></h1>
<p>Hi ${contract.client_name}, your contract for <strong>${contract.project_title}</strong> has been signed. Here is a summary for your records.</p>
<div class="detail">
  <div class="label">Project</div><div class="value">${contract.project_title}</div>
  <div class="label">Signed by</div><div class="value">${signerName}</div>
  <div class="label">Signed on</div><div class="value">${signedDate}</div>
  <div class="label">Total fee</div><div class="value">$${contract.total_fee.toLocaleString()}</div>
  <div class="label">Deposit due</div><div class="value">$${contract.deposit.toLocaleString()}</div>
</div>
<p>Your deposit invoice will arrive shortly. Once payment is received the project officially begins.</p>
<div class="footer">alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</div>
</body></html>`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contract sign error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PUT /api/contracts (create)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      proposalId, sowId, clientId, clientName, clientEmail, clientBusiness,
      projectTitle, projectType, startDate, deliveryDate,
      totalFee, deposit, balance, killFeePct, paymentMethod, lineItems,
    } = body

    const { data: contract, error } = await supabaseAdmin.from('contracts').insert({
      proposal_id: proposalId || null,
      sow_id: sowId || null,
      client_id: clientId || null,
      client_name: clientName,
      client_email: clientEmail,
      client_business: clientBusiness || null,
      project_title: projectTitle,
      project_type: projectType,
      start_date: startDate || null,
      delivery_date: deliveryDate || null,
      total_fee: totalFee || 0,
      deposit: deposit || 0,
      balance: balance || 0,
      kill_fee_pct: killFeePct || 25,
      payment_method: paymentMethod || 'Stripe, PayPal, Zelle, or Wise',
      line_items: lineItems || [],
      status: 'pending',
    }).select().single()

    if (error) throw error

    const contractUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/contracts/${contract.id}`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: 'alante@alantevelez.com',
      subject: `Contract ready for signature — ${projectTitle}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}h1{font-size:32px;font-weight:700;color:#2A2420;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.cta{display:inline-block;background:#A96860;color:#FAF3E8;text-decoration:none;padding:14px 32px;font-family:monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px}.note{font-size:13px;color:#8B7D73;margin-top:8px;font-family:monospace}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body><h1>Your contract<br><em>is ready.</em></h1>
<p>Hi ${clientName}, your contract for <strong>${projectTitle}</strong> is ready for your review and signature.</p>
<p>Please review all terms carefully. You will draw your signature directly on the page using your mouse or finger.</p>
<div style="margin:36px 0"><a href="${contractUrl}" class="cta">Review and Sign Contract</a><p class="note">Your electronic signature is legally binding.</p></div>
<div class="footer">alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</div>
</body></html>`,
    })

    return NextResponse.json({ success: true, id: contract.id })
  } catch (err) {
    console.error('Create contract error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}