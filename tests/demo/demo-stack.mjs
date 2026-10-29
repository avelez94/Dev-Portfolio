/**
 * Runs the app locally in admin demo mode, with every outside service
 * (Supabase, Resend, Zoom, Stripe, GitHub) pointed at a local tripwire that
 * records any request that reaches it. A working demo never reaches it.
 *
 *   node tests/demo/demo-stack.mjs     start it and leave it running (Ctrl+C stops)
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'

export const PORT = Number(process.env.DEMO_APP_PORT || 3240)
export const APP = `http://localhost:${PORT}`
export const PASSWORD = 'demo-local-password'
export const TOKEN = 'demo-local-admin-token'
const TRIP_PORT = 55991
const TRIP = `http://127.0.0.1:${TRIP_PORT}`

export const tripped = []
let app = null
let trip = null

export async function startDemo({ env = {} } = {}) {
  trip = createServer((req, res) => {
    tripped.push(`${req.method} ${req.headers.host}${req.url}`)
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end('{"message":"tripwire: a real service would have been called"}')
  })
  await new Promise((r) => trip.listen(TRIP_PORT, '127.0.0.1', r))
  app = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: new URL('../..', import.meta.url).pathname,
    env: {
      ...process.env,
      ADMIN_DEMO: 'on',
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SECRET_TOKEN: TOKEN,
      WEBSITE_CARE_ENABLED: '',
      NEXT_PUBLIC_SUPABASE_URL: TRIP,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'tripwire',
      SUPABASE_SERVICE_ROLE_KEY: 'tripwire',
      RESEND_API_KEY: 're_tripwire',
      RESEND_BASE_URL: TRIP,
      ZOOM_OAUTH_BASE: TRIP,
      ZOOM_API_BASE: TRIP,
      ZOOM_CLIENT_ID: 'x', ZOOM_CLIENT_SECRET: 'x', ZOOM_ACCOUNT_ID: 'x',
      STRIPE_SECRET_KEY: 'sk_test_tripwire',
      STRIPE_API_BASE: TRIP,
      CARE_GITHUB_DISPATCH_TOKEN: 'tripwire',
      CARE_GITHUB_REPO: 'example/tripwire',
      CARE_GITHUB_API_BASE: TRIP,
      ...env,
    },
    stdio: process.env.STACK_LOG ? 'inherit' : 'ignore',
    detached: true,
  })
  for (let i = 0; i < 180; i++) {
    try { const r = await fetch(APP + '/admin/login'); if (r.status) break } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
}

export async function stopDemo() {
  if (app) try { process.kill(-app.pid) } catch { /* gone */ }
  trip?.close()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startDemo()
  console.log(`Admin demo at ${APP}/admin (password ${PASSWORD})`)
  process.on('SIGINT', async () => { await stopDemo(); console.log('tripwire hits:', tripped); process.exit(0) })
}
