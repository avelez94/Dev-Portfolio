/**
 * Starts (or reuses) a local Next.js server for the admin browser tests and
 * opens signed in pages with the fake data API installed.
 *
 *   BASE_URL=http://localhost:3000 node --test tests/admin   (reuse a running server)
 *   node --test tests/admin                                  (starts `next dev` on port 3210)
 *
 * The server gets a throwaway admin token and dummy database settings that
 * point nowhere, so nothing here can touch a real database or send email.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createFakeApi } from './fake-data.mjs'

export const TOKEN = process.env.ADMIN_SECRET_TOKEN || 'test-admin-token'
export const BASE = process.env.BASE_URL || 'http://localhost:3210'

// Playwright is preinstalled globally in this environment and in CI images; a
// require lookup finds it there or in node_modules.
const { chromium } = createRequire(import.meta.url)('playwright')

let server = null
let browser = null

async function up() {
  try {
    const r = await fetch(BASE + '/admin/login', { redirect: 'manual' })
    return r.status > 0
  } catch {
    return false
  }
}

export async function start() {
  if (!(await up())) {
    if (process.env.BASE_URL) throw new Error(`No server at ${BASE}`)
    server = spawn('npx', ['next', 'dev', '-p', new URL(BASE).port], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: {
        ...process.env,
        ADMIN_SECRET_TOKEN: TOKEN,
        WEBSITE_CARE_ENABLED: 'false',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
        SUPABASE_SERVICE_ROLE_KEY: 'test',
        RESEND_API_KEY: 're_test',
      },
      stdio: 'ignore',
      detached: true,
    })
    for (let i = 0; i < 120 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1000))
    if (!(await up())) throw new Error('The dev server did not start')
  }
  browser = await chromium.launch()
}

export async function stop() {
  await browser?.close()
  if (server) {
    try { process.kill(-server.pid) } catch { /* already gone */ }
  }
}

/** A signed in page at the given width, with a fresh fake database. */
export async function adminPage({ width = 1366, height = 900, signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true })
  if (signedIn) await context.addCookies([{ name: 'admin_token', value: TOKEN, url: BASE }])
  const page = await context.newPage()
  // The Next.js dev badge sits over the phone navigation; tests click past it.
  await page.addInitScript(() => {
    const hide = () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head?.appendChild(s) }
    if (document.head) hide(); else document.addEventListener('DOMContentLoaded', hide)
  })
  const api = createFakeApi()
  await api.install(page)
  page.on('dialog', (d) => d.accept())
  return { page, api, context, close: () => context.close() }
}

/** Clicks an item in the admin sidebar by its label (works for buttons or links). */
export async function nav(page, label) {
  await page.locator('nav[aria-label="Admin"]').getByText(label, { exact: true }).click()
}

export const waitFor = async (fn, ms = 8000) => {
  const t = Date.now()
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() - t > ms) throw new Error('Timed out waiting')
    await new Promise((r) => setTimeout(r, 100))
  }
}
