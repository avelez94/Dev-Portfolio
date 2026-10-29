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

test('report preview and PDF, a simulated check, and simulated Stripe payment', async () => {
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

  await page.goto(`${APP}/admin/care?site=${ID(203)}`)
  await page.getByRole('button', { name: 'Create Stripe checkout link' }).click()
  await page.waitForTimeout(800)
  assert.match(await simulated(page), /Simulated Stripe checkout and first payment of \$239 for Lakeside Dental/)
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
