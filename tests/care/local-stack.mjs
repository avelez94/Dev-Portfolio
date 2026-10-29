/**
 * Runs the Website Care admin end to end on this machine only: a throwaway
 * PostgreSQL with the pending migrations, the local REST stand-in, seed data
 * for one fictional client, and `next dev` with Website Care switched on and
 * pointed at those local services. Nothing connects to the shared database,
 * Stripe, Resend, or GitHub.
 *
 *   node tests/care/local-stack.mjs        start it and leave it running (Ctrl+C stops)
 */
import { spawn } from 'node:child_process'
import { startDb, stopDb, sql, one, q } from './pg.mjs'
import { startRestShim } from './rest-shim.mjs'

export const ADMIN_TOKEN = 'care-local-admin'
export const APP_PORT = Number(process.env.CARE_APP_PORT || 3230)
export const APP = `http://localhost:${APP_PORT}`
const REST_PORT = 55990

/** One client on Business Care with a current paid period, a completed check, and some recorded work. */
export function seed() {
  const client = one(`insert into clients (name, email, business) values ('Sam Patel', 'frontdesk@example.com', 'Northside Physio') returning id`).id
  const site = one(`insert into care_sites (client_id, label, site_url, approved_domains, plan, agreed_monthly_price, enrollment_status, pages, destinations, manual_checklist, recipient_name, recipient_email, confirmed_at, care_terms_version, care_terms_note, care_terms_reviewed_at)
    values (${q(client)}, 'Northside Physio', 'https://physio.example.com/', '{physio.example.com}', 'business', 129, 'confirmed',
      '[{"label":"Home","url":"https://physio.example.com/"},{"label":"Team","url":"https://physio.example.com/team"}]',
      '[{"label":"Online booking","url":"https://booking.example.com/northside","kind":"booking"}]',
      '[{"id":"visual","label":"Desktop appearance looks right","category":"Visual"}]',
      'Sam Patel', 'frontdesk@example.com', now(), 'care-flex-2026-11', 'Signed care agreement, Oct 1', now()) returning id`).id
  const cycle = one(`insert into care_cycles (site_id, source, period_start, period_end, plan, review_due_at, included_minutes, agreed_price, scan_state)
    values (${q(site)}, 'manual', date_trunc('day', now()) - interval '4 days', date_trunc('day', now()) + interval '26 days', 'business', now() + interval '3 days', 30, 129, 'done') returning id`).id
  sql(`insert into care_reports (cycle_id, content) values (${q(cycle)}, '{"summary":"One issue needs your approval: the team page doesn’t fit phone screens."}')`)
  sql(`insert into care_manual_results (cycle_id, item_id, label, category, status, note, confirmed_at) values (${q(cycle)}, 'visual', 'Desktop appearance looks right', 'Visual', 'passed', 'Checked on a laptop.', now())`)
  const run = one(`insert into care_scan_runs (cycle_id, site_id, trigger, status, config, started_at, finished_at)
    values (${q(cycle)}, ${q(site)}, 'scheduled', 'succeeded', '{"pages":[{"label":"Home","url":"https://physio.example.com/"},{"label":"Team","url":"https://physio.example.com/team"}],"destinations":[{"label":"Online booking","url":"https://booking.example.com/northside","kind":"booking"}]}', now() - interval '1 hour', now() - interval '50 minutes') returning id`).id
  const f = (check, code, status, url, viewport, evidence = '{}') => sql(`insert into care_findings (run_id, cycle_id, site_id, check_key, issue_code, fingerprint, url, viewport, status, observed, explanation, evidence, checked_at)
    values (${q(run)}, ${q(cycle)}, ${q(site)}, ${q(check)}, ${q(code)}, ${q(check + code + url + viewport)}, ${q(url)}, ${q(viewport)}, ${q(status)}, 'seeded', 'seeded', ${q(evidence)}::jsonb, now())`)
  for (const u of ['https://physio.example.com/', 'https://physio.example.com/team']) for (const k of ['page_load', 'https', 'images']) f(k, 'ok', 'passed', u, 'desktop')
  f('overflow', 'ok', 'passed', 'https://physio.example.com/', 'mobile')
  f('overflow', 'overflow', 'failed', 'https://physio.example.com/team', 'mobile', '{"overflow_px":212}')
  f('internal_links', 'ok', 'passed', 'https://physio.example.com/', null)
  f('destination', 'blocked_by_site', 'could_not_check', 'https://booking.example.com/northside', 'desktop', '{"http_status":403}')
  sql(`insert into care_issue_notes (cycle_id, group_key, resolution, client_note) values (${q(cycle)}, 'overflow:overflow', 'approval', 'the team section rebuild (estimate below)')`)
  // A second client enrolled before the flexible time terms, to show the review flag.
  const c2 = one(`insert into clients (name, email, business) values ('Jordan Reyes', 'owner@example.com', 'Harbor Street Bakery') returning id`).id
  sql(`insert into care_sites (client_id, label, site_url, approved_domains, plan, agreed_monthly_price, enrollment_status, recipient_email) values (${q(c2)}, 'Harbor Street Bakery', 'https://www.example.com/', '{example.com}', 'premium', 239, 'confirmed', 'owner@example.com')`)
  return { client, site, cycle }
}

let app = null
let shim = null

export async function startStack({ seedData = true } = {}) {
  await startDb()
  const ids = seedData ? seed() : null
  shim = await startRestShim(REST_PORT)
  app = spawn('npx', ['next', 'dev', '-p', String(APP_PORT)], {
    cwd: new URL('../..', import.meta.url).pathname,
    env: {
      ...process.env,
      WEBSITE_CARE_ENABLED: 'true',
      ADMIN_SECRET_TOKEN: ADMIN_TOKEN,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${REST_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local',
      SUPABASE_SERVICE_ROLE_KEY: 'local',
      RESEND_API_KEY: 're_local_unused',
      STRIPE_SECRET_KEY: '',
      CARE_CLIENT_EMAIL_LIVE: 'false',
      CARE_EMAIL_ALLOWLIST: '',
    },
    stdio: process.env.STACK_LOG ? 'inherit' : 'ignore',
    detached: true,
  })
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch(APP + '/admin/login'); if (r.status) break } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return ids
}

export async function stopStack() {
  if (app) try { process.kill(-app.pid) } catch { /* gone */ }
  shim?.close()
  stopDb()
}

export async function api(path, init = {}) {
  const res = await fetch(`${APP}/api/care/admin/${path}`, {
    ...init,
    headers: { cookie: `admin_token=${ADMIN_TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = await startStack()
  console.log(`Website Care local stack at ${APP}/admin/care (cookie admin_token=${ADMIN_TOKEN})`, ids)
  process.on('SIGINT', async () => { await stopStack(); process.exit(0) })
}
