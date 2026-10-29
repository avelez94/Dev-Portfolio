import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { balanceLabel, contractPaymentClausePdf, contractRevisionsClausePdf, contractServicesClause, contractWarrantyClausePdf, depositLabel, usesCurrentTerms } from '@/lib/terms'
import { Resend } from 'resend'
import jsPDF from 'jspdf'
import { requireAdmin } from '@/lib/admin-auth'
import { BRAND } from '@/lib/brand'
import * as mail from '@/lib/email/templates'
import { contractPdf } from '@/lib/pdf/contract'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
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

    // Contracts issued before the current terms keep their original PDF layout and wording.
    const pdfBase64 = usesCurrentTerms(contract) ? brandedContractPdf(contract, signedDate) : legacyContractPdf(contract, signedDate)

    // Send to client
    const m = mail.signedContractCopy({ clientName: contract.client_name, projectTitle: contract.project_title, signerName: contract.signer_name, signedDate })
    const { error: mailErr } = await resend.emails.send({
      from: BRAND.from,
      to: contract.client_email,
      cc: BRAND.email,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: [{
        filename: `Signed_Contract_${contract.project_title.replace(/\s+/g, '_')}.pdf`,
        content: pdfBase64,
      }]
    })
    if (mailErr) throw mailErr

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send signed contract error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SignedContract = any

/** Original signed contract PDF, unchanged, for contracts issued before the current terms. */
function legacyContractPdf(contract: SignedContract, signedDate: string): string {
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
    if (usesCurrentTerms(contract)) {
      addLine(depositLabel(contract) + ': $' + Number(contract.deposit).toLocaleString())
      addLine(balanceLabel(contract) + ': $' + Number(contract.balance).toLocaleString())
    } else {
      addLine('Deposit (due to begin): $' + Number(contract.deposit).toLocaleString())
      addLine('Balance (paid across milestones): $' + Number(contract.balance).toLocaleString())
    }
    addLine('Payment Method: ' + contract.payment_method)
    addLine('Kill Fee: ' + contract.kill_fee_pct + '% of total if cancelled after work begins')
    addSpace(); addDivider()

    const clauses = [
      ['1. SERVICES', contractServicesClause(contract)],
      ['2. PAYMENT', contractPaymentClausePdf(contract)],
      ['3. KILL FEE', 'If Client cancels after work has begun, a kill fee of ' + contract.kill_fee_pct + '% of the total project fee ($' + Math.round(contract.total_fee * contract.kill_fee_pct / 100).toLocaleString() + ') is due immediately, in addition to payment for all work completed to date.'],
      ['4. INTELLECTUAL PROPERTY', 'Full ownership of all deliverables transfers to Client upon receipt of final payment. Until then, all work remains the property of Alante Velez. Alante Velez retains the right to display completed work in portfolio.'],
      ['5. REVISIONS', contractRevisionsClausePdf(contract)],
      ['6. CLIENT RESPONSIBILITIES', 'Client agrees to provide all required content, assets, and feedback in a timely manner. Delays caused by Client may result in timeline adjustments.'],
      ['7. CONFIDENTIALITY', 'Both parties agree to keep proprietary information confidential during and after the project.'],
      ['8. WARRANTIES', contractWarrantyClausePdf(contract)],
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

    return doc.output('datauristring').split(',')[1]
}

/** Current terms: the shared agreement builder, with the signing page's clause text. */
function brandedContractPdf(contract: SignedContract, signedDate: string): string {
  const doc = contractPdf(contract, {
    signed: { signerName: contract.signer_name, signedDate, ip: contract.signer_ip, signatureImage: contract.signature_image },
  })
  return doc.output('datauristring').split(',')[1]
}
