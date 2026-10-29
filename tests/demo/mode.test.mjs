/** When demo mode is on: previews by default, never production, and the routes it closes. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demoDeployment, REAL_ADMIN_API } from '../../src/lib/demo/mode.ts'

function withEnv(env, fn) {
  const keep = { VERCEL_ENV: process.env.VERCEL_ENV, ADMIN_DEMO: process.env.ADMIN_DEMO }
  for (const k of Object.keys(keep)) delete process.env[k]
  Object.assign(process.env, env)
  try { return fn() } finally { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
}

test('demo mode is on for previews, opt in elsewhere, and never on production', () => {
  assert.equal(withEnv({ VERCEL_ENV: 'preview' }, demoDeployment), true)
  assert.equal(withEnv({ VERCEL_ENV: 'preview', ADMIN_DEMO: 'off' }, demoDeployment), false)
  assert.equal(withEnv({}, demoDeployment), false)
  assert.equal(withEnv({ ADMIN_DEMO: 'on' }, demoDeployment), true)
  assert.equal(withEnv({ VERCEL_ENV: 'production' }, demoDeployment), false)
  assert.equal(withEnv({ VERCEL_ENV: 'production', ADMIN_DEMO: 'on' }, demoDeployment), false)
})

test('the real admin API routes are recognised; public routes are not', () => {
  for (const p of ['/api/admin/data/rest/v1/clients', '/api/care/admin/overview', '/api/invoices/send', '/api/email/send', '/api/meetings/schedule', '/api/proposals', '/api/sows', '/api/contracts', '/api/contracts/send-signed', '/api/debt-payoff']) assert.ok(REAL_ADMIN_API.test(p), p)
  for (const p of ['/api/demo', '/api/admin/auth', '/api/proposals/abc', '/api/contracts/abc', '/api/bookings', '/api/availability', '/api/care/cron', '/api/care/stripe/webhook', '/api/intake/submit']) assert.ok(!REAL_ADMIN_API.test(p), p)
})
