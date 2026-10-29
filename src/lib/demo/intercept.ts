/**
 * Keeps demo requests inside the demo. While a request runs in the demo scope
 * (context.ts), every outbound call is answered here instead of leaving the
 * server:
 *
 *   database and storage (any rest/v1 or storage/v1 address)    the demo database
 *   email (Resend)                                                   simulated and logged
 *   Zoom meetings                                                    simulated and logged
 *   starting the check runner (GitHub)                               simulated and logged
 *   DNS lookups for website addresses                                answered with example.com's address
 *   anything else, including Stripe and raw http(s) connections      refused and logged
 *
 * Requests outside the demo scope pass through untouched. Installed once, by
 * the demo route only, and never on a production deployment.
 */
import 'server-only'
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import { randomUUID } from 'node:crypto'
import { demoScope, type DemoLogEntry, type DemoScope } from './context'
import { demoDeployment } from './mode'
import { rest, storage } from './rest'

const g = globalThis as typeof globalThis & { __demoIntercept?: boolean }

function note(scope: DemoScope, kind: DemoLogEntry['kind'], summary: string, detail?: Record<string, unknown>) {
  scope.log.push({ at: new Date().toISOString(), kind, summary, detail })
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v ?? ''))

function host(base: string | undefined, fallback: string) {
  try { return new URL(base || fallback).host } catch { return new URL(fallback).host }
}

async function answer(scope: DemoScope, req: Request): Promise<Response> {
  const url = new URL(req.url)
  const raw = Buffer.from(await req.arrayBuffer())
  const parts = url.pathname.split('/').filter(Boolean)
  const ri = parts.findIndex((p, i) => (p === 'rest' || p === 'storage') && parts[i + 1] === 'v1')
  if (ri >= 0) {
    const r = parts[ri] === 'rest'
      ? await rest(scope, req.method, parts.slice(ri + 2).map(decodeURIComponent), url.searchParams, req.headers, raw)
      : await storage(scope, req.method, parts.slice(ri + 2), req.headers, raw)
    return new Response(r.status === 204 || req.method === 'HEAD' ? null : (r.body ?? '') as BodyInit, { status: r.status, headers: r.headers })
  }

  if (url.host === host(process.env.RESEND_BASE_URL, 'https://api.resend.com')) {
    const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
    const mails = url.pathname.endsWith('/batch') && Array.isArray(body) ? body : [body]
    const ids = mails.map((m: Record<string, unknown>) => {
      const mid = `demo_${randomUUID()}`
      note(scope, 'email', `Email to ${list(m.to)}: ${m.subject ?? '(no subject)'}`, { id: mid, to: m.to, cc: m.cc, subject: m.subject, text: typeof m.text === 'string' ? m.text.slice(0, 6000) : undefined, attachments: Array.isArray(m.attachments) ? m.attachments.length : 0 })
      return { id: mid }
    })
    return json(mails.length === 1 && !Array.isArray(body) ? ids[0] : { data: ids })
  }

  if (url.host === host(process.env.ZOOM_OAUTH_BASE, 'https://zoom.us') && url.pathname.startsWith('/oauth/')) return json({ access_token: 'demo-zoom-token', expires_in: 3600 })
  if (url.host === host(process.env.ZOOM_API_BASE, 'https://api.zoom.us')) {
    const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
    const mid = Math.floor(80_000_000_000 + Math.random() * 9_000_000_000)
    note(scope, 'meeting', `Zoom meeting: ${body.topic || 'meeting'} at ${body.start_time || 'the chosen time'}`, { id: mid })
    return json({ id: mid, join_url: `https://demo.invalid/zoom/join/${mid}`, start_url: `https://demo.invalid/zoom/host/${mid}` }, 201)
  }

  if (url.host === host(process.env.CARE_GITHUB_API_BASE, 'https://api.github.com') && url.pathname.includes('/dispatches')) {
    note(scope, 'scan', 'Check runner start requested (simulated; the demo runner answers instead)')
    return new Response(null, { status: 204 })
  }

  note(scope, 'blocked', `Blocked outbound request to ${url.host}`, { method: req.method, path: url.pathname })
  throw new TypeError(`fetch failed: ${url.host} is not reachable from the demo`)
}

export function installDemoIntercept() {
  if (g.__demoIntercept || !demoDeployment()) return
  g.__demoIntercept = true

  const realFetch = globalThis.fetch
  const demoFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const scope = demoScope.getStore()
    if (!scope) return realFetch(input, init)
    return answer(scope, new Request(input, init))
  }
  globalThis.fetch = demoFetch as typeof fetch

  // Libraries that skip fetch (the Stripe SDK uses node:https) are refused outright.
  for (const mod of [http, https] as unknown as Record<string, (...a: unknown[]) => unknown>[]) {
    for (const fn of ['request', 'get']) {
      const real = mod[fn]
      mod[fn] = function (this: unknown, ...args: unknown[]) {
        const scope = demoScope.getStore()
        if (!scope) return real.apply(this, args)
        const target = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].host : (args[0] as { host?: string; hostname?: string })?.hostname || (args[0] as { host?: string })?.host
        note(scope, 'blocked', `Blocked outbound connection to ${target || 'a service'}`)
        throw new Error('Outside services are simulated in the demo; this connection was refused.')
      }
    }
  }

  // Website address checks resolve to example.com's public address without asking DNS.
  const realLookup = dns.promises.lookup as (hostname: string, opts?: unknown) => Promise<unknown>
  ;(dns.promises as { lookup: unknown }).lookup = (async (hostname: string, opts?: { all?: boolean }) => {
    if (!demoScope.getStore()) return realLookup(hostname, opts)
    const addr = { address: '93.184.215.14', family: 4 }
    return opts?.all ? [addr] : addr
  }) as unknown
}
