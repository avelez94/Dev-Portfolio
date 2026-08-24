import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { clientEmail, clientName, cc, invoiceNumber, invoiceType, totalFee, depositAmount, dueDate, serviceDesc, hours, hourlyRate } = await req.json()

    const isProject = invoiceType === 'project'
    const balance = totalFee - depositAmount

    const paymentSection = isProject
      ? `<div class="detail-label">Total project fee</div>
         <div class="detail-value">$${totalFee.toLocaleString()}</div>
         <div class="detail-label">Deposit due now (50%)</div>
         <div class="detail-value highlight">$${depositAmount.toLocaleString()}</div>
         <div class="detail-label">Balance due on delivery (50%)</div>
         <div class="detail-value">$${balance.toLocaleString()}</div>`
      : `<div class="detail-label">Hours</div>
         <div class="detail-value">${hours}h x $${hourlyRate}/hr</div>
         <div class="detail-label">Total due</div>
         <div class="detail-value highlight">$${totalFee.toLocaleString()}</div>`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: cc || 'alante@alantevelez.com',
      subject: `Invoice #${invoiceNumber} from Alante Velez`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#FAF3E8;font-family:Georgia,serif}
  .wrap{max-width:600px;margin:0 auto;padding:48px 24px}
  .logo{font-family:Georgia,serif;font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}
  .logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}
  .divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}
  .heading{font-family:Georgia,serif;font-size:32px;font-weight:700;color:#2A2420;line-height:1.1;margin-bottom:20px}
  .heading em{font-style:italic;color:#A96860}
  p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px;font-family:Georgia,serif}
  .detail-box{background:#FFFFFF;border:1px solid rgba(169,104,96,0.2);border-left:3px solid #A96860;padding:20px 24px;margin:28px 0;border-radius:4px}
  .detail-label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px;margin-top:12px}
  .detail-label:first-child{margin-top:0}
  .detail-value{font-size:15px;color:#2A2420;margin-bottom:4px;font-family:Georgia,serif}
  .detail-value.highlight{color:#A96860;font-weight:600}
  .payment-label{font-family:monospace;font-size:11px;color:#A96860;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.15)}
  .footer p{font-size:12px;color:#8B7D73;margin:0;font-family:monospace;letter-spacing:0.06em}
  .note{font-size:13px;color:#8B7D73;margin-top:16px}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Full Stack Web Developer</div>
  <div class="divider"></div>
  <h1 class="heading">Invoice<br><em>#${invoiceNumber}</em></h1>
  <p>Hi ${clientName}, please find your invoice details below. Payment is due within 7 days.</p>
  <div class="detail-box">
    <div class="detail-label">Service</div>
    <div class="detail-value">${serviceDesc || 'Web development services'}</div>
    <div class="detail-label">Due date</div>
    <div class="detail-value">${dueDate || 'Upon receipt'}</div>
    ${paymentSection}
  </div>
  <div class="payment-label">Payment methods</div>
  <p>Stripe, PayPal, Zelle, or Wise</p>
  <p class="note">Reference: Invoice #${invoiceNumber} | ${clientName}</p>
  ${isProject ? '<p class="note">Final deliverables will be transferred upon receipt of the balance payment.</p>' : ''}
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body></html>`
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send invoice error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}