import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { clientEmail, clientName, invoiceNumber, invoiceType, totalFee, depositAmount, dueDate, serviceDesc, hours, hourlyRate } = await req.json()

    const isProject = invoiceType === 'project'
    const balance = totalFee - depositAmount

    const paymentSection = isProject
      ? `<div class="detail-label">Total project fee</div>
         <div class="detail-value">$${totalFee.toLocaleString()}</div>
         <div class="detail-label">Deposit due now (50%)</div>
         <div class="detail-value" style="color:#C4704A;font-weight:500;">$${depositAmount.toLocaleString()}</div>
         <div class="detail-label">Balance due on delivery (50%)</div>
         <div class="detail-value">$${balance.toLocaleString()}</div>`
      : `<div class="detail-label">Hours</div>
         <div class="detail-value">${hours}h x $${hourlyRate}/hr</div>
         <div class="detail-label">Total due</div>
         <div class="detail-value" style="color:#C4704A;font-weight:500;">$${totalFee.toLocaleString()}</div>`

    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      subject: `Invoice #${invoiceNumber} from Alante Velez`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#2C1A0E;font-family:Georgia,sans-serif}
  .wrap{max-width:600px;margin:0 auto;padding:48px 24px}
  .logo{font-family:Georgia,serif;font-size:18px;color:#C4704A;margin-bottom:40px}
  .divider{height:1px;background:rgba(196,112,74,0.2);margin:32px 0}
  .heading{font-family:Georgia,serif;font-size:32px;font-weight:700;color:#FAF6F0;line-height:1.1;margin-bottom:20px}
  .heading em{font-style:italic;color:#C4704A}
  p{font-size:15px;line-height:1.75;color:rgba(250,246,240,0.65);margin-bottom:16px}
  .detail-box{background:#3d2a1a;border-left:3px solid #C4704A;padding:20px 24px;margin:28px 0}
  .detail-label{font-family:'Courier New',monospace;font-size:11px;color:#C4704A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px;margin-top:12px}
  .detail-label:first-child{margin-top:0}
  .detail-value{font-size:15px;color:#FAF6F0;margin-bottom:4px}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(196,112,74,0.15)}
  .footer p{font-size:13px;color:rgba(250,246,240,0.3);margin:0}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
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
  <div class="detail-label" style="color:#C4704A;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px">Payment methods</div>
  <p>Stripe, PayPal, Zelle, or Wise</p>
  <p style="font-size:13px;color:rgba(250,246,240,0.4);">Reference: Invoice #${invoiceNumber} | ${clientName}</p>
  ${isProject ? `<p style="font-size:13px;color:rgba(250,246,240,0.4);margin-top:16px;">Final deliverables will be transferred upon receipt of the balance payment.</p>` : ''}
  <div class="footer">
    <p>Alante Velez &nbsp;·&nbsp; Full Stack Web Developer</p>
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