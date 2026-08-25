import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('sows').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

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
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:40px 24px}h2{color:#2A2420;margin-bottom:12px}.label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.1em;text-transform:uppercase;margin-top:12px;margin-bottom:4px}.value{font-size:14px;color:#2A2420}.next{margin-top:20px;padding:14px 20px;background:#A96860;color:#FAF3E8;font-family:monospace;font-size:12px;border-radius:4px;letter-spacing:0.08em}</style></head>
<body>
<h2>SOW ${action} — ${sow.client_name}</h2>
<div class="label">Project</div><div class="value">${sow.project_title}</div>
<div class="label">Total</div><div class="value">$${sow.total.toLocaleString()}</div>
${declineReason ? `<div class="label">Decline reason</div><div class="value">${declineReason}</div>` : ''}
${action === 'accepted' ? '<div class="next">Send the contract next</div>' : ''}
</body></html>`,
    })

    if (action === 'accepted') {
      await resend.emails.send({
        from: 'Alante Velez <alante@alantevelez.com>',
        to: sow.client_email,
        subject: `Statement of Work accepted — ${sow.project_title}`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}.logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}.logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}.divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}h1{font-size:32px;font-weight:700;color:#2A2420;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body>
<div class="logo">Alante Velez</div>
<div class="logo-sub">Full Stack Web Developer</div>
<div class="divider"></div>
<h1>SOW<br><em>accepted.</em></h1>
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