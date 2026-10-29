/**
 * Tests for the admin pages as separate routes: direct links, refresh, back
 * and forward, active navigation, the old Docs address, warnings before
 * leaving unsaved work, per page error states, and sign in on every route.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { start, stop, adminPage, nav, waitFor, BASE } from './harness.mjs'

before(start, { timeout: 180000 })
after(stop)

const ROUTES = ['/admin', '/admin/pipeline', '/admin/revenue', '/admin/documents', '/admin/schedule', '/admin/care']
const current = (page) => page.locator('nav[aria-label="Admin"] [aria-current="page"]').textContent()
const details = (page) => page.locator('aside[aria-label="Details"]')

test('every admin route requires sign in', async () => {
  for (const r of ROUTES) {
    const res = await fetch(BASE + r, { redirect: 'manual' })
    assert.equal(res.status, 307, r)
    assert.ok((res.headers.get('location') || '').includes('/admin/login?from=' + encodeURIComponent(r)), r)
  }
})

test('each page has its own address, highlights its nav item, and survives refresh', async () => {
  const { page, close } = await adminPage()
  for (const [path, label, marker] of [
    ['/admin/pipeline', 'Pipeline', 'clients total'],
    ['/admin/revenue', 'Revenue', 'Monthly revenue'],
    ['/admin/documents', 'Docs', 'Fill and generate'],
    ['/admin/schedule', 'Schedule', 'Next 14 days'],
    ['/admin', 'Home', 'Discovery Calls'],
  ]) {
    await page.goto(BASE + path)
    await page.getByText(marker).first().waitFor()
    assert.equal((await current(page)).trim(), label)
    await page.reload()
    await page.getByText(marker).first().waitFor()
    assert.equal((await current(page)).trim(), label)
  }
  await close()
})

test('a client link opens that client directly, and back and forward follow selections', async () => {
  const { page, close } = await adminPage()
  await page.goto(BASE + '/admin/pipeline?client=cl-b')
  await details(page).getByText('blake@example.com').waitFor()
  await page.locator('.client-row', { hasText: 'Avery Alpha' }).click()
  await details(page).getByText('avery@example.com').waitFor()
  assert.match(page.url(), /client=cl-a/)
  await page.goBack()
  await details(page).getByText('blake@example.com').waitFor()
  await page.goForward()
  await details(page).getByText('avery@example.com').waitFor()
  await nav(page, 'Revenue')
  await page.getByText('Monthly revenue').waitFor()
  await page.goBack()
  await details(page).getByText('avery@example.com').waitFor()
  await close()
})

test('home: a lead link opens that lead', async () => {
  const { page, close } = await adminPage()
  await page.goto(BASE + '/admin?lead=in-2')
  await details(page).getByText('Details Completed, No Call Yet').waitFor()
  await details(page).getByText('lee@example.com').waitFor()
  await close()
})

test('a missing client shows a clear empty state instead of another client', async () => {
  const { page, close } = await adminPage()
  await page.goto(BASE + '/admin/pipeline?client=does-not-exist')
  await details(page).getByText('That client wasn’t found.').waitFor()
  await close()
})

test('the old Docs address redirects to Documents', async () => {
  const { page, close } = await adminPage()
  await page.goto(BASE + '/admin/docs')
  assert.match(page.url(), /\/admin\/documents$/)
  await page.getByText('Fill and generate').waitFor()
  await close()
})

test('documents: Open client goes to that client in the pipeline', async () => {
  const { page, close } = await adminPage()
  await page.goto(BASE + '/admin/documents')
  await page.getByRole('button', { name: 'Fill out contract' }).click()
  await page.getByLabel('Select from accepted proposals').selectOption({ label: 'Blake Beta — Beta Website' })
  await page.getByTestId('doc-context').getByRole('link', { name: 'Open client' }).click()
  await page.waitForURL(/\/admin\/pipeline\?client=cl-b/)
  await details(page).getByText('blake@example.com').waitFor()
  await close()
})

test('leaving a page with unsaved input asks first, and staying keeps the input', async () => {
  const { page, close } = await adminPage()
  page.removeAllListeners('dialog')
  let asked = 0
  let answer = false
  page.on('dialog', (d) => { asked++; answer ? d.accept() : d.dismiss() })
  await page.goto(BASE + '/admin/pipeline?client=cl-a')
  await details(page).getByRole('button', { name: 'Create Invoice' }).click()
  await details(page).getByRole('button', { name: 'Fixed Fee Invoice' }).click()
  await details(page).getByPlaceholder('INV-164').fill('INV-DRAFT')
  await nav(page, 'Revenue')
  await waitFor(() => asked === 1)
  assert.match(page.url(), /\/admin\/pipeline/)
  assert.equal(await details(page).getByPlaceholder('INV-164').inputValue(), 'INV-DRAFT')
  answer = true
  await nav(page, 'Revenue')
  await page.getByText('Monthly revenue').waitFor()
  assert.equal(asked, 2)
  await close()
})

test('a page that fails to load says so and can retry', async () => {
  const { page, api, close } = await adminPage()
  api.failOnce(/rest\/v1\/projects/, 500)
  await page.goto(BASE + '/admin/revenue')
  await page.getByRole('alert').getByText('Couldn’t load revenue').waitFor()
  await page.getByRole('button', { name: 'Try Again' }).click()
  await page.getByText('Monthly revenue').waitFor()
  await close()
})

test('the session prompt returns to the page you were on', async () => {
  const { page, api, close } = await adminPage()
  await page.goto(BASE + '/admin/schedule')
  await page.getByText('Next 14 days').waitFor()
  api.failOnce(/rest\/v1\/blocked_dates/, 401)
  await page.getByLabel('Date to block').fill(new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Block Day' }).click()
  const link = page.getByRole('alertdialog').getByRole('link', { name: 'Sign In Again' })
  await link.waitFor()
  assert.equal(await link.getAttribute('href'), '/admin/login?from=%2Fadmin%2Fschedule&expired=1')
  await close()
})

test('Website Care stays hidden and off inside the shared layout', async () => {
  const { page, close } = await adminPage()
  await page.goto(BASE + '/admin/care')
  await page.getByText('Website Care is switched off here').waitFor()
  assert.equal(await page.locator('nav[aria-label="Admin"]').getByText('Care', { exact: true }).count(), 0)
  await close()
})

test('the surface color choice carries across pages and refresh', async () => {
  const { page, close } = await adminPage()
  await page.goto(BASE + '/admin')
  await page.getByRole('button', { name: /Surface color: teal/ }).click()
  await nav(page, 'Pipeline')
  await page.getByRole('button', { name: /Surface color: charcoal/ }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: /Surface color: charcoal/ }).waitFor()
  await close()
})
