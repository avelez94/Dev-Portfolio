import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { clientEmail, clientName, cc, subject, message, attachment } = await req.json()

    const formattedMessage = message.replace(/\n/g, '<br/>')

    const emailPayload: any = {
      from: 'Alante Velez <alante@alantevelez.com>',
      to: clientEmail,
      cc: cc || 'alante@alantevelez.com',
      subject,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#FAF3E8;font-family:'Georgia',serif}
  .wrap{max-width:600px;margin:0 auto;padding:48px 24px}
  .logo{font-family:Georgia,serif;font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}
  .logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}
  .divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}
  p{font-size:15px;line-height:1.85;color:#3D3630;margin-bottom:16px;font-family:'Georgia',serif}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.15)}
  .footer p{font-size:12px;color:#8B7D73;margin:0;font-family:monospace;letter-spacing:0.06em}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Alante Velez</div>
  <div class="logo-sub">Full Stack Web Developer</div>
  <div class="divider"></div>
  <p>${formattedMessage}</p>
  <div class="footer">
    <p>alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</p>
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