/**
 * Invoice PDFs: the invoice type decides the sections and billing language.
 * Each test builds a real PDF with the same builder the admin uses and reads
 * its text back. Set INVOICE_PDF_OUT=<folder> to keep the files for a visual check.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src' } })
const { buildInvoicePDF, invoiceDate, fixedFeeService } = await jiti.import(ROOT + 'src/app/admin/(dashboard)/_lib/pdf.ts')

const OUT = process.env.INVOICE_PDF_OUT || mkdtempSync(join(tmpdir(), 'invoice-pdf-'))
mkdirSync(OUT, { recursive: true })

/** Builds the PDF and returns its text (layout preserved) and page count. */
function render(name, doc, branded = true) {
  const pdf = buildInvoicePDF(doc, branded)
  pdf.finish()
  const file = join(OUT, name + '.pdf')
  writeFileSync(file, Buffer.from(pdf.doc.output('arraybuffer')))
  const text = execFileSync('pdftotext', ['-layout', file, '-']).toString()
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file]).toString())[1])
  return { text, pages, flat: text.replace(/\s+/g, ' ') }
}

const client = { client_name: 'Jordan Rivera', client_email: 'jordan@example.com' }
const scope = 'Program and payment selection, agreement review and acknowledgements, electronic signature, signed agreement delivery, Stripe checkout handoff, and enrollment confirmation experience.'

test('dates read like November 8, 2026 in every time zone', () => {
  assert.equal(invoiceDate('2026-11-08', 'Upon receipt'), 'November 8, 2026')
  assert.equal(invoiceDate('2026-01-01', 'Upon receipt'), 'January 1, 2026')
  assert.equal(invoiceDate('2026-11-08T00:30:00Z', 'Upon receipt'), 'November 8, 2026')
  assert.equal(invoiceDate('', 'Upon receipt'), 'Upon receipt')
  assert.equal(invoiceDate(null, 'Upon completion'), 'Upon completion')
  assert.equal(invoiceDate('Upon receipt', 'x'), 'Upon receipt')
})

test('fixed fee description: first line is the title, the rest is scope, nothing invented', () => {
  assert.deepEqual(fixedFeeService('Site Restructure\n' + scope), { title: 'Site Restructure', scope })
  assert.deepEqual(fixedFeeService('V7 Site Restructure — Change Order'), { title: 'V7 Site Restructure', scope: '' })
  assert.deepEqual(fixedFeeService('Title\nFixed-Fee Change Order\nScope line'), { title: 'Title', scope: 'Scope line' })
  assert.deepEqual(fixedFeeService('Homepage refresh'), { title: 'Homepage refresh', scope: '' })
  assert.deepEqual(fixedFeeService(''), { title: 'Web development services', scope: '' })
})

test('fixed fee invoice: change order layout, no hourly billing, one page', () => {
  const r = render('fixed-fee', {
    type: 'fixed_fee', invoice_number: 'INV-900', due_date: '2026-11-08', total_fee: 650,
    service_desc: 'Custom Enrollment & Digital Agreement Workflow\n' + scope, ...client,
  })
  for (const s of ['Invoice #INV-900', 'Prepared for Jordan Rivera', 'INVOICE #INV-900', 'Due Date: November 8, 2026',
    'BILL TO', 'Jordan Rivera', 'jordan@example.com', 'SERVICE', 'Custom Enrollment & Digital Agreement Workflow', 'Fixed-Fee Change Order',
    'CHANGE ORDER', 'Pricing: Fixed fee', 'Total Due: $650', 'PAYMENT', 'Stripe, PayPal, Zelle, or Wise', 'Page 1 of 1']) {
    assert.ok(r.flat.includes(s), 'missing: ' + s)
  }
  assert.ok(r.flat.includes('enrollment confirmation experience.'), 'the full description is printed, not truncated')
  for (const s of [/REVISION BILLING/i, /\bhrs?\b/i, /hours/i, /\/hr/, /hourly/i, /Reference:/, /2026-11-08/, / x \$/]) {
    assert.doesNotMatch(r.text, s)
  }
  assert.equal(r.pages, 1)
})

test('fixed fee invoice: Total Fee is shown exactly, never derived from hours', () => {
  const r = render('fixed-fee-600', { type: 'fixed_fee', invoice_number: 'INV-003', due_date: '2026-11-08', total_fee: 600, hours: 0, hourly_rate: 95, service_desc: 'Workflow', ...client })
  assert.ok(r.flat.includes('Total Due: $600'))
  assert.doesNotMatch(r.text, /0 hrs|Hours/)
})

test('fixed fee invoice: a long description wraps and continues onto a second page cleanly', () => {
  const long = Array.from({ length: 40 }, (_, i) => `Scope item ${i + 1}: ` + scope).join('\n')
  const r = render('fixed-fee-long', { type: 'fixed_fee', invoice_number: 'INV-901', due_date: '2026-12-01', total_fee: 4200, service_desc: 'Large change order\n' + long, ...client })
  assert.ok(r.pages >= 2)
  assert.ok(r.flat.includes('Scope item 40:'), 'nothing clipped')
  assert.ok(r.flat.includes(`Page ${r.pages} of ${r.pages}`))
  assert.ok(r.flat.includes('Total Due: $4,200'))
})

test('project invoice keeps its deposit and balance language', () => {
  const r = render('project', { type: 'project', invoice_number: 'INV-910', due_date: '2026-11-20', total_fee: 3000, deposit_amount: 1500, service_desc: 'Website build', ...client })
  for (const s of ['PAYMENT BREAKDOWN', 'Total Project Fee: $3,000', 'Deposit Due Now (50%): $1,500', 'Balance Due on Delivery (50%): $1,500', 'Due Date: November 20, 2026', 'Reference: Invoice #INV-910']) assert.ok(r.flat.includes(s), 'missing: ' + s)
  assert.doesNotMatch(r.text, /REVISION BILLING|CHANGE ORDER|Hours/)
  assert.equal(r.pages, 1)
})

test('revision invoice keeps hours x hourly rate', () => {
  const r = render('revision', { type: 'revision', invoice_number: 'INV-920', due_date: '2026-11-15', total_fee: 285, hours: '3', hourly_rate: '95', service_desc: 'Additional revision round', ...client })
  for (const s of ['REVISION BILLING', 'Hours: 3 hrs x $95/hr', 'Total Due: $285', 'Due Date: November 15, 2026']) assert.ok(r.flat.includes(s), 'missing: ' + s)
  assert.doesNotMatch(r.text, /CHANGE ORDER|Fixed-Fee|PAYMENT BREAKDOWN/)
  assert.equal(r.pages, 1)
})

test('milestone schedule record keeps milestone language, no hourly billing', () => {
  const r = render('milestone', { type: 'milestone', invoice_number: 'INV-930', due_date: null, total_fee: 5000, service_desc: 'Clinic website', ...client })
  for (const s of ['MILESTONE SCHEDULE', 'Schedule total: $5,000', 'Due Date: Upon receipt']) assert.ok(r.flat.includes(s), 'missing: ' + s)
  assert.doesNotMatch(r.text, /REVISION BILLING|Hours|CHANGE ORDER/)
})

test('an unknown type never invents hourly billing', () => {
  const r = render('other', { type: 'retainer', invoice_number: 'INV-940', due_date: '2026-11-30', total_fee: 800, service_desc: 'Monthly care', ...client })
  assert.ok(r.flat.includes('Total Due: $800'))
  assert.doesNotMatch(r.text, /REVISION BILLING|Hours|hrs/)
})

test('older records in the original layout get the same type logic and dates', () => {
  const r = render('fixed-fee-original-layout', { type: 'fixed_fee', invoice_number: 'INV-050', due_date: '2026-10-01', total_fee: 400, service_desc: 'Change order', ...client }, false)
  assert.ok(r.flat.includes('CHANGE ORDER') && r.flat.includes('Total Due: $400') && r.flat.includes('October 1, 2026'))
  assert.doesNotMatch(r.text, /REVISION BILLING|Hours/)
})
