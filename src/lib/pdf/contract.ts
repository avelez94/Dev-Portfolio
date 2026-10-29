/**
 * Branded PDF of the freelance agreement for documents on the current terms.
 * The same builder makes the admin download (unsigned) and the signed copy
 * emailed after signing, and both use the clause text from the signing page.
 * Works in the browser and on the server.
 */
import { balanceLabel, depositLabel } from '@/lib/terms'
import { contractClauses, killFeeAmount, type ContractDoc } from '@/lib/contract-document'
import { createBrandedPdf } from '@/lib/pdf/writer'

type Signed = { signerName: string; signedDate: string; ip?: string | null; signatureImage?: string | null }

const money = (n: number) => '$' + Number(n || 0).toLocaleString('en-US')
const longDate = (d?: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

export function contractPdf(contract: ContractDoc, opts: { signed?: Signed; preparedDate?: string } = {}) {
  const { signed } = opts
  const pdf = createBrandedPdf({
    docType: signed ? 'Signed agreement' : 'Agreement',
    title: 'Freelance Web Development Agreement',
    subtitle: signed
      ? `${contract.project_title}  •  Signed ${signed.signedDate}`
      : `${contract.project_title}  •  Prepared ${opts.preparedDate ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
  })

  pdf.heading('Parties')
  pdf.rows([
    ['Freelancer', 'Alante Velez'],
    ['Client', contract.client_name + (contract.client_business ? ' (' + contract.client_business + ')' : '')],
    ['Client email', contract.client_email],
  ])

  pdf.heading('Project')
  pdf.rows([
    ['Title', contract.project_title],
    ['Type', contract.project_type],
    ...(contract.start_date ? ([['Start date', longDate(contract.start_date)]] as [string, string][]) : []),
    ...(contract.delivery_date ? ([['Estimated delivery', longDate(contract.delivery_date)]] as [string, string][]) : []),
  ])

  pdf.heading('Payment schedule')
  pdf.amounts(
    [
      [depositLabel(contract), money(contract.deposit)],
      [balanceLabel(contract), money(contract.balance)],
    ],
    ['Total project fee', money(contract.total_fee)]
  )
  pdf.rows([
    ['Payment method', contract.payment_method],
    ['Kill fee if cancelled', `${contract.kill_fee_pct}% (${money(killFeeAmount(contract))})`],
    ...(contract.terms_version ? ([['Terms version', contract.terms_version]] as [string, string][]) : []),
  ])

  pdf.heading('Terms and conditions')
  contractClauses(contract).forEach(([title, body]) => pdf.clause(title, body))

  // Keep the heading, signature lines, and signature image together on one page.
  pdf.ensure(signed?.signatureImage ? 110 : 80)
  pdf.heading('Signatures')
  if (signed) {
    pdf.rows([
      ['Freelancer', 'Alante Velez'],
      ['Date', signed.signedDate],
      ['Client', signed.signerName],
      ['Date', signed.signedDate],
      ...(signed.ip ? ([['IP address', signed.ip]] as [string, string][]) : []),
    ])
    pdf.text('Electronically signed under the ESIGN Act. This electronic signature is legally binding.', { size: 9, color: 'muted' })
    if (signed.signatureImage && signed.signatureImage.startsWith('data:image')) {
      pdf.ensure(40)
      pdf.text('Client signature', { size: 9.5, bold: true, color: 'ink', gap: 1 })
      try {
        pdf.doc.addImage(signed.signatureImage, 'PNG', 20, pdf.y, 80, 25)
        pdf.space(30)
      } catch {}
    }
  } else {
    pdf.rows([
      ['Freelancer', 'Alante Velez'],
      ['Signature', '______________________________'],
      ['Date', '________________'],
      ['Client', contract.client_name],
      ['Signature', '______________________________'],
      ['Date', '________________'],
    ])
    pdf.text('Clients review and sign this agreement online at the link sent by email.', { size: 9, color: 'muted' })
  }
  pdf.finish()
  return pdf.doc
}
