import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import jsPDF from 'jspdf'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { contractId } = await req.json()

    const { data: contract, error } = await supabaseAdmin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (error || !contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    if (contract.status !== 'signed') return NextResponse.json({ error: 'Contract not yet signed' }, { status: 400 })

    const signedDate = new Date(contract.signed_at).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })

    // Generate PDF
    const doc = new jsPDF()
    const lm = 20, rm = 190, lineH = 7
    let y = 20

    const addLine = (text: string, size = 11, bold = false, accent = false) => {
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      accent ? doc.setTextColor(169, 104, 96) : doc.setTextColor(42, 36, 32)
      const lines = doc.splitTextToSize(text, rm - lm)
      lines.forEach((line: string) => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(line, lm, y); y += lineH
      })
    }
    const addSpace = (n = 1) => { y += lineH * n }
    const addDivider = () => {
      doc.setDrawColor(169, 104, 96); doc.setLineWidth(0.3)
      doc.line(lm, y, rm, y); y += lineH
    }

    addLine('FREELANCE WEB DEVELOPMENT AGREEMENT', 14, true, true)
    addLine('Alante Velez | Full Stack Web Developer', 10)
    addLine('alante@alantevelez.com | alantevelez.com', 10)
    addDivider(); addSpace(0.5)

    addLine('PARTIES', 10, true, true); addSpace(0.5)
    addLine('Freelancer: Alante Velez')
    addLine('Client: ' + contract.client_name + (contract.client_business ? ' (' + contract.client_business + ')' : ''))
    addLine('Client Email: ' + contract.client_email)
    addSpace(); addDivider()

    addLine('PROJECT', 10, true, true); addSpace(0.5)
    addLine('Title: ' + contract.project_title)
    addLine('Type: ' + contract.project_type)
    if (contract.start_date) addLine('Start Date: ' + contract.start_date)
    if (contract.delivery_date) addLine('Estimated Delivery: ' + contract.delivery_date)
    addSpace(); addDivider()

    addLine('PAYMENT', 10, true, true); addSpace(0.5)
    addLine('Total Fee: $' + Number(contract.total_fee).toLocaleString())
    addLine('Deposit (due to begin): $' + Number(contract.deposit).toLocaleString())
    addLine('Balance (paid across milestones): $' + Number(contract.balance).toLocaleString())
    addLine('Payment Method: ' + contract.payment_method)
    addLine('Kill Fee: ' + contract.kill_fee_pct + '% of total if cancelled after work begins')
    addSpace(); addDivider()

    const clauses = [
      ['1. SERVICES', 'Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires written approval and will be billed at $65/hr.'],
      ['2. PAYMENT', 'Total fee: $' + Number(contract.total_fee).toLocaleString() + '. Deposit of $' + Number(contract.deposit).toLocaleString() + ' is due before work begins. Remaining balance of $' + Number(contract.balance).toLocaleString() + ' is paid across project milestones. Late payments accrue 1.5% interest per month after 14 days.'],
      ['3. KILL FEE', 'If Client cancels after work has begun, a kill fee of ' + contract.kill_fee_pct + '% of the total project fee ($' + Math.round(contract.total_fee * contract.kill_fee_pct / 100).toLocaleString() + ') is due immediately, in addition to payment for all work completed to date.'],
      ['4. INTELLECTUAL PROPERTY', 'Full ownership of all deliverables transfers to Client upon receipt of final payment. Until then, all work remains the property of Alante Velez. Alante Velez retains the right to display completed work in portfolio.'],
      ['5. REVISIONS', 'Project includes 2 rounds of revisions. One revision round equals one consolidated list of feedback. Additional revisions are billed at $65/hr.'],
      ['6. CLIENT RESPONSIBILITIES', 'Client agrees to provide all required content, assets, and feedback in a timely manner. Delays caused by Client may result in timeline adjustments.'],
      ['7. CONFIDENTIALITY', 'Both parties agree to keep proprietary information confidential during and after the project.'],
      ['8. WARRANTIES', 'Work will be original, free of known defects for 30 days following final delivery.'],
      ['9. LIMITATION OF LIABILITY', 'Alante Velez liability is limited to the total amount paid by Client.'],
      ['10. DISPUTE RESOLUTION', 'Disputes will be resolved through informal negotiation first, then binding arbitration in the State of Maryland.'],
      ['11. GOVERNING LAW', 'This agreement is governed by the laws of the State of Maryland.'],
      ['12. ENTIRE AGREEMENT', 'This contract, together with the accepted Proposal and Statement of Work, constitutes the entire agreement between the parties.'],
    ]

    addLine('TERMS AND CONDITIONS', 10, true, true); addSpace(0.5)
    clauses.forEach(([title, body]) => {
      addLine(title, 10, true, true); addSpace(0.3)
      addLine(body, 10); addSpace(0.5)
    })
    addDivider()

    addLine('SIGNATURES', 10, true, true); addSpace()
    addLine('Freelancer: Alante Velez')
    addLine('Date: ' + signedDate)
    addSpace()
    addLine('Client: ' + contract.signer_name)
    addLine('Date: ' + signedDate)
    addLine('IP Address: ' + contract.signer_ip)
    addSpace(0.5)
    addLine('Electronically signed under the ESIGN Act. This electronic signature is legally binding.', 9)

    // Add signature image if available
    if (contract.signature_image && contract.signature_image.startsWith('data:image')) {
      if (y > 230) { doc.addPage(); y = 20 }
      addSpace(0.5)
      addLine('Client Signature:', 10, true)
      addSpace(0.3)
      try {
        doc.addImage(contract.signature_image, 'PNG', lm, y, 80, 25)
        y += 30
      } catch (e) {}
    }

    const pdfBase64 = doc.output('datauristring').split(',')[1]

    // Send to client
    await resend.emails.send({
      from: 'Alante Velez <alante@alantevelez.com>',
      to: contract.client_email,
      cc: 'alante@alantevelez.com',
      subject: `Signed Contract — ${contract.project_title}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#FAF3E8;font-family:Georgia,serif;padding:48px 24px}.logo{font-size:18px;font-weight:700;color:#2A2420;margin-bottom:4px}.logo-sub{font-family:monospace;font-size:11px;color:#8B7D73;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px}.divider{height:1px;background:rgba(169,104,96,0.2);margin:32px 0}h1{font-size:32px;font-weight:700;color:#2A2420;margin-bottom:20px}h1 em{font-style:italic;color:#A96860}p{font-size:15px;line-height:1.75;color:#3D3630;margin-bottom:16px}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(169,104,96,0.2);font-family:monospace;font-size:12px;color:#8B7D73}</style></head>
<body>
<div class="logo">Alante Velez</div>
<div class="logo-sub">Full Stack Web Developer</div>
<div class="divider"></div>
<h1>Signed contract<br><em>attached.</em></h1>
<p>Hi ${contract.client_name}, please find your signed contract for <strong>${contract.project_title}</strong> attached to this email. Keep this for your records.</p>
<p>Signed by: ${contract.signer_name}<br>Date: ${signedDate}</p>
<div class="footer">alante@alantevelez.com &nbsp;·&nbsp; alantevelez.com</div>
</body></html>`,
      attachments: [{
        filename: `Signed_Contract_${contract.project_title.replace(/\s+/g, '_')}.pdf`,
        content: pdfBase64,
      }]
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send signed contract error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}