// Fixture websites for Website Care tests, chosen by Host header.
// http on :4500, https (self signed, so TLS checks fail) on :4443.
// Every request is logged so tests can prove the checker stayed read only
// and never reached blocked addresses.
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'

const log = []
const fixed = new Set()
const DIR = (process.env.CARE_FX_CERT_DIR || new URL('.', import.meta.url).pathname).replace(/\/?$/, '/')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const page = (title, body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:sans-serif;margin:0;padding:20px}</style>${extra}</head><body>${body}</body></html>`

const sites = {
  'good.fixture.test': (path, res) => {
    const nav = `<nav><a href="/">Home</a> <a href="/services">Services</a> <a href="/contact">Contact</a> <a href="/about">About</a> <a href="http://book.fixture.test:4500/">Book</a></nav>`
    if (path === '/' || path === '/services' || path === '/contact' || path === '/about') {
      return html(res, 200, page(`Good ${path}`, `${nav}<h1>Sunrise Bakery ${path}</h1><img src="/img/logo.png" alt="logo"><p>Open 7am to 3pm.</p>${path === '/contact' ? '<form method="post" action="/contact"><input name="email"><button>Send</button></form>' : ''}`))
    }
    if (path === '/img/logo.png') return img(res)
    return html(res, 404, page('Not found', 'Not found'))
  },
  'broken.fixture.test': (path, res) => {
    const nav = `<nav><a href="/">Home</a> <a href="/gone-page">Old link</a> <a href="/logout">Log out</a> <a href="/cart/add?id=4">Add</a> <a href="/team">Team</a></nav>`
    if (path === '/') return html(res, 200, page('Broken home', `${nav}<h1>Home</h1><img src="/img/missing.png" alt="x"><img src="http://127.0.0.1:4500/secret.png" alt="private"><img src="http://169.254.169.254/latest/meta-data/" alt="meta"><img src="http://rebind.fixture.test/pixel.png" alt="rebind"><div style="width:700px;background:#eee">wide box</div>
      <form method="post" action="/subscribe"><input name="e"></form>
      <script>fetch('/api/track',{method:'POST',body:'x'}).catch(()=>{});try{new WebSocket('ws://broken.fixture.test:4500/ws')}catch(e){};navigator.sendBeacon&&navigator.sendBeacon('/beacon','x')</script>`))
    if (path === '/team') return html(res, 200, page('Team', `${nav}<h1>Team</h1>`))
    if (fixed.has(path)) return html(res, 200, page('Restored', `${nav}<h1>Restored page</h1>`))
    if (path === '/missing-page') return html(res, 404, page('Not found', '<h1>404</h1>'))
    if (path === '/loop') { res.writeHead(302, { location: '/loop2' }); return res.end() }
    if (path === '/loop2') { res.writeHead(302, { location: '/loop' }); return res.end() }
    if (path === '/moved') { res.writeHead(301, { location: 'http://elsewhere.fixture.test:4500/' }); return res.end() }
    if (path === '/err') return html(res, 500, page('Error', 'Server error'))
    if (path === '/logout' || path.startsWith('/cart')) return html(res, 200, page('DANGER', 'this should never be requested'))
    return html(res, 404, page('Not found', 'Not found'))
  },
  'elsewhere.fixture.test': (path, res) => html(res, 200, page('Elsewhere', '<h1>Different site</h1>')),
  'bot.fixture.test': (path, res) => html(res, 403, page('Just a moment...', '<h1>Checking your browser</h1><p>Please complete the captcha</p>')),
  'slow.fixture.test': (path, res) => setTimeout(() => html(res, 200, page('Slow', 'finally')), 60000),
  'book.fixture.test': (path, res) => html(res, 200, page('Book a time', '<h1>Pick a time</h1><form method="post" action="/book"><button>Book</button></form>')),
  'tls.fixture.test': (path, res) => html(res, 200, page('TLS', '<h1>Secure?</h1>')),
}

function html(res, status, body) { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }); res.end(body) }
function img(res) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(PNG) }

function handler(req, res) {
  const host = String(req.headers.host || '').split(':')[0]
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/__log') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(log)) }
  if (url.pathname === '/__reset') { log.length = 0; fixed.clear(); res.writeHead(200); return res.end('ok') }
  if (url.pathname === '/__fix') { fixed.add(url.searchParams.get('path')); res.writeHead(200); return res.end('ok') }
  log.push({ method: req.method, host, path: url.pathname + url.search, ua: req.headers['user-agent'] || '', t: Date.now() })
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(200); return res.end('write received') }
  const site = sites[host]
  if (!site) return html(res, 404, page('Unknown host', host))
  site(url.pathname, res)
}

const srv = http.createServer(handler)
srv.on('upgrade', (req, socket) => { log.push({ method: 'UPGRADE', host: req.headers.host, path: req.url }); socket.destroy() })
srv.listen(4500, '127.0.0.1')
https.createServer({ key: fs.readFileSync(DIR + 'fx.key'), cert: fs.readFileSync(DIR + 'fx.crt') }, handler).listen(4443, '127.0.0.1')
console.log('fixtures on :4500 and :4443')
