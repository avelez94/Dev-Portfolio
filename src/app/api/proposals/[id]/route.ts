import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Fetch linked SOW milestones
  const { data: sow } = await supabaseAdmin.from('sows').select('line_items').eq('proposal_id', id).single()
  return NextResponse.json({ ...data, milestones: sow?.line_items || [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { action, declineReason } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: proposal } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single()
    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (proposal.status !== 'pending') return NextResponse.json({ error: 'Already responded' }, { status: 400 })

    await supabaseAdmin.from('proposals').update({
      status: action,
      responded_at: new Date().toISOString(),
      response_ip: ip,
      decline_reason: declineReason || null,
    }).eq('id', id)

    if (action === 'accepted') {
      await resend.emails.send({
        from: 'Alante Velez <alante@alantevelez.com>',
        to: 'alante@alantevelez.com',
        subject: `Proposal accepted — ${proposal.client_name}`,
        html: getAdminNotifHtml({ proposal, action: 'accepted' }),
      })
      await resend.emails.send({
        from: 'Alante Velez <alante@alantevelez.com>',
        to: proposal.client_email,
        subject: `Proposal accepted — next steps for ${proposal.project_title}`,
        html: getClientConfirmHtml({ proposal, action: 'accepted' }),
      })
    } else {
      await resend.emails.send({
        from: 'Alante Velez <alante@alantevelez.com>',
        to: 'alante@alantevelez.com',
        subject: `Proposal declined — ${proposal.client_name}`,
        html: getAdminNotifHtml({ proposal, action: 'declined', declineReason }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Proposal respond error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

function getAdminNotifHtml({ proposal, action, declineReason }: any) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FAF3E8;font-family:Georgia,serif}.wrap{max-width:600px;margin:0 auto;padding:40px 24px}.logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}.logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:28px}.divider{height:1px;background:rgba(169,104,96,0.2);margin:24px 0}.heading{font-size:22px;font-weight:700;color:#2A2420;margin-bottom:4px}.label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px;margin-top:12px}.value{font-size:14px;color:#2A2420;line-height:1.6;margin-bottom:4px}.footer{margin-top:40px;padding-top:20px;border-top:1px solid rgba(169,104,96,0.15)}.footer p{font-size:12px;color:#8B7D73;font-family:monospace}</style>
</head><body><div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Admin Notification</div>
  <div class="divider"></div>
  <p class="heading">Proposal ${action} — ${proposal.client_name}</p>
  <div class="label">Client</div><div class="value">${proposal.client_name} · ${proposal.client_email}</div>
  <div class="label">Project</div><div class="value">${proposal.project_title}</div>
  <div class="label">Total</div><div class="value">$${proposal.total.toLocaleString()}</div>
  ${declineReason ? `<div class="label">Decline reason</div><div class="value">${declineReason}</div>` : ''}
  ${action === 'accepted' ? '<div style="margin-top:20px;padding:14px 20px;background:#A96860;border-radius:6px;color:#FAF3E8;font-family:monospace;font-size:12px;letter-spacing:0.08em;">Send the contract next</div>' : ''}
  <div class="footer"><p>alante@alantevelez.com · alantevelez.com</p></div>
</div></body></html>`
}

function getClientConfirmHtml({ proposal, action }: any) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FAF3E8;font-family:Georgia,serif}.wrap{max-width:600px;margin:0 auto;padding:48px 24px}.logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}.logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}.divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}.heading{font-size:32px;font-weight:700;color:#2A2420;line-height:1.1;margin-bottom:20px}.heading em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.15)}.footer p{font-size:12px;color:#8B7D73;font-family:monospace;letter-spacing:0.06em}</style>
</head><body><div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Full Stack Web Developer</div>
  <div class="divider"></div>
  <h1 class="heading">Proposal<br><em>accepted.</em></h1>
  <p>Hi ${proposal.client_name}, thank you for accepting the proposal for <strong>${proposal.project_title}</strong>.</p>
  <p>Your contract will arrive shortly for your review and signature. Once signed, your deposit invoice will follow to officially kick off the project.</p>
  <div class="footer"><p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p></div>
</div></body></html>`
}