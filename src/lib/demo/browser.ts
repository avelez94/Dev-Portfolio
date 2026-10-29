/**
 * Browser half of the admin demo. Once installed, every admin API request the
 * dashboard makes (fetch, including the Supabase client, and links to admin
 * API files such as report PDFs) goes to /api/demo with this session's demo
 * state instead of the real route. The state lives in this browser only
 * (localStorage, one key per sign in), so each demo session is separate and
 * Reset demo starts again from the original fictional data.
 */
import { REAL_ADMIN_API } from './mode'

type Entry = { at: string; kind: string; summary: string; detail?: Record<string, unknown> }
type State = { v: 1; created: string; log: Entry[]; [k: string]: unknown }

const PREFIX = 'admin-demo-state:'
const w = (typeof window === 'undefined' ? {} : window) as Window & { __demoFetch?: boolean }
let state: State | null = null
let loaded = false
let queue: Promise<unknown> = Promise.resolve()
let storageOk = true
let generation = 0 // bumped by Reset demo, so answers to earlier requests can't bring old data back
const listeners = new Set<() => void>()

function sessionId() {
  const m = document.cookie.match(/(?:^|;\s*)admin_demo_sid=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : 'default'
}

function load() {
  if (loaded) return
  loaded = true
  const key = PREFIX + sessionId()
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX) && k !== key) localStorage.removeItem(k) // an earlier sign in's demo
    }
    const raw = localStorage.getItem(key)
    state = raw ? JSON.parse(raw) : null
  } catch {
    state = null
  }
}

function save(next: State | null) {
  state = next
  try {
    if (next) localStorage.setItem(PREFIX + sessionId(), JSON.stringify(next))
    else localStorage.removeItem(PREFIX + sessionId())
    storageOk = true
  } catch {
    storageOk = false // kept in memory for this tab only
  }
  listeners.forEach((f) => f())
}

export function demoInfo() {
  return { log: state?.log || [], started: state?.created || null, persisted: storageOk }
}

export function onDemoChange(f: () => void) {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

/** Throws away this session's demo changes. The next request starts from the original fictional data. */
export function resetDemo() {
  generation++
  save(null)
}

function toB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromB64(b64: string) {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const PASS_HEADERS = ['content-type', 'accept', 'prefer', 'range', 'x-upsert', 'accept-profile', 'content-profile']

async function viaDemo(real: typeof fetch, req: Request): Promise<Response> {
  load()
  const gen = generation
  const u = new URL(req.url)
  const headers: Record<string, string> = {}
  for (const h of PASS_HEADERS) { const v = req.headers.get(h); if (v) headers[h] = v }
  const body = ['GET', 'HEAD'].includes(req.method) ? '' : toB64(await req.arrayBuffer())
  const res = await real('/api/demo', {
    method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ state, request: { method: req.method, path: u.pathname, search: u.search, headers, body } }),
  })
  if (!res.ok) return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } })
  const out = await res.json()
  if (gen === generation) save(out.state)
  const r = out.response as { status: number; headers: Record<string, string>; body: string }
  const empty = req.method === 'HEAD' || [204, 205, 304].includes(r.status)
  return new Response(empty ? null : fromB64(r.body), { status: r.status, headers: r.headers })
}

function isAdminApi(u: URL) {
  return u.origin === window.location.origin && REAL_ADMIN_API.test(u.pathname)
}

/** Opens or downloads an admin API file (a report PDF, a screenshot) through the demo. */
async function openViaDemo(a: HTMLAnchorElement, real: typeof fetch) {
  const tab = a.target === '_blank' ? window.open('', '_blank') : null
  const res = await queued(() => viaDemo(real, new Request(a.href)))
  if (!res.ok) {
    tab?.close()
    window.alert('The demo couldn’t open that file.')
    return
  }
  const url = URL.createObjectURL(await res.blob())
  const download = a.hasAttribute('download') || new URL(a.href).searchParams.get('download') === '1'
  if (download) {
    const name = (res.headers.get('content-disposition') || '').match(/filename="?([^";]+)/)?.[1] || 'demo-file'
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    tab?.close()
  } else if (tab) tab.location.href = url
  else window.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function queued<T>(f: () => Promise<T>): Promise<T> {
  const run = queue.then(f, f)
  queue = run.catch(() => {})
  return run
}

export function installDemoFetch() {
  if (typeof window === 'undefined' || w.__demoFetch) return
  w.__demoFetch = true
  const real = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init)
    if (!isAdminApi(new URL(req.url))) return real(input, init)
    return queued(() => viaDemo(real, req))
  }
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    if (!isAdminApi(new URL(a.href))) return
    e.preventDefault()
    void openViaDemo(a, real)
  }, true)
}
