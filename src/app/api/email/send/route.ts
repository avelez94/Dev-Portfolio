import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { clientEmail, clientName, subject, message, attachment } = await req.json()

    const formattedMessage = message.replace(/\n/g, '<br/>')

    const emailPayload: any = {
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      subject,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#2C1A0E;font-family:Georgia,sans-serif}
  .wrap{max-width:600px;margin:0 auto;padding:48px 24px}
  .logo{font-family:Georgia,serif;font-size:18px;color:#C4704A;margin-bottom:40px}
  .divider{height:1px;background:rgba(196,112,74,0.2);margin:32px 0}
  p{font-size:15px;line-height:1.85;color:rgba(250,246,240,0.75);margin-bottom:16px}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(196,112,74,0.15)}
  .footer p{font-size:13px;color:rgba(250,246,240,0.3);margin:0}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="divider"></div>
  <p>${formattedMessage}</p>
  <div class="footer">
    <p>Alante Velez &nbsp;·&nbsp; Full Stack Web Developer &nbsp;·&nbsp; alantevelez.com</p>
  </div>
</div>
</body></html>`
    }

    if (attachment) {
      emailPayload.attachments = [{
        filename: attachment.name,
        content: attachment.data,
      }]
    }

    await resend.emails.send(emailPayload)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
