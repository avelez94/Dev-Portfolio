/**
 * Read only HTTP checks for links, with the same address rules as the proxy.
 * Redirects are followed by hand so every hop is validated.
 */
import http from 'node:http'
import https from 'node:https'
import { resolveSafe } from './ip-guard.mjs'

function once(url, method, timeoutMs, ua) {
  return new Promise(async (done) => {
    const u = new URL(url)
    const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80))
    const r = await resolveSafe(u.hostname, port)
    if (!r.ok) return done({ blocked: r.reason, dns: r.dns })
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request({
      host: u.hostname, port, method, path: u.pathname + u.search, servername: u.hostname,
      // Connect to the exact address that was checked (no second DNS lookup).
      lookup: (_h, o, cb) => (o && o.all ? cb(null, [{ address: r.address, family: r.family }]) : cb(null, r.address, r.family)),
      headers: { 'user-agent': ua, accept: 'text/html,*/*;q=0.8' },
      timeout: timeoutMs,
    }, (res) => {
      res.resume()
      res.destroy()
      done({ status: res.statusCode, location: res.headers.location, type: res.headers['content-type'] })
    })
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })))
    req.on('error', (e) => done({ error: e.code || e.message }))
    req.end()
  })
}

export async function checkLink(url, { timeoutMs = 10000, ua, maxHops = 6 } = {}) {
  const chain = []
  let current = url
  for (let hop = 0; hop <= maxHops; hop++) {
    let r = await once(current, 'HEAD', timeoutMs, ua)
    if (r.status === 405 || r.status === 501 || r.status === 403) {
      const g = await once(current, 'GET', timeoutMs, ua)
      if (g.status) r = g
    }
    if (r.blocked || r.error) return { ...r, chain, final: current }
    if (r.status >= 300 && r.status < 400 && r.location) {
      const next = new URL(r.location, current).toString()
      if (!/^https?:/.test(next)) return { status: r.status, chain, final: next, error: 'redirect to a non web address' }
      chain.push(current)
      if (chain.includes(next)) return { status: r.status, chain, final: next, loop: true }
      current = next
      continue
    }
    return { status: r.status, chain, final: current, type: r.type }
  }
  return { chain, final: current, loop: true }
}
