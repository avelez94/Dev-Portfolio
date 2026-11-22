/**
 * Paid periods recorded by hand, agreements signed outside the app, test
 * websites, and Website Care payments in Revenue, on this machine only: the
 * real Next.js routes on a throwaway PostgreSQL with the pending migrations,
 * Stripe off (as in production today), Resend pointed at a local fake.
 *
 * Rules under test:
 *   - A paid period needs a signed agreement covering the current scope,
 *     plan and price: signed in the app, or recorded as signed outside it.
 *   - It needs the payment actually received: one of the client's paid
 *     invoices, or money received directly (amount, date, how).
 *   - Revenue counts every payment once, never test payments or plan minutes.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { available, one, rows, q, sql } from './pg.mjs'
import { startStack, stopStack, api } from './local-stack.mjs'
import { startFakeResend } from './fake-services.mjs'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run these tests)'
let ids, resend, testSite

const CHECKS = [
  { id: 'visual-desktop', label: 'Desktop appearance looks right', category: 'Appearance' },
  { id: 'visual-mobile', label: 'Mobile appearance looks right', category: 'Appearance' },
  { id: 'booking', label: 'Booking shows availability and the steps make sense', category: 'Booking' },
]
const CONFIRM = { confirm_website: true, confirm_authorization: true, confirm_checklist: true, authorization_note: 'Signed care authorization, Nov 22', confirm_terms: true, terms_note: 'Signed care agreement, Nov 22' }
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n' + 'x'.repeat(400) + '\n%%EOF').toString('base64')
const offline = (o = {}) => ({ signer_name: 'Sam Patel', signed_on: '2026-11-20', method: 'paper', evidence: 'Signed paper agreement, Business Care at $129 a month, kept in the client folder', confirm_covers: true, ...o })
const direct = (o = {}) => ({ period_start: '2026-12-01', period_end: '2027-01-01', payment_method: 'direct', amount: '129', received_on: '2026-11-21', reference: 'Zelle, confirmation 4821', confirm_paid: true, ...o })
const revenue = async () => (await api('revenue')).data

before(async () => {
  if (skip) return
  resend = await startFakeResend(55995)
  ids = await startStack({
    env: {
      RESEND_API_KEY: 're_local', RESEND_BASE_URL: 'http://127.0.0.1:55995', STRIPE_SECRET_KEY: '',
      CARE_TEST_HOSTS: JSON.stringify({ 'physio.example.com': '93.184.215.14', 'practice.example.com': '93.184.215.14' }),
      CARE_EMAIL_ALLOWLIST: 'frontdesk@example.com,owner+care@example.com',
    },
  })
  // The seeded website was enrolled before the current confirmation rules: confirm its scope now.
  const cur = (await api(`sites/${ids.site}`)).data.site
  await api(`sites/${ids.site}`, { method: 'PUT', json: { ...cur, manual_checklist: CHECKS } })
  const ok = await api(`sites/${ids.site}/confirm`, { method: 'POST', json: CONFIRM })
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
}, { timeout: 240000 })
after(async () => { if (!skip) { await stopStack(); resend?.server.close() } })

test('a paid period can’t be recorded until a signed agreement covers the website', { skip }, async () => {
  const r = await api(`sites/${ids.site}/cycles`, { method: 'POST', json: direct() })
  assert.equal(r.status, 409)
  assert.match(r.data.error, /only be added after the client signs the current care agreement/)
  assert.match(r.data.error, /Send the agreement link so they can sign it online/)
  assert.equal(rows(`select id from care_cycles where site_id = ${q(ids.site)} and period_start >= '2026-11-30'`).length, 0)
})

test('an agreement signed outside the app is recorded with who, when, how and where, and then covers the website', { skip }, async () => {
  for (const [bad, re] of [
    [{ signer_name: '' }, /name of the person who signed/],
    [{ signed_on: '2099-01-01' }, /date it was signed/],
    [{ method: 'fax' }, /how it was signed/],
    [{ evidence: 'short' }, /where its copy is kept/],
    [{ confirm_covers: false }, /covers this website, plan, monthly price and scope/],
    [{ pdf_base64: 'data:application/pdf;base64,' + Buffer.from('not a pdf').toString('base64') }, /must be a PDF/],
  ]) {
    const r = await api(`sites/${ids.site}/agreement/offline`, { method: 'POST', json: offline(bad) })
    assert.equal(r.status, 422, JSON.stringify(bad))
    assert.match(r.data.error, re)
  }
  const r = await api(`sites/${ids.site}/agreement/offline`, { method: 'POST', json: offline({ pdf_base64: PDF }) })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const st = (await api(`sites/${ids.site}/agreement`)).data
  assert.equal(st.state, 'signed')
  assert.equal(st.current.signed_offline, true)
  assert.equal(st.current.offline_method, 'paper')
  assert.equal(st.current.has_pdf, true)
  const a = one(`select * from care_agreements where id = ${q(r.data.agreement_id)}`)
  assert.equal(a.status, 'signed')
  assert.equal(a.signature_image, null, 'no drawn signature is invented')
  assert.equal(a.offline_recorded_by, 'admin')
  assert.ok(rows(`select id from care_activity where action = 'agreement_recorded_offline' and site_id = ${q(ids.site)}`).length === 1)
  // It doesn't replace a signed agreement.
  assert.equal((await api(`sites/${ids.site}/agreement/offline`, { method: 'POST', json: offline() })).status, 409)
})

test('a direct payment needs the amount, date and how it was paid; the period records it and its review starts', { skip }, async () => {
  for (const [bad, re] of [
    [{ payment_method: '' }, /Choose how this period was paid/],
    [{ amount: '0' }, /amount received/],
    [{ amount: '12.345' }, /amount received/],
    [{ received_on: '2099-01-01' }, /date the payment was received/],
    [{ reference: '' }, /how it was paid/],
    [{ confirm_paid: false }, /Confirm the payment/],
  ]) {
    const r = await api(`sites/${ids.site}/cycles`, { method: 'POST', json: direct(bad) })
    assert.ok([409, 422].includes(r.status), JSON.stringify(bad))
    assert.match(r.data.error, re)
  }
  const r = await api(`sites/${ids.site}/cycles`, { method: 'POST', json: direct() })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const c = one(`select * from care_cycles where id = ${q(r.data.cycle.id)}`)
  assert.deepEqual([c.payment_method, c.payment_amount_cents, c.payment_received_on, c.payment_reference, c.is_test], ['direct', 12900, '2026-11-21', 'Zelle, confirmation 4821', false])
  assert.ok(c.agreement_id, 'the covering agreement is recorded on the period')
  assert.equal(rows(`select id from care_reports where cycle_id = ${q(c.id)}`).length, 1, 'the period has its review')
  // The same period twice is refused.
  assert.equal((await api(`sites/${ids.site}/cycles`, { method: 'POST', json: direct() })).status, 409)
})

test('an invoice payment must be one of this client’s invoices, marked paid; Revenue counts the invoice and not the period', { skip }, async () => {
  const other = one(`insert into clients (name, email) values ('Other Client', 'other@example.com') returning id`).id
  const pending = one(`insert into invoices (client_id, invoice_number, invoice_type, total_fee, amount, status) values (${q(ids.client)}, 'INV-CARE-1', 'fixed_fee', 129, 129, 'pending') returning id`).id
  const foreign = one(`insert into invoices (client_id, invoice_number, invoice_type, total_fee, amount, status, paid_date) values (${q(other)}, 'INV-OTHER', 'fixed_fee', 129, 129, 'paid', '2026-11-21') returning id`).id
  const inv = (invoice_id) => direct({ period_start: '2027-01-01', period_end: '2027-02-01', payment_method: 'invoice', invoice_id, amount: '', received_on: '', reference: '' })
  let r = await api(`sites/${ids.site}/cycles`, { method: 'POST', json: inv(foreign) })
  assert.equal(r.status, 422)
  assert.match(r.data.error, /this client’s invoices/)
  r = await api(`sites/${ids.site}/cycles`, { method: 'POST', json: inv(pending) })
  assert.equal(r.status, 409)
  assert.match(r.data.error, /INV-CARE-1 isn’t marked paid yet/)
  sql(`update invoices set status = 'paid', paid_date = '2026-11-22' where id = ${q(pending)}`)
  assert.deepEqual((await api(`sites/${ids.site}/paid-invoices`)).data.invoices.map((i) => i.invoice_number), ['INV-CARE-1'])
  r = await api(`sites/${ids.site}/cycles`, { method: 'POST', json: inv(pending) })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const c = one(`select * from care_cycles where id = ${q(r.data.cycle.id)}`)
  assert.deepEqual([c.payment_method, c.payment_invoice_id, c.payment_amount_cents], ['invoice', pending, null])

  const rev = await revenue()
  const byMethod = Object.fromEntries(rev.payments.filter((p) => p.site_id === ids.site).map((p) => [p.method, p]))
  assert.equal(byMethod.direct.counted, 129)
  assert.equal(byMethod.invoice.counted, 0)
  assert.equal(byMethod.invoice.invoice_number, 'INV-CARE-1')
  assert.match(byMethod.invoice.note, /Counted once, in invoice INV-CARE-1/)
  // The seeded period from before 20261108 has no recorded payment: listed, never counted.
  assert.equal(byMethod.not_recorded.counted, 0)

  // The Revenue page totals: the invoice once, the direct payment once.
  const { revenueTotals } = await jiti.import(ROOT + 'src/app/admin/(dashboard)/_lib/invoices.ts')
  const invRows = rows(`select * from invoices where client_id = ${q(ids.client)}`).map((i) => ({ ...i, total_fee: Number(i.total_fee), amount: Number(i.amount) }))
  const t = revenueTotals(invRows, [], rev.payments)
  assert.equal(t.totalEarned, 129 + 129)
  assert.equal(t.care, 129)
})

test('a test website: marked at enrollment, can’t use real invoices, and its payments never reach Revenue', { skip }, async () => {
  const client = one(`insert into clients (name, email, business) values ('Alante Test', 'owner+care@example.com', 'Practice Client') returning id`).id
  const created = await api('sites', { method: 'POST', json: {
    client_id: client, label: 'Practice Client', site_url: 'https://practice.example.com/', approved_domains: ['practice.example.com'], plan: 'business', agreed_monthly_price: 129,
    pages: [{ label: 'Home', url: 'https://practice.example.com/' }], destinations: [], manual_checklist: CHECKS.slice(0, 2),
    recipient_name: 'Alante Test', recipient_email: 'owner+care@example.com', is_test: true,
  } })
  assert.equal(created.status, 201, JSON.stringify(created.data))
  testSite = created.data.site.id
  assert.equal(one(`select is_test from care_sites where id = ${q(testSite)}`).is_test, true)
  // Editing can't turn it into a real website.
  await api(`sites/${testSite}`, { method: 'PUT', json: { ...created.data.site, is_test: false } })
  assert.equal(one(`select is_test from care_sites where id = ${q(testSite)}`).is_test, true)
  assert.equal((await api(`sites/${testSite}/confirm`, { method: 'POST', json: CONFIRM })).status, 200)
  assert.equal((await api(`sites/${testSite}/agreement/offline`, { method: 'POST', json: offline({ signer_name: 'Alante Test', evidence: 'Practice agreement for testing, signed by me' }) })).status, 201)

  const realInvoice = one(`insert into invoices (client_id, invoice_number, invoice_type, total_fee, amount, status, paid_date) values (${q(client)}, 'INV-TEST', 'fixed_fee', 129, 129, 'paid', '2026-11-22') returning id`).id
  const r1 = await api(`sites/${testSite}/cycles`, { method: 'POST', json: direct({ payment_method: 'invoice', invoice_id: realInvoice }) })
  assert.equal(r1.status, 422)
  assert.match(r1.data.error, /test website can’t use a real invoice/)
  const r2 = await api(`sites/${testSite}/cycles`, { method: 'POST', json: direct({ reference: 'Test payment' }) })
  assert.equal(r2.status, 201, JSON.stringify(r2.data))
  assert.equal(one(`select is_test from care_cycles where id = ${q(r2.data.cycle.id)}`).is_test, true)
  const row = (await revenue()).payments.find((p) => p.site_id === testSite)
  assert.deepEqual([row.test, row.counted, row.amount], [true, 0, 129])
  sql(`delete from invoices where id = ${q(realInvoice)}`)
})

test('Stripe payments count the amount Stripe collected, once per invoice; test mode payments never count', { skip }, async () => {
  const { carePayments } = await jiti.import(ROOT + 'src/lib/care/revenue.ts')
  const sites = [{ id: 's', label: 'Site' }]
  const base = { site_id: 's', source: 'stripe', payment_method: 'stripe', currency: 'usd', period_start: '2026-11-01T05:00:00Z', period_end: '2026-12-01T05:00:00Z', included_minutes: 30 }
  const out = carePayments([
    { ...base, id: 'live', amount_paid: 12900, paid_at: '2026-11-01T15:00:00Z', is_test: false },
    { ...base, id: 'testmode', amount_paid: 12900, paid_at: '2026-11-01T15:00:00Z', is_test: true },
  ], sites)
  assert.deepEqual(out.map((r) => [r.cycle_id, r.counted, r.received_on]), [['live', 129, '2026-11-01'], ['testmode', 0, '2026-11-01']])
  // Included minutes are never money: nothing in a row depends on them.
  const noMinutes = carePayments([{ ...base, id: 'live', amount_paid: 12900, paid_at: '2026-11-01T15:00:00Z', included_minutes: 90 }], sites)
  assert.equal(noMinutes[0].counted, 129)
})
