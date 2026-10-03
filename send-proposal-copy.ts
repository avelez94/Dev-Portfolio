import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const PROPOSAL_ID = '71cd20ba-54e2-4123-9e16-721806ee369d'

async function main() {
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', PROPOSAL_ID)
    .single()

  if (error || !proposal) {
    console.error('Proposal not found:', error)
    process.exit(1)
  }

  const { data: sow } = await supabase
    .from('sows')
    .select('line_items, start_date, delivery_date, revisions, hourly_rate, payment_method')
    .eq('proposal_id', PROPOSAL_ID)
    .single()

  const lineItems: { description: string; price: string }[] = proposal.line_items || []
  const milestones: { name: string; fee: string; dueDate: string; deliverables: string }[] = sow?.line_items || []

  const lineItemRows = lineItems.map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid rgba(169,104,96,0.12);font-size:14px;color:#2A2420;">${item.description}</td>
      <td style="padding:12px 0;border-bottom:1px solid rgba(169,104,96,0.12);font-size:14px;color:#2A2420;text-align:right;">$${Number(item.price).toLocaleString()}</td>
    </tr>`).join('')

  const milestoneRows = milestones.map(m => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid rgba(169,104,96,0.12);font-size:14px;color:#2A2420;vertical-align:top;">
        <strong>${m.name}</strong><br>
        <span style="color:#6B6056;font-size:13px;line-height:1.6;">${m.deliverables}</span><br>
        <span style="color:#A96860;font-size:12px;font-family:monospace;">Due: ${m.dueDate}</span>
      </td>
      <td style="padding:16px 0;border-bottom:1px solid rgba(169,104,96,0.12);font-size:14px;color:#2A2420;text-align:right;vertical-align:top;">$${Number(m.fee).toLocaleString()}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FAF3E8;font-family:Georgia,serif}.wrap{max-width:600px;margin:0 auto;padding:48px 24px}.logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}.logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:32px}.divider{height:1px;background:rgba(169,104,96,0.2);margin:28px 0}.section-label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;margin-top:24px}.value{font-size:14px;color:#2A2420;line-height:1.7}table{width:100%;border-collapse:collapse;margin-top:8px}.total-row td{padding:14px 0;font-size:15px;font-weight:700;color:#2A2420;border-top:2px solid rgba(169,104,96,0.3)}.scope-box{background:#fff8f0;border:1px solid rgba(169,104,96,0.2);padding:16px;margin-top:8px;font-size:13px;color:#3D3630;line-height:1.7}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.15)}.footer p{font-size:12px;color:#8B7D73;font-family:monospace;letter-spacing:0.06em}</style>
</head><body><div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Proposal — Accepted Copy</div>
  <div class="divider"></div>

  <div class="section-label">Client</div>
  <div class="value">${proposal.client_name}<br>${proposal.client_email}<br>${proposal.client_business}</div>

  <div class="section-label">Project</div>
  <div class="value">${proposal.project_title} · ${proposal.project_type}</div>

  <div class="section-label">Project Understanding</div>
  <div class="value">${proposal.understood}</div>

  <div class="section-label">Scope of Work</div>
  <table>
    ${lineItemRows}
    <tr class="total-row">
      <td>Total</td>
      <td style="text-align:right;">$${Number(proposal.total).toLocaleString()}</td>
    </tr>
  </table>

  <div class="section-label">Deposit (${proposal.deposit_pct}%)</div>
  <div class="value">$${(proposal.total * proposal.deposit_pct / 100).toLocaleString()} due at project start</div>

  <div class="section-label">Milestone Schedule</div>
  <table>${milestoneRows}</table>

  <div class="section-label">Timeline</div>
  <div class="value">${proposal.timeline}${sow?.start_date ? `<br>Start: ${sow.start_date}` : ''}${sow?.delivery_date ? ` · Delivery: ${sow.delivery_date}` : ''}</div>

  <div class="section-label">Out of Scope</div>
  <div class="scope-box">${proposal.out_of_scope}</div>

  <div class="section-label">Revisions Included</div>
  <div class="value">${sow?.revisions || 2} · Additional work billed at $${sow?.hourly_rate || 65}/hr</div>

  <div class="section-label">Payment</div>
  <div class="value">${sow?.payment_method || proposal.payment_method || 'Zelle, PayPal, or Wise'}</div>

  <div class="section-label">Next Steps</div>
  <div class="value">${proposal.next_steps}</div>

  <div class="section-label">Accepted</div>
  <div class="value">${new Date(proposal.responded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>

  <div class="footer"><p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p></div>
</div></body></html>`

  const result = await resend.emails.send({
    from: 'Alante Velez <alante@alantevelez.com>',
    to: 'alante@alantevelez.com',
    subject: `Proposal copy — ${proposal.project_title}`,
    html,
  })

  console.log('Sent:', result)
}

main()