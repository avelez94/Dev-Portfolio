import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const {
      clientEmail, clientName, clientBusiness, projectTitle, projectType,
      understood, lineItems, total, outOfScope, depositPct,
      timeline, nextSteps, message, cc
    } = await req.json()

    const deposit = total * (parseFloat(depositPct) / 100)
    const balance = total - deposit

    const lineItemsHtml = lineItems && lineItems.length > 0
      ? lineItems.map((item: { description: string; price: string }) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(169,104,96,0.1);">
          <div style="font-size:14px;color:#2A2420;font-family:Georgia,serif;">${item.description}</div>
          <div style="font-size:14px;color:#2A2420;font-weight:600;font-family:Georgia,serif;white-space:nowrap;margin-left:16px;">$${parseFloat(item.price).toLocaleString()}</div>
        </div>`).join('')
      : ''

    const html = `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#2A2420;background:#FAF3E8;padding:40px 32px;border-radius:8px;">
        <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;margin-bottom:4px;color:#2A2420;">Alante Velez</div>
        <div style="font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:32px;">Full Stack Web Developer</div>
        <div style="height:1px;background:rgba(169,104,96,0.2);margin-bottom:32px;"></div>

        ${message ? `
        <div style="background:white;border-radius:8px;padding:20px 24px;margin-bottom:24px;border:1px solid rgba(169,104,96,0.2);">
          <div style="font-size:15px;line-height:1.75;color:#3D3630;white-space:pre-wrap;font-family:Georgia,serif;">${message}</div>
        </div>` : ''}

        <div style="background:white;border-radius:8px;padding:24px;margin-bottom:16px;border:1px solid rgba(169,104,96,0.2);">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A96860;margin-bottom:4px;font-family:monospace;">Prepared for</div>
          <div style="font-size:16px;font-weight:700;color:#2A2420;font-family:Georgia,serif;">${clientName}</div>
          ${clientBusiness ? `<div style="font-size:13px;color:#8B7D73;margin-top:2px;font-family:monospace;">${clientBusiness}</div>` : ''}
        </div>

        <div style="background:white;border-radius:8px;padding:24px;margin-bottom:16px;border:1px solid rgba(169,104,96,0.2);">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A96860;margin-bottom:8px;font-family:monospace;">Project</div>
          <div style="font-size:16px;font-weight:700;color:#2A2420;font-family:Georgia,serif;">${projectTitle}</div>
          <div style="font-size:12px;color:#8B7D73;margin-top:2px;font-family:monospace;">${projectType}</div>
        </div>

        ${understood ? `
        <div style="background:white;border-radius:8px;padding:24px;margin-bottom:16px;border:1px solid rgba(169,104,96,0.2);">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A96860;margin-bottom:8px;font-family:monospace;">What I understood</div>
          <div style="font-size:14px;line-height:1.7;color:#3D3630;white-space:pre-wrap;font-family:Georgia,serif;">${understood}</div>
        </div>` : ''}

        ${lineItemsHtml ? `
        <div style="background:white;border-radius:8px;padding:24px;margin-bottom:16px;border:1px solid rgba(169,104,96,0.2);">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A96860;margin-bottom:12px;font-family:monospace;">Investment breakdown</div>
          ${lineItemsHtml}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0 4px;margin-top:4px;">
            <div style="font-size:14px;font-weight:700;color:#2A2420;font-family:Georgia,serif;">Total</div>
            <div style="font-size:20px;font-weight:700;color:#A96860;font-family:Georgia,serif;">$${total.toLocaleString()}</div>
          </div>
          <div style="height:1px;background:rgba(169,104,96,0.2);margin:12px 0;"></div>
          <div style="font-size:12px;color:#8B7D73;line-height:1.6;font-family:monospace;">
            Deposit (${depositPct}% due to begin): <strong style="color:#2A2420;">$${deposit.toLocaleString()}</strong><br/>
            Balance due on delivery: <strong style="color:#2A2420;">$${balance.toLocaleString()}</strong><br/>
            Change orders and additional revisions billed at $65/hr.
          </div>
        </div>` : ''}

        ${outOfScope ? `
        <div style="background:white;border-radius:8px;padding:24px;margin-bottom:16px;border:1px solid rgba(169,104,96,0.2);">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A96860;margin-bottom:8px;font-family:monospace;">What is not included</div>
          <div style="font-size:14px;line-height:1.7;color:#3D3630;white-space:pre-wrap;font-family:Georgia,serif;">${outOfScope}</div>
        </div>` : ''}

        ${timeline ? `
        <div style="background:white;border-radius:8px;padding:24px;margin-bottom:16px;border:1px solid rgba(169,104,96,0.2);">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A96860;margin-bottom:8px;font-family:monospace;">Timeline</div>
          <div style="font-size:14px;color:#3D3630;font-family:Georgia,serif;">${timeline}</div>
        </div>` : ''}

        ${nextSteps ? `
        <div style="background:#A96860;border-radius:8px;padding:24px;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(250,243,232,0.7);margin-bottom:8px;font-family:monospace;">Next steps</div>
          <div style="font-size:14px;color:#FAF3E8;line-height:1.7;font-family:Georgia,serif;">${nextSteps}</div>
        </div>` : ''}

        <div style="font-size:11px;color:#8B7D73;margin-top:32px;padding-top:20px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;">
          Alante Velez &nbsp;·&nbsp; alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com
        </div>
      </div>
    `

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: cc || 'alante@alantevelez.com',
      subject: `Project Proposal — ${projectTitle}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Proposal send error:', error)
    return NextResponse.json({ error: 'Failed to send proposal' }, { status: 500 })
  }
}