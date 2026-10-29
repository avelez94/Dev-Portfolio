#!/usr/bin/env node
/**
 * Website Care check runner. Leases queued checks from the app, runs them
 * read only, uploads screenshots, and reports results. Safe to run on a
 * schedule: with nothing queued it exits right away, and with the app or token
 * not configured it exits without doing anything.
 *
 * Env: CARE_APP_URL, CARE_RUNNER_TOKEN, optional CARE_RUNNER_MAX_RUNS (default 5).
 */
import { randomBytes } from 'node:crypto'
import { startProxy } from './lib/safe-proxy.mjs'
import { runChecks } from './lib/checks.mjs'
import { testHosts } from './lib/ip-guard.mjs'

const APP = (process.env.CARE_APP_URL || '').replace(/\/$/, '')
const TOKEN = process.env.CARE_RUNNER_TOKEN || ''
const MAX_RUNS = Math.max(1, Math.min(10, Number(process.env.CARE_RUNNER_MAX_RUNS) || 5))
const OWNER = `${process.env.GITHUB_RUN_ID ? 'gha-' + process.env.GITHUB_RUN_ID : 'local'}-${randomBytes(4).toString('hex')}`

if (!APP || !TOKEN) {
  console.log('Website Care runner is not configured (CARE_APP_URL / CARE_RUNNER_TOKEN). Nothing to do.')
  process.exit(0)
}
testHosts() // throws in GitHub Actions if the local test override is set

async function api(path, body, opts = {}) {
  const r = await fetch(`${APP}/api/care/runner/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': opts.type || 'application/json' },
    body: opts.raw ?? JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout || 30000),
  })
  if (r.status === 204) return null
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch { data = { error: text.slice(0, 200) } }
  if (!r.ok) throw Object.assign(new Error(data.error || `HTTP ${r.status}`), { status: r.status })
  return data
}

async function processRun(run) {
  console.log(`Run ${run.id}: ${run.config.site_url} (attempt ${run.attempts})`)
  const proxy = await startProxy()
  let lastBeat = 0
  let lost = false
  const ctx = {
    proxy,
    deadline: Date.now() + run.config.limits.runTimeoutMs,
    async progress(done, total, step) {
      if (Date.now() - lastBeat < 8000) return {}
      lastBeat = Date.now()
      try {
        const r = await api(`runs/${run.id}/heartbeat`, { owner: OWNER, progress: { done, total, step } })
        if (!r.ok) { lost = true; return { lost: true } }
        return { cancel: r.cancel }
      } catch (e) {
        console.warn('heartbeat failed:', e.message)
        return {}
      }
    },
    async upload(name, buf) {
      const r = await api(`runs/${run.id}/evidence?owner=${encodeURIComponent(OWNER)}&name=${encodeURIComponent(name)}`, null, { raw: buf, type: 'image/jpeg', timeout: 60000 })
      return r.path
    },
  }
  try {
    await ctx.progress(0, 1, 'starting')
    const { findings, stopped } = await runChecks(run.config, ctx)
    if (lost || stopped === 'lease lost') { console.warn('Lease lost; not reporting.'); return }
    const outcome = stopped === 'canceled' ? 'canceled' : stopped ? 'partial' : 'succeeded'
    const res = await api(`runs/${run.id}/complete`, { owner: OWNER, outcome, findings, error: stopped ? `Stopped: ${stopped}` : null, notes: `${findings.length} results` }, { timeout: 60000 })
    console.log(`Run ${run.id}: ${res.status}`, JSON.stringify(res.summary?.counts || {}))
  } catch (e) {
    console.error(`Run ${run.id} crashed:`, e.message)
    await api(`runs/${run.id}/complete`, { owner: OWNER, outcome: 'failed', retryable: true, error: `Runner error: ${String(e.message).slice(0, 300)}`, findings: [] }).catch((x) => console.error('could not report failure:', x.message))
  } finally {
    await proxy.close()
  }
}

let n = 0
while (n < MAX_RUNS) {
  let claim
  try {
    claim = await api('claim', { owner: OWNER })
  } catch (e) {
    console.error('claim failed:', e.message)
    process.exitCode = 1
    break
  }
  if (!claim) break
  await processRun(claim.run)
  n++
}
console.log(n ? `Processed ${n} check(s).` : 'No checks waiting.')
