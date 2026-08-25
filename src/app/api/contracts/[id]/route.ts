import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('contracts').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { signatureImage, signerName } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: contract } = await supabaseAdmin.from('contracts').select('*').eq('id', id).single()
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (contract.status === 'signed') return NextResponse.json({ error: 'Already signed' }, { status: 400 })

    const signedAt = new Date().toISOString()
    const signedDate = new Date(signedAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })

    await supabaseAdmin.from('contracts').update({
      status: 'signed',
      signature_image: signatureImage,
      signer_name: signerName,
      signed_at: signedAt,
      signer_ip: ip,
    }).eq('id', id)

    // Find the pending invoice linked to this contract
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .like('notes', `contract_id:${id}%`)
      .single()

    // Update invoice status to awaiting_deposit and link client if found
    if (invoice) {
      await supabaseAdmin.from('invoices').update({
        status: 'awaiting_deposit',
      }).eq('id', invoice.id)
    }

    // Notify you
    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: 'alante@alantevelez.com',
      subject: `Contract signed — ${contract.client_name}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:40px 24px}h2{color:#2A2420;margin-bottom:16px}.label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.1em;text-transform:uppercase;margin-top:12px;margin-bottom:4px}.value{font-size:14px;color:#2A2420}.next{margin-top:20px;padding:14px 20px;background:#A96860;color:#FAF3E8;font-family:monospace;font-size:12px;border-radius:4px;letter-spacing:0.08em}</style></head>
<body>
<h2>Contract signed — ${contract.client_name}</h2>
<div class="label">Project</div><div class="value">${contract.project_title}</div>
<div class="label">Signed by</div><div class="value">${signerName}</div>
<div class="label">Signed on</div><div class="value">${signedDate}</div>
<div class="label">IP address</div><div class="value">${ip}</div>
<div class="label">Total fee</div><div class="value">$${contract.total_fee.toLocaleString()}</div>
<div class="label">Deposit due</div><div class="value">$${contract.deposit.toLocaleString()}</div>
${invoice ? `<div class="label">Invoice</div><div class="value">${invoice.invoice_number}</div>` : ''}
<div class="next">Deposit invoice sent automatically to client</div>
</body></html>`,
    })

    // Send signed contract confirmation to client
    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: contract.client_email,
      subject: `Contract signed — ${contract.project_title}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}.logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}.logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}.divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}h1{font-size:32px;font-weight:700;color:#2A2420;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.detail{background:white;border:1px solid rgba(169,104,96,0.2);border-left:3px solid #A96860;padding:16px 20px;border-radius:4px;margin:24px 0}.label{font-family:monospace;font-size:10px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px;margin-top:10px}.label:first-child{margin-top:0}.value{font-size:14px;color:#2A2420}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body>
<div class="logo">Alante Velez</div>
<div class="logo-sub">Full Stack Web Developer</div>
<div class="divider"></div>
<h1>Contract<br><em>signed.</em></h1>
<p>Hi ${contract.client_name}, your contract for <strong>${contract.project_title}</strong> has been signed. Here is a summary for your records.</p>
<div class="detail">
  <div class="label">Project</div><div class="value">${contract.project_title}</div>
  <div class="label">Signed by</div><div class="value">${signerName}</div>
  <div class="label">Signed on</div><div class="value">${signedDate}</div>
  <div class="label">Total fee</div><div class="value">$${contract.total_fee.toLocaleString()}</div>
  <div class="label">Deposit due to begin</div><div class="value">$${contract.deposit.toLocaleString()}</div>
  <div class="label">Balance paid across milestones</div><div class="value">$${contract.balance.toLocaleString()}</div>
</div>
<p>Your deposit invoice has been sent separately. Once payment is received the project officially begins. Keep this email for your records.</p>
<div class="footer">alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</div>
</body></html>`,
    })

    // Auto-send deposit invoice if we have the data
    if (invoice) {
      await resend.emails.send({
        from: 'Alante Velez <alante@alantevelez.com>',
        to: contract.client_email,
        cc: 'alante@alantevelez.com',
        subject: `Invoice ${invoice.invoice_number} — ${contract.project_title}`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}.logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}.logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}.divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}h1{font-size:32px;font-weight:700;color:#2A2420;line-height:1.1;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.detail{background:white;border:1px solid rgba(169,104,96,0.2);border-left:3px solid #A96860;padding:20px 24px;border-radius:4px;margin:28px 0}.label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px;margin-top:12px}.label:first-child{margin-top:0}.value{font-size:15px;color:#2A2420}.value.highlight{font-size:18px;font-weight:700;color:#A96860}.payment-label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px}.note{font-size:13px;color:#8B7D73;margin-top:16px}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.15);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body>
<div class="logo">Alante Velez</div>
<div class="logo-sub">Full Stack Web Developer</div>
<div class="divider"></div>
<h1>Invoice<br><em>#${invoice.invoice_number}</em></h1>
<p>Hi ${contract.client_name}, please find your deposit invoice below. Payment is due within 7 days to officially kick off the project.</p>
<div class="detail">
  <div class="label">Service</div>
  <div class="value">${invoice.service_desc || contract.project_title}</div>
  <div class="label">Due date</div>
  <div class="value">${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : 'Within 7 days'}</div>
  <div class="label">Total project fee</div>
  <div class="value">$${Number(invoice.total_fee).toLocaleString()}</div>
  <div class="label">Deposit due now (50%)</div>
  <div class="value highlight">$${Number(invoice.deposit_amount).toLocaleString()}</div>
  <div class="label">Balance paid across milestones</div>
  <div class="value">$${(Number(invoice.total_fee) - Number(invoice.deposit_amount)).toLocaleString()}</div>
</div>
<div class="payment-label">Payment methods</div>
<p>${contract.payment_method}</p>
<p class="note">Reference: Invoice #${invoice.invoice_number} | ${contract.client_name}</p>
<p class="note">Work begins upon receipt of deposit payment.</p>
<div class="footer">alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</div>
</body></html>`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contract sign error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}