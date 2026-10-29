/**
 * Client facing monthly health report PDF, in the light brand. Built only from
 * a frozen snapshot, so the approved PDF matches the approved content exactly.
 * Copy rule: no dashes in client facing text.
 */
import { createBrandedPdf } from '@/lib/pdf/writer'
import { getObject, EVIDENCE_BUCKET } from './db'
import { STATUS_LABEL, type Snapshot } from './report'

const bullet = (t: string) => `•  ${t}`

export async function reportPdf(s: Snapshot): Promise<Buffer> {
  const pdf = createBrandedPdf({
    docType: 'Website Care',
    title: 'Monthly health report',
    subtitle: `${s.site.label}  •  ${s.period.label}`,
  })
  const minutes = s.plan.includedMinutes
  pdf.rows([
    ['Prepared for', [s.recipient.name, s.client.business].filter(Boolean).join(', ') || s.client.name],
    ['Website', s.site.url],
    ['Plan', minutes ? `${s.plan.name}, includes ${minutes} minutes a month for updates or troubleshooting. Checks and this report don’t use that time.` : `${s.plan.name}. Requested changes and fixes are quoted separately.`],
    ['Service period', `${s.period.start} to ${s.period.end}`],
    ['Automated checks run', s.review_date || 'Not run'],
  ], { labelWidth: 44 })

  pdf.heading('Summary')
  pdf.text(s.summary)

  pdf.heading('1. What was checked')
  if (s.sections.checked.length) s.sections.checked.forEach((l) => pdf.text(bullet(l), { gap: 1 }))
  else pdf.text('No checks were completed this month.')
  pdf.space(2)
  pdf.text(`Pages in scope: ${s.scope.pages.map((p: { label: string }) => p.label).join(', ') || 'Home page'}`, { size: 9.5, color: 'muted' })
  if (s.scope.destinations.length) pdf.text(`Destinations opened: ${s.scope.destinations.map((d: { label: string }) => d.label).join(', ')}`, { size: 9.5, color: 'muted' })

  pdf.heading('2. What needs attention')
  if (!s.sections.attention.length && !s.sections.outstanding) pdf.text('Nothing from this month’s checks needs attention.')
  for (const a of s.sections.attention) {
    pdf.ensure(24)
    pdf.text(`${a.label}${a.viewport ? ` (${a.viewport})` : ''}: ${STATUS_LABEL[a.status] || a.status}`, { bold: true, color: 'ink', gap: 1 })
    if (a.url) pdf.text(a.url, { size: 9, color: 'muted', gap: 1 })
    pdf.text(`What I saw: ${a.observed}`, { size: 10, gap: 1 })
    if (a.explanation) pdf.text(`What it means: ${a.explanation}`, { size: 10, gap: 1 })
    if (a.possible_cause) pdf.text(`Possible cause (not confirmed): ${a.possible_cause}`, { size: 10, gap: 1 })
    if (a.next_action) pdf.text(`Suggested next step: ${a.next_action}`, { size: 10, gap: 1 })
    pdf.space(3)
  }
  if (s.sections.outstanding) {
    pdf.text('Still open', { bold: true, color: 'ink', gap: 1 })
    pdf.text(s.sections.outstanding)
  }

  pdf.heading('3. What I fixed')
  pdf.text(s.sections.fixed || 'No fixes were made this month.')

  pdf.heading('4. Needs your approval or more work')
  pdf.text(s.sections.needs_approval || 'Nothing needs your approval right now.')
  if (s.sections.estimate) pdf.text(`Estimate: ${s.sections.estimate}. Nothing here starts until you approve it.`, { bold: true, color: 'ink' })

  if (s.could_not_check.length) {
    pdf.heading('Could not check')
    for (const c of s.could_not_check) pdf.text(bullet(`${c.label}${c.url ? ` (${c.url})` : ''}: ${c.why || 'No reason recorded.'}`), { gap: 1 })
  }

  if (s.comparison) {
    pdf.heading(`Compared with ${s.comparison.against}`)
    if (!s.comparison.new_issues.length && !s.comparison.resolved.length) pdf.text('No change in the automated results.')
    if (s.comparison.new_issues.length) pdf.text(`New this time: ${s.comparison.new_issues.join('; ')}`)
    if (s.comparison.resolved.length) pdf.text(`No longer showing: ${s.comparison.resolved.join('; ')}`)
    if (s.comparison.not_rechecked) pdf.text(`${s.comparison.not_rechecked} earlier item(s) were not rechecked this time, so they are not counted as resolved.`, { size: 9.5, color: 'muted' })
  }

  if (s.investigated) { pdf.heading('Issues I looked into'); pdf.text(s.investigated) }
  if (s.next_steps) { pdf.heading('Recommended next steps'); pdf.text(s.next_steps) }
  if (s.client_notes) { pdf.heading('Notes'); pdf.text(s.client_notes) }

  if (s.screenshots.length) {
    pdf.heading('Screenshots')
    const imgs: { data: Uint8Array; viewport: string | null }[] = []
    for (const sh of s.screenshots) {
      try { imgs.push({ data: new Uint8Array(await getObject(EVIDENCE_BUCKET, sh.path)), viewport: sh.viewport }) } catch { /* missing evidence is skipped */ }
    }
    if (imgs.length) {
      const desktop = imgs.find((i) => i.viewport === 'desktop')
      const mobile = imgs.find((i) => i.viewport === 'mobile')
      pdf.ensure(80)
      const top = pdf.y
      if (desktop) { pdf.doc.addImage(desktop.data, 'JPEG', 20, top, 110, 72); pdf.doc.setFontSize(8); pdf.doc.text('Desktop', 20, top + 76) }
      if (mobile) { pdf.doc.addImage(mobile.data, 'JPEG', 140, top, 34, 72); pdf.doc.setFontSize(8); pdf.doc.text('Mobile', 140, top + 76) }
      pdf.y = top + 82
    }
  }

  pdf.heading('About these checks')
  s.disclaimers.forEach((d) => pdf.text(d, { size: 9, color: 'muted', gap: 1.5 }))

  const doc = pdf.finish()
  doc.setProperties({ title: `Monthly health report, ${s.site.label}`, creator: 'Alante Velez' })
  return Buffer.from(doc.output('arraybuffer'))
}
