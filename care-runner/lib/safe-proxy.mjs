/**
 * A tiny local forward proxy that every browser request goes through
 * (Chromium is launched with this proxy and with loopback bypass removed).
 * It resolves each host itself, refuses private, reserved, and non standard
 * port destinations, and connects to the exact address it checked. Plain HTTP
 * requests other than GET, HEAD, and OPTIONS are refused here as well.
 */
import http from 'node:http'
import net from 'node:net'
import { resolveSafe } from './ip-guard.mjs'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function startProxy() {
  const blocked = []
  const note = (url, reason) => { if (blocked.length < 200) blocked.push({ url: String(url).slice(0, 300), reason }) }

  const server = http.createServer(async (req, res) => {
    let u
    try { u = new URL(req.url) } catch { res.writeHead(400).end(); return }
    if (u.protocol !== 'http:') { res.writeHead(403).end(); return }
    if (!SAFE_METHODS.has(req.method)) { note(u, `blocked ${req.method} request (checks are read only)`); res.writeHead(403).end('read only'); return }
    const port = Number(u.port || 80)
    const r = await resolveSafe(u.hostname, port)
    if (!r.ok) { note(u, r.reason); res.writeHead(r.dns ? 502 : 403, { 'x-care-blocked': r.reason }).end(`blocked: ${r.reason}`); return }
    const headers = { ...req.headers, host: u.host }
    delete headers['proxy-connection']
    delete headers['proxy-authorization']
    const up = http.request({ host: r.address, family: r.family, port, method: req.method, path: u.pathname + u.search, headers, timeout: 30000 }, (ur) => {
      res.writeHead(ur.statusCode || 502, ur.headers)
      ur.pipe(res)
    })
    up.on('timeout', () => up.destroy(new Error('timeout')))
    up.on('error', () => { if (!res.headersSent) res.writeHead(502).end(); else res.destroy() })
    req.pipe(up)
  })

  server.on('connect', async (req, socket, head) => {
    const [hostRaw, portRaw] = String(req.url).split(/:(?=\d+$)/)
    const port = Number(portRaw || 443)
    const r = await resolveSafe(hostRaw, port)
    if (!r.ok) {
      note(`https://${hostRaw}:${port}`, r.reason)
      socket.end(`HTTP/1.1 403 Forbidden\r\nx-care-blocked: ${r.reason}\r\n\r\n`)
      return
    }
    const up = net.connect({ host: r.address, port, family: r.family, timeout: 30000 }, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head?.length) up.write(head)
      up.pipe(socket)
      socket.pipe(up)
    })
    up.on('timeout', () => up.destroy())
    up.on('error', () => socket.destroy())
    socket.on('error', () => up.destroy())
  })

  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  return { port: server.address().port, blocked, close: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(ok) }) }
}
