/**
 * The preview admin demo, end to end in a browser: sign in, separate demo
 * sessions, Reset demo, every dashboard page on demo data, the Website Care
 * plan time workflow (task confirmation, quantities, recording work, balances,
 * estimate approval and reservation, completion, invoice, undo, correction,
 * report preview), simulated email, meetings, checks, and payments, phone
 * widths, and the calendar. Every outside service points at a local tripwire
 * (demo-stack.mjs); the last test checks nothing ever reached it.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { startDemo, stopDemo, tripped, APP, PASSWORD, TOKEN } from './demo-stack.mjs'

const { chromium } = createRequire(import.meta.url)('playwright')
let browser

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const PHYSIO_SITE = ID(201)
const PHYSIO_CYCLE = ID(301)
const BAKERY_SITE = ID(202)

before(async () => {
  await startDemo()
  browser = await chromium.launch()
}, { timeout: 240000 })
after(async () => { await browser?.close(); await stopDemo() })

/** A signed in browser with its own demo session (its own session id, as a fresh sign in gets). */
async function signedIn({ width = 1366, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.addCookies([
    { name: 'admin_token', value: TOKEN, url: APP },
    { name: 'admin_demo_sid', value: crypto.randomUUID(), url: APP },
  ])
  const page = await ctx.newPage()
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(s) }))
  page.on('dialog', (d) => d.accept())
  return { page, ctx, close: () => ctx.close() }
}

const tiles = async (page) => {
  const t = page.locator('.care-allow').first()
  await t.waitFor()
  const get = async (k) => Number((await t.locator('div', { has: page.locator('small', { hasText: new RegExp(`^${k}$`) }) }).locator('b').textContent()).trim())
  return { included: await get('Included'), applied: await get('Applied'), reserved: await get('Reserved'), available: await get('Available') }
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const simulated = async (page) => {
  const bar = page.getByTestId('demo-bar')
  if (!(await bar.getByRole('button', { name: /Simulated actions/ }).getAttribute('aria-expanded')).includes('true')) await bar.getByRole('button', { name: /Simulated actions/ }).click()
  return bar.textContent()
}

test('signing in is required, and the real admin APIs are closed in demo mode', async () => {
  const r = await fetch(APP + '/admin/care', { redirect: 'manual' })
  assert.equal(r.status, 307)
  const anon = await fetch(APP + '/api/demo', { method: 'POST', body: '{}' })
  assert.equal(anon.status, 401)
  const cookie = `admin_token=${TOKEN}`
  for (const path of ['/api/admin/data/rest/v1/clients', '/api/care/admin/overview', '/api/invoices/send', '/api/meetings/schedule', '/api/debt-payoff']) {
    const res = await fetch(APP + path, { headers: { cookie } })
    assert.equal(res.status, 403, path)
  }
})

test('the sign in page says it is a demo, and signing in starts a demo session', async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } })
  const page = await ctx.newPage()
  await page.goto(APP + '/admin/login')
  await page.getByText('Demo • Fictional data • Changes are temporary.').waitFor()
  await page.fill('#admin-password', 'wrong password')
  await page.click('button[type=submit]')
  await page.getByText('That password isn’t right. Try again.').waitFor()
  await page.fill('#admin-password', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL(APP + '/admin')
  await page.getByTestId('demo-bar').waitFor()
  assert.ok((await ctx.cookies()).some((c) => c.name === 'admin_demo_sid'))
  await ctx.close()
})

test('every dashboard page shows the demo label and fictional data', async () => {
  const { page, close } = await signedIn()
  for (const [path, marker] of [
    ['/admin', 'Dana Brooks'], ['/admin/pipeline', 'Ellis Yoga Studio'], ['/admin/revenue', 'INV-DEMO-101'], ['/admin/documents', 'Fill and generate'],
    ['/admin/schedule', 'Next 14 days'], ['/admin/care', 'Review queue'], ['/admin/care?view=catalog', 'Task catalog'],
    [`/admin/care?site=${PHYSIO_SITE}`, 'Northside Physio'], [`/admin/care?cycle=${PHYSIO_CYCLE}`, 'Plan time and work'], ['/admin/debt-tracker', 'Demo Card A'],
  ]) {
    await page.goto(APP + path)
    await page.getByText(marker).first().waitFor()
    await page.getByTestId('demo-bar').getByText('Demo • Fictional data • Changes are temporary.').waitFor()
  }
  await close()
})

test('demo sessions are separate, and Reset demo restores the original data', async () => {
  const a = await signedIn()
  const b = await signedIn()
  await a.page.goto(`${APP}/admin/care?site=${PHYSIO_SITE}`)
  assert.deepEqual(await tiles(a.page), { included: 30, applied: 13, reserved: 0, available: 17 })
  await a.page.getByRole('button', { name: 'Quick add work' }).click()
  await a.page.getByRole('group', { name: 'Choose tasks' }).getByText('Replace supplied text').click()
  await a.page.getByText('The work and its testing are complete.', { exact: true }).click()
  await a.page.getByRole('button', { name: 'Record completed work' }).click()
  await a.page.locator('.care-allow b', { hasText: /^9$/ }).waitFor()
  await b.page.goto(`${APP}/admin/care?site=${PHYSIO_SITE}`)
  assert.equal((await tiles(b.page)).available, 17, 'another session never sees these changes')
  await a.page.reload()
  assert.equal((await tiles(a.page)).available, 9, 'changes last across pages in the same session')
  await Promise.all([a.page.waitForNavigation(), a.page.getByTestId('demo-bar').getByRole('button', { name: 'Reset demo' }).click()])
  assert.equal((await tiles(a.page)).available, 17)
  await a.close()
  await b.close()
})

test('task catalog: a proposed preset is confirmed', async () => {
  const { page, close } = await signedIn()
  await page.goto(`${APP}/admin/care?view=catalog`)
  const card = page.locator('.care-sub', { hasText: 'Add, remove, or change a link' }).first()
  await card.getByText('Proposed, not confirmed').waitFor()
  await card.getByRole('button', { name: 'Confirm minutes' }).click()
  await card.getByText('Confirmed', { exact: true }).waitFor()
  await close()
})

test('plan time at phone width: quantities, recording, estimate approval, completion, invoice, undo, correction', async () => {
  const { page, close } = await signedIn({ width: 375, height: 812 })
  await page.goto(`${APP}/admin/care?cycle=${PHYSIO_CYCLE}&work=add`)
  const qa = page.locator('section[aria-labelledby="qa-h"]')
  await qa.waitFor()
  await qa.getByRole('group', { name: 'Choose tasks' }).getByText('Replace a supplied image').click()
  await qa.getByRole('button', { name: 'One more' }).click()
  const sum = qa.locator('.care-sum').first()
  await sum.getByRole('row', { name: /Standard minutes to apply 13/ }).waitFor()
  await sum.getByRole('row', { name: /Available after recording 4/ }).waitFor()
  assert.ok(await overflow(page) <= 1, `Quick add overflows by ${await overflow(page)}px`)
  await qa.getByRole('button', { name: 'Cancel' }).click()

  // Larger request: the draft reserves nothing; approval reserves the included minutes.
  const card = page.locator('.care-sub', { hasText: 'Team section rebuild' }).first()
  await card.getByText('Additional price').waitFor()
  await card.getByRole('button', { name: 'Record client approval' }).click()
  await card.getByLabel('How the client approved').fill('Email reply (demo)')
  await card.getByRole('button', { name: 'Record client approval' }).click()
  await card.getByText('approved', { exact: true }).waitFor()
  assert.deepEqual(await tiles(page), { included: 30, applied: 13, reserved: 17, available: 0 })

  // Completing it converts the reservation and counts the rest as approved additional work.
  await card.getByRole('button', { name: 'Record work for this' }).click()
  await qa.getByRole('button', { name: 'Add a custom task' }).click()
  await qa.getByLabel('Custom task name').fill('Rebuild team section')
  await qa.getByLabel('Agreed standard minutes per unit').fill('82')
  await qa.getByLabel('Testing minutes').fill('0')
  await qa.getByLabel('Client facing description').fill('Rebuilt the team section so it fits phones.')
  await qa.getByText('This finishes the estimate.').click()
  await qa.getByText('The work and its testing are complete.', { exact: true }).click()
  await qa.getByRole('button', { name: 'Record completed work' }).click()
  await card.getByText('completed', { exact: true }).waitFor()
  assert.deepEqual(await tiles(page), { included: 30, applied: 30, reserved: 0, available: 0 })

  // The approved additional price becomes a pending invoice (nothing sent or charged).
  await card.getByRole('button', { name: 'Create invoice for $110' }).click()
  await card.getByLabel('Invoice number').fill('INV-DEMO-CARE-1')
  await card.getByRole('button', { name: 'Save $110 invoice' }).click()
  await card.getByText('Invoice saved (pending, not sent)').waitFor()

  // Undo the image batch: minutes come back, the entry stays in the history.
  const imgs = page.locator('.care-sub', { hasText: 'Replace a supplied image' }).filter({ has: page.getByRole('button', { name: 'Undo' }) }).first()
  await imgs.getByRole('button', { name: 'Undo' }).click()
  await imgs.getByLabel('Why undo this work').fill('Recorded twice (demo)')
  await imgs.getByRole('button', { name: 'Undo and restore minutes' }).click()
  await page.getByText('Undone: Recorded twice (demo)').waitFor()
  assert.equal((await tiles(page)).available, 13)

  // Every width the client asked for: nothing is cut off and the page never scrolls sideways.
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await page.waitForTimeout(200)
    assert.ok(await overflow(page) <= 1, `cycle page overflows by ${await overflow(page)}px at ${width}`)
    for (const sel of ['.care-allow', '.care-facts', '.care-scroll']) {
      const box = await page.locator(sel).first().boundingBox()
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `${sel} is cut off at ${width}px`)
    }
  }

  // Correction of the custom work: opens Quick add with the corrected lines.
  const rebuilt = page.locator('.care-sub', { hasText: 'Rebuild team section' }).filter({ has: page.getByRole('button', { name: 'Correct' }) }).first()
  await rebuilt.getByRole('button', { name: 'Correct' }).click()
  await qa.getByLabel('Why this correction').waitFor()
  await qa.getByRole('button', { name: 'Cancel' }).click()

  await page.goto(`${APP}/admin/revenue`)
  await page.getByText('INV-DEMO-CARE-1').first().waitFor()
  await close()
})

test('report preview and PDF, and a simulated check', async () => {
  const { page, close } = await signedIn()
  await page.goto(`${APP}/admin/care?cycle=${PHYSIO_CYCLE}`)
  await page.getByText('Client report preview (version 1)').click()
  await page.getByText('Plan time used').first().waitFor()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download preview PDF' }).click()])
  const pdf = await (await import('node:fs/promises')).readFile(await dl.path())
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Open PDF preview' }).click()])
  await popup.close()
  await page.getByRole('button', { name: 'Run the check again' }).click()
  await page.waitForTimeout(500)
  assert.match(await simulated(page), /Simulated check finished for Northside Physio/)

  await page.goto(`${APP}/admin/care?site=${BAKERY_SITE}`)
  await page.getByText('Review this client’s care agreement first.').waitFor()
  await page.getByLabel('How the client accepted the current terms').fill('Signed updated agreement (demo)')
  await page.getByRole('button', { name: 'Mark agreement reviewed' }).click()
  await page.locator('button:enabled', { hasText: 'Quick add work' }).waitFor()

  await close()
})

test('a new client: enroll, record the care terms at confirmation, simulated checkout and payment, review in the queue', async () => {
  const { page, close } = await signedIn()
  await page.goto(`${APP}/admin/care?view=sites`)
  await page.getByRole('button', { name: 'Enroll a website' }).first().click()
  await page.getByLabel('Search clients').fill('Rivera')
  await page.locator('#f-client').selectOption({ label: 'Rivera Garden Design (Casey Rivera)' })
  await page.locator('#f-plan').selectOption('premium')
  await page.locator('#f-price').fill('239')
  await page.locator('#f-label').fill('Rivera Garden Design')
  await page.locator('#f-url').fill('https://garden.example.com/')
  await page.locator('#f-dom').fill('garden.example.com')
  await page.getByLabel('Page 1 address').fill('https://garden.example.com/')
  await page.getByRole('button', { name: 'Add page' }).click()
  await page.getByLabel('Page 2 name').fill('Gallery')
  await page.getByLabel('Page 2 address').fill('https://garden.example.com/gallery')
  await page.locator('fieldset', { hasText: 'Manual checklist' }).locator('button[aria-pressed]').first().click()
  await page.locator('#f-rn').fill('Casey Rivera')
  await page.locator('#f-re').fill('casey@example.com')
  await page.getByRole('button', { name: 'Save enrollment' }).click()
  const conf = page.locator('section[aria-labelledby="conf-h"]')
  await conf.waitFor()
  await page.getByText('Care terms: recorded when you confirm the setup').waitFor()
  await conf.getByText('The website address, approved domains').click()
  await conf.getByText('The client authorized these read only checks').click()
  await conf.getByText('The manual checklist matches').click()
  await conf.locator('#c-auth').fill('Signed care agreement (demo)')
  await conf.getByRole('button', { name: 'Confirm setup and enable reviews' }).click()
  await conf.getByText('Confirm the client accepted the current care terms.').waitFor()
  await conf.locator('label', { hasText: 'The client accepted the current care terms' }).click()
  await conf.locator('#c-terms').fill('Signed care agreement (demo)')
  await conf.getByRole('button', { name: 'Confirm setup and enable reviews' }).click()
  await page.getByText('Setup confirmed').first().waitFor()
  await page.getByText('Care terms: current (Signed care agreement (demo))').waitFor()

  const bill = page.locator('section[aria-labelledby="bill-h"]')
  await bill.getByText('No subscription yet').waitFor()

  // The agreed $239 doesn't match the Premium Stripe price ($249): checkout and the invitation are blocked.
  await bill.getByRole('button', { name: 'Send subscription invitation' }).click()
  const inv = bill.getByTestId('invite-panel')
  await inv.getByText('Can’t send yet.').waitFor()
  assert.match(await inv.textContent(), /charges \$249 a month, but the agreed price is \$239 a month/)
  assert.equal(await inv.getByRole('button', { name: 'Send invitation' }).count(), 0)
  await bill.getByRole('button', { name: 'Copy checkout link instead' }).click()
  await bill.getByText(/Checkout is blocked for Rivera Garden Design/).waitFor()
  assert.equal(await bill.getByRole('textbox', { name: 'Stripe link' }).count(), 0, 'no link was created')

  // Correct the agreed price to the plan price; the invitation shows the verified recurring amount.
  await page.locator('#f-price').fill('249')
  await Promise.all([page.waitForResponse((r) => r.url().includes('/api/demo') && r.request().method() === 'POST'), page.getByRole('button', { name: 'Save changes' }).click()])
  await page.reload()
  await bill.getByRole('button', { name: 'Send subscription invitation' }).click()
  await inv.getByText('Price verified').waitFor()
  const shown = await inv.textContent()
  assert.match(shown, /casey@example\.com/)
  assert.match(shown, /Premium Care/)
  assert.match(shown, /\$249 USD every month/)
  await inv.locator('#inv-conf').fill('casey@example.com')
  await inv.getByRole('button', { name: 'Send invitation' }).click()
  await inv.getByText(/Invitation sent to casey@example\.com/).waitFor()
  let log = await simulated(page)
  assert.match(log, /Email to casey@example\.com: Start Website Care for Rivera Garden Design/)

  // The practice panel: let the link expire, then a fresh invitation makes a new link.
  const practice = bill.getByTestId('practice-panel')
  await practice.getByRole('button', { name: 'Let the link expire' }).click()
  await practice.getByText(/The checkout link expired/).waitFor()
  await page.reload()
  await bill.getByText(/Checkout link expired|invitation sent/).first().waitFor()
  await bill.getByRole('button', { name: 'Send subscription invitation' }).click()
  await inv.getByText('Expired; a new link will be created').waitFor()
  await inv.locator('#inv-conf').fill('casey@example.com')
  await inv.getByRole('button', { name: 'Send invitation' }).click()
  await inv.getByText(/Invitation sent to casey@example\.com/).waitFor()

  // Play the client on the simulated checkout; Stripe's notices go through the real webhook processing.
  await page.reload()
  await practice.getByRole('link', { name: /Open the simulated checkout/ }).click()
  await page.getByRole('button', { name: 'Pay $249 (simulated)' }).click()
  await page.getByText('Paid (simulated)').waitFor()
  await page.getByRole('link', { name: 'Back to the website' }).click()
  await bill.getByText('Paid, active').waitFor()
  await page.locator('section[aria-labelledby="hist-h"]').getByText('Manual review due').waitFor()
  log = await simulated(page)
  assert.match(log, /checkout paid for Rivera Garden Design.*checkout\.session\.completed \(processed\), invoice\.paid \(processed\)/)
  assert.match(log, /Simulated check finished for Rivera Garden Design/)
  // A second invitation is refused now that a subscription exists.
  assert.equal(await bill.getByRole('button', { name: 'Send subscription invitation' }).count(), 0)

  await page.goto(`${APP}/admin/care?view=queue`)
  await page.locator('section[aria-labelledby="queue-h"]').getByText('Rivera Garden Design').first().waitFor()
  await page.goto(`${APP}/admin/care?view=sites`)
  const row = page.locator('tr', { hasText: 'Rivera Garden Design' })
  assert.doesNotMatch(await row.textContent(), /Not set/)
  assert.doesNotMatch(await page.locator('tr', { hasText: 'Northside Physio' }).textContent(), /Not set|No subscription yet/)
  await page.locator('tr', { hasText: 'Northside Physio' }).getByText('Billed outside Stripe').waitFor()
  await close()
})

test('practice billing events: renewal, failed payment, both cancellations, and redelivered notices create nothing twice', async () => {
  const { page, close } = await signedIn()
  const DENTAL = '00000000-0000-4000-8000-000000000203'
  const site = () => page.evaluate(async (id) => (await fetch(`/api/care/admin/sites/${id}`)).json(), DENTAL)
  const counts = async () => { const d = await site(); return { cycles: d.cycles.length, reports: d.reports.length, minutes: d.cycles.reduce((n, c) => n + c.included_minutes, 0), site: d.site } }
  await page.goto(`${APP}/admin/care?site=${DENTAL}`)
  const practice = page.getByTestId('practice-panel')
  const run = async (name, expect) => {
    await practice.getByRole('button', { name }).click()
    await practice.getByRole('status').getByText(expect).waitFor()
    return practice.getByRole('status').textContent()
  }
  // The panel shows once the page is running on the demo session; the counts read through it.
  await practice.getByRole('button', { name: 'Renewal' }).waitFor()
  const start = await counts()
  assert.equal(start.cycles, 1)

  // Renewal: one new paid period with its review and its own included minutes.
  await run('Renewal', /renewed the subscription/)
  const renewed = await counts()
  assert.equal(renewed.cycles, 2)
  assert.equal(renewed.reports, start.reports + 1)
  assert.equal(renewed.minutes, start.minutes + 90)
  assert.ok(new Date(renewed.site.paid_through) > new Date(start.site.paid_through))

  // The same notices again (Stripe's retry): ignored as duplicates, nothing added.
  const again = await run('Send the last notice again', /same notices again/)
  assert.match(again, /invoice\.paid: already processed, ignored/)
  assert.deepEqual(await counts().then((c) => [c.cycles, c.reports, c.minutes]), [2, renewed.reports, renewed.minutes])

  // Failed payment: no period starts for the unpaid month; billing needs attention after the failures.
  await run('Failed payment', /payment failed \(attempt 1\)/)
  await run('Failed payment', /payment failed \(attempt 2\)/)
  let c = await counts()
  assert.equal(c.cycles, 2, 'an unpaid month starts no review')
  assert.equal(c.site.subscription_status, 'past_due')
  assert.ok(c.site.failed_payment_count >= 2)
  await page.reload()
  await page.locator('section[aria-labelledby="bill-h"]').getByText(/failed payment/).first().waitFor()

  // Stripe's retry succeeds: that month's period starts once.
  await run('Renewal', /retried the failed renewal and it was paid/)
  c = await counts()
  assert.equal(c.cycles, 3)
  assert.equal(c.site.subscription_status, 'active')
  await run('Send the last notice again', /same notices again/)
  assert.equal((await counts()).cycles, 3)

  // Cancel at period end: still active and honored; the next "renewal" ends it instead of charging.
  await run('Cancel at period end', /scheduled cancellation/)
  c = await counts()
  assert.equal(c.site.billing_state, 'canceling')
  await page.reload()
  await page.locator('section[aria-labelledby="bill-h"]').getByText('Cancels at period end').waitFor()
  await run('Renewal', /closed the subscription instead of renewing/)
  c = await counts()
  assert.equal(c.site.subscription_status, 'canceled')
  assert.equal(c.cycles, 3, 'no new period after cancellation')

  const log = await simulated(page)
  assert.match(log, /Practice for Lakeside Dental/)
  assert.match(log, /Email to .*Website Care billing: Lakeside Dental needs attention/)
  await close()
})

test('practice: immediate cancellation flags the open review for your decision', async () => {
  const { page, close } = await signedIn()
  const DENTAL = '00000000-0000-4000-8000-000000000203'
  await page.goto(`${APP}/admin/care?site=${DENTAL}`)
  const practice = page.getByTestId('practice-panel')
  await practice.getByRole('button', { name: 'Cancel immediately' }).click()
  await practice.getByRole('status').getByText(/canceled immediately/).waitFor()
  const d = await page.evaluate(async (id) => (await fetch(`/api/care/admin/sites/${id}`)).json(), DENTAL)
  assert.equal(d.site.subscription_status, 'canceled')
  assert.equal(d.cycles.length, 1)
  assert.equal(d.cycles[0].billing_flag, 'canceled_immediately')
  await page.reload()
  await page.locator('section[aria-labelledby="hist-h"]').getByText(/canceled immediately/).first().waitFor()
  await close()
})

test('the owner’s guide opens from Website Care and is searchable', async () => {
  const { page, close } = await signedIn({ width: 375, height: 800 })
  await page.goto(`${APP}/admin/care`)
  await page.getByRole('link', { name: 'Help / Owner’s guide' }).click()
  await page.getByRole('heading', { name: 'Map of the Website Care area' }).waitFor()
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Search the guide').fill('failed payment')
  await page.locator('.guide [role=status]').getByText(/sections match/).waitFor()
  const img = await page.request.get(`${APP}/admin/care/guide/img/01-overview.png`)
  assert.equal(img.headers()['content-type'], 'image/png')
  assert.ok(await overflow(page) <= 1)
  const anon = await fetch(`${APP}/admin/care/guide/img/01-overview.png`, { redirect: 'manual' })
  assert.equal(anon.status, 307, 'guide screenshots need the admin sign in')
  await close()
})

test('pipeline: email, meeting, and invoice are simulated and listed', async () => {
  const { page, close } = await signedIn()
  await page.goto(`${APP}/admin/pipeline?client=${ID(105)}`)
  const panel = page.locator('aside[aria-label="Details"]')
  await panel.getByText('casey@example.com').waitFor()
  await panel.getByRole('button', { name: 'Email Casey' }).click()
  const dlg = page.getByRole('dialog', { name: 'Email client' })
  await dlg.getByPlaceholder('Project update, quick question...').fill('Demo update')
  await dlg.locator('textarea').fill('Hello from the demo.')
  await dlg.getByRole('button', { name: 'Send Email' }).click()
  await dlg.waitFor({ state: 'detached' })
  await panel.getByRole('button', { name: 'Schedule Meeting' }).click()
  await panel.locator('input[type=date]').fill(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10))
  await panel.locator('input[type=time]').fill('10:30')
  await panel.getByRole('button', { name: /^Schedule/ }).last().click()
  await page.waitForTimeout(800)
  await panel.getByRole('button', { name: 'Create Invoice' }).click()
  await panel.getByRole('button', { name: 'Fixed Fee Invoice' }).click()
  await panel.getByPlaceholder('INV-164').fill('INV-DEMO-200')
  await panel.getByPlaceholder('650').fill('400')
  await panel.getByRole('button', { name: 'Send to Client' }).click()
  await panel.getByText('INV-DEMO-200').first().waitFor()
  const log = await simulated(page)
  assert.match(log, /Email to casey@example\.com: Demo update/)
  assert.match(log, /Email to casey@example\.com: .*INV-DEMO-200/)
  assert.match(log, /Zoom meeting/)
  await close()
})

test('schedule shows care reviews on the calendar', async () => {
  const { page, close } = await signedIn()
  await page.goto(`${APP}/admin/schedule`)
  await page.getByText('Next 14 days').waitFor()
  await page.getByText(/Northside Physio/).first().waitFor()
  await close()
})

test('phone widths: every dashboard page fits', async () => {
  const { page, close } = await signedIn({ width: 320, height: 700 })
  for (const path of ['/admin', '/admin/pipeline', '/admin/revenue', '/admin/documents', '/admin/schedule', '/admin/care', `/admin/care?site=${PHYSIO_SITE}`, '/admin/care?view=catalog']) {
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 760 })
      await page.goto(APP + path)
      await page.getByTestId('demo-bar').waitFor()
      await page.waitForTimeout(700)
      const over = await overflow(page)
      assert.ok(over <= 1, `${path} overflows by ${over}px at ${width}`)
    }
  }
  await close()
})

test('no request ever reached Supabase, Resend, Zoom, Stripe, or GitHub', () => {
  assert.deepEqual(tripped, [])
})
