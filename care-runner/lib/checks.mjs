/**
 * Bounded, read only website checks with Playwright (Chromium).
 *
 * The browser never types, clicks, submits, books, pays, or signs in. Every
 * request goes through the local guard proxy; requests other than GET, HEAD,
 * and OPTIONS are aborted; WebSockets are closed; service workers, downloads,
 * popups, and dialogs are blocked or dismissed.
 *
 * Results are observations. Possible causes are labeled as possible, and
 * blocked crawlers, CAPTCHA pages, timeouts, and unreachable third parties are
 * reported as "could not check", never as defects.
 */
import { chromium } from 'playwright'
import { checkLink } from './safe-fetch.mjs'
import { hostInDomains } from './ip-guard.mjs'

export const UA_SUFFIX = 'AlanteVelezWebsiteCare/1.0 (+https://alantevelez.com/care; read only monthly check)'
const RISKY_LINK = /(log ?out|sign ?out|signout|logout|delete|remove|unsubscribe|add[-_]?to[-_]?cart|cart\/add|checkout|confirm|cancel|wp-admin|wp-login|\/admin|\/account|\/login)/i
const BOT_WALL = /(captcha|are you a robot|verify you are human|just a moment|attention required|access denied|cf-chl|challenge-platform|perimeterx|datadome)/i

const now = () => new Date().toISOString()
const pathOf = (u) => { try { const x = new URL(u); return (x.pathname.replace(/\/+$/, '') || '/') + x.search } catch { return u } }
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase() } catch { return '' } }

function sameishRedirect(from, to) {
  try {
    const a = new URL(from), b = new URL(to)
    const strip = (h) => h.replace(/^www\./, '')
    return strip(a.hostname) === strip(b.hostname) && pathOf(from) === pathOf(to)
  } catch { return false }
}

function netError(msg) {
  const m = String(msg || '').match(/net::(ERR_[A-Z_]+)/)
  return m ? m[1] : /Timeout/i.test(msg) ? 'TIMEOUT' : null
}

/** Plain language for a navigation error. Returns a finding shape without url/viewport. */
function describeNavError(code, blockedReason, checkKey = 'page_load') {
  if (blockedReason) return { check_key: checkKey, status: 'could_not_check', observed: `The check refused to open this address (${blockedReason}).`, explanation: 'For safety the checker only opens public web addresses. Nothing was confirmed for this page.', next_action: 'Confirm the address in the website settings and check the page by hand.' }
  if (!code) return { check_key: checkKey, status: 'could_not_check', observed: 'The page did not finish loading.', explanation: 'The checker could not confirm whether the page works.', next_action: 'Open the page by hand.' }
  if (code === 'TIMEOUT' || code === 'ERR_TIMED_OUT') return { check_key: checkKey, status: 'could_not_check', observed: 'The page took too long to respond.', explanation: 'A timeout is not proof of a problem. The site may be slow or may limit automated visitors.', next_action: 'Open the page by hand and note how long it takes.' }
  if (code.startsWith('ERR_CERT') || code === 'ERR_SSL_PROTOCOL_ERROR' || code === 'ERR_BAD_SSL_CLIENT_AUTH_CERT') return { check_key: 'https', status: 'failed', observed: `The secure connection failed (${code}).`, explanation: 'Visitors may see a security warning instead of the page.', possible_cause: 'An expired, missing, or mismatched security certificate.', next_action: 'Check the certificate in a browser and with the hosting provider.' }
  if (code === 'ERR_TOO_MANY_REDIRECTS') return { check_key: 'redirects', status: 'failed', observed: 'The page keeps redirecting and never loads (redirect loop).', explanation: 'Visitors can’t reach this page.', possible_cause: 'Conflicting redirect or HTTPS settings.', next_action: 'Review redirect settings with the host or platform.' }
  if (code === 'ERR_NAME_NOT_RESOLVED') return { check_key: checkKey, status: 'needs_review', observed: 'The domain name could not be found.', explanation: 'This can mean a DNS change or an expired domain, or a temporary lookup problem.', next_action: 'Open the site by hand and check the domain registration.' }
  if (code === 'ERR_TUNNEL_CONNECTION_FAILED' || code === 'ERR_PROXY_CONNECTION_FAILED') return { check_key: checkKey, status: 'could_not_check', observed: 'The checker was not allowed to connect to this address.', explanation: 'For safety the checker only connects to public web addresses on standard ports.', next_action: 'Check the page by hand.' }
  if (code === 'ERR_CONNECTION_REFUSED' || code === 'ERR_CONNECTION_RESET' || code === 'ERR_CONNECTION_CLOSED' || code === 'ERR_EMPTY_RESPONSE') return { check_key: checkKey, status: 'needs_review', observed: `The server did not accept the connection (${code}).`, explanation: 'This can be a temporary outage or the server blocking automated visitors.', next_action: 'Open the page by hand.' }
  return { check_key: checkKey, status: 'could_not_check', observed: `The page did not load (${code}).`, explanation: 'The checker could not confirm whether the page works.', next_action: 'Open the page by hand.' }
}

async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  }))
  return out
}

/**
 * ctx: { proxy, upload(name, buffer) -> path, progress(done, total, step) -> { cancel }, deadline }
 */
export async function runChecks(config, ctx) {
  const findings = []
  const add = (f) => findings.push({ checked_at: now(), evidence: {}, ...f })
  const limits = config.limits
  const domains = config.approved_domains || []
  const pages = (config.pages || []).slice(0, limits.maxPages)
  const destinations = (config.destinations || []).slice(0, 10)
  const total = pages.length * 2 + destinations.length + limits.maxLinks
  let done = 0
  let stopped = null
  const tick = async (step) => {
    done++
    if (stopped) return
    if (Date.now() > ctx.deadline) { stopped = 'time limit'; return }
    const r = await ctx.progress(done, total, step)
    if (r?.cancel) stopped = 'canceled'
    if (r?.lost) stopped = 'lease lost'
  }

  const browser = await chromium.launch({
    proxy: { server: `http://127.0.0.1:${ctx.proxy.port}`, bypass: '<-loopback>' },
    args: ['--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--disable-background-networking', '--no-pings', '--disable-features=NetworkPrediction,Prerender2'],
  })
  const writeAttempts = []
  const links = new Map()

  async function newContext(kind) {
    const vp = config.viewports[kind]
    const context = await browser.newContext({
      viewport: vp, isMobile: kind === 'mobile', hasTouch: kind === 'mobile', deviceScaleFactor: 1,
      userAgent: (kind === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36') + ' ' + UA_SUFFIX,
      serviceWorkers: 'block', acceptDownloads: false, ignoreHTTPSErrors: false, permissions: [], geolocation: undefined,
      javaScriptEnabled: true, bypassCSP: false,
    })
    await context.route('**/*', (route) => {
      const r = route.request()
      const url = r.url()
      if (!/^(https?:|data:|blob:)/.test(url)) return route.abort('blockedbyclient')
      if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) {
        if (writeAttempts.length < 50) writeAttempts.push({ method: r.method(), url: url.slice(0, 200) })
        return route.abort('blockedbyclient')
      }
      return route.continue()
    })
    if (context.routeWebSocket) await context.routeWebSocket(/.*/, (ws) => ws.close())
    context.on('page', (p) => {
      p.on('dialog', (d) => d.dismiss().catch(() => {}))
      p.on('popup', (pp) => pp.close().catch(() => {}))
    })
    return context
  }

  async function visit(context, kind, target, checkKey) {
    const page = await context.newPage()
    const failedImages = []
    page.on('response', (resp) => {
      const req = resp.request()
      if (req.resourceType() === 'image' && resp.status() >= 400) {
        const guard = resp.headers()['x-care-blocked']
        failedImages.push(guard ? { url: resp.url(), error: `not opened: ${guard}`, guarded: true } : { url: resp.url(), status: resp.status() })
      }
    })
    page.on('requestfailed', (req) => {
      if (req.resourceType() === 'image') failedImages.push({ url: req.url(), error: req.failure()?.errorText || 'failed' })
    })
    const started = Date.now()
    let resp = null, err = null
    try {
      resp = await page.goto(target.url, { waitUntil: 'load', timeout: limits.navTimeoutMs })
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    } catch (e) {
      err = e
    }
    const result = { page, resp, err, ms: Date.now() - started, failedImages, kind }
    if (!err && resp) {
      const chain = []
      let r = resp.request()
      while (r.redirectedFrom()) { r = r.redirectedFrom(); chain.unshift(r.url()) }
      result.chain = chain
      result.finalUrl = page.url()
      try { result.title = (await page.title()).slice(0, 200) } catch { result.title = '' }
      try {
        result.text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 3000))
        result.overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
      } catch { result.text = ''; result.overflow = 0 }
    }
    return result
  }

  function blockedFor(url) {
    const h = hostOf(url)
    return ctx.proxy.blocked.find((b) => hostOf(b.url) === h)?.reason || null
  }

  function pageFindings(target, v, kind) {
    const base = { url: target.url, viewport: kind }
    if (v.err) {
      const code = netError(v.err.message)
      add({ ...base, ...describeNavError(code, blockedFor(target.url)), evidence: { error_code: code || 'NAVIGATION_FAILED', load_ms: v.ms } })
      return false
    }
    const status = v.resp?.status() ?? 0
    const ev = { http_status: status, final_url: v.finalUrl, load_ms: v.ms, redirect_chain: v.chain }
    const guard = v.resp?.headers()['x-care-blocked']
    if (guard) {
      add({ ...base, ...describeNavError(null, guard), evidence: { blocked_reason: guard, final_url: v.finalUrl } })
      return false
    }
    const wall = BOT_WALL.test(v.title || '') || (status === 403 || status === 429 || status === 503) && BOT_WALL.test(v.text || '')
    if (wall) {
      add({ ...base, check_key: 'page_load', status: 'could_not_check', observed: `The site showed a robot check or access page instead of the content (HTTP ${status}).`, explanation: 'Some sites block automated visitors. This is not a problem with the site for people.', next_action: 'Check the page by hand.', evidence: ev })
      return false
    }
    if (status >= 400) {
      const soft = status === 401 || status === 403 || status === 429
      add({ ...base, check_key: 'page_load', status: soft ? 'could_not_check' : status >= 500 ? 'needs_review' : 'failed', observed: `The page answered with HTTP ${status}.`,
        explanation: soft ? 'The site refused the automated visit. People may still see the page.' : status >= 500 ? 'The server reported an error. This can be temporary.' : 'Visitors following this link see an error page.',
        possible_cause: status === 404 || status === 410 ? 'The page was moved, renamed, or deleted.' : null,
        next_action: soft ? 'Check the page by hand.' : status >= 500 ? 'Open the page again later; if it persists, check the host.' : 'Restore the page or update links to its new address.', evidence: ev })
      return false
    }
    add({ ...base, check_key: 'page_load', status: 'passed', observed: `Loaded in ${(v.ms / 1000).toFixed(1)} seconds (HTTP ${status}).`, explanation: 'The page opened.', evidence: ev })

    // HTTPS
    const final = v.finalUrl || target.url
    if (target.url.startsWith('https:') && final.startsWith('http:')) add({ ...base, check_key: 'https', status: 'needs_review', observed: 'The page ended on an insecure http address.', explanation: 'Visitors may see a “not secure” label.', possible_cause: 'A redirect sends visitors from https to http.', next_action: 'Check redirect and HTTPS settings.', evidence: ev })
    else if (final.startsWith('https:')) add({ ...base, check_key: 'https', status: 'passed', observed: 'The secure connection worked and the certificate was accepted.', explanation: 'The browser trusted the site’s certificate.', evidence: { final_url: final } })
    else add({ ...base, check_key: 'https', status: 'needs_review', observed: 'The page uses http, not https.', explanation: 'Browsers label http pages as not secure.', next_action: 'Consider turning on HTTPS for the site.', evidence: ev })

    // Redirects
    if (v.chain?.length) {
      const outside = !hostInDomains(hostOf(final), domains)
      const unexpected = !sameishRedirect(target.url, final) && !sameishRedirect(target.url.replace(/^http:/, 'https:'), final)
      if (outside) add({ ...base, check_key: 'redirects', status: 'needs_review', observed: `Redirected to ${final}, which is outside the approved domains.`, explanation: 'This may be intended (for example a new domain), or a sign of a misconfiguration.', next_action: 'Confirm the redirect is expected.', evidence: ev })
      else if (unexpected) add({ ...base, check_key: 'redirects', status: 'needs_review', observed: `Redirected to a different page: ${final}.`, explanation: 'The agreed page address now sends visitors somewhere else.', possible_cause: 'The page may have moved.', next_action: 'Confirm the redirect is expected, or update the page list.', evidence: ev })
      else add({ ...base, check_key: 'redirects', status: 'passed', observed: `Redirected ${v.chain.length} time(s) to the same page.`, explanation: 'A normal redirect, such as adding https or www.', evidence: ev })
    }

    // Images
    const ownFailed = v.failedImages.filter((i) => hostInDomains(hostOf(i.url), domains) && i.status)
    const otherFailed = v.failedImages.filter((i) => !ownFailed.includes(i))
    if (ownFailed.length) add({ ...base, check_key: 'images', status: 'failed', observed: `${ownFailed.length} image(s) from the site failed to load (for example ${ownFailed[0].url}, HTTP ${ownFailed[0].status}).`, explanation: 'Visitors may see empty spaces or broken image icons.', possible_cause: 'The image file was moved or deleted.', next_action: 'Replace or relink the image.', evidence: { request_url: ownFailed[0].url, http_status: ownFailed[0].status } })
    if (otherFailed.length) add({ ...base, check_key: 'images', status: 'needs_review', observed: `${otherFailed.length} image request(s) did not load (for example ${otherFailed[0].url}: ${otherFailed[0].error || 'HTTP ' + otherFailed[0].status}).`, explanation: 'These may come from another service, or may have been blocked by the checker’s safety rules. People may still see them.', next_action: 'Look at the screenshot and the live page.', evidence: { request_url: otherFailed[0].url, blocked_reason: blockedFor(otherFailed[0].url) } })
    if (!v.failedImages.length) add({ ...base, check_key: 'images', status: 'passed', observed: 'No image requests failed.', explanation: 'Images on the page loaded.' })

    // Overflow
    const o = v.overflow || 0
    if (o >= 20) add({ ...base, check_key: 'overflow', status: 'failed', observed: `The page is ${o}px wider than the ${kind} screen, so it scrolls sideways.`, explanation: 'Visitors may need to scroll sideways, and parts of the page may be cut off.', possible_cause: 'An element wider than the screen, such as an image, table, or embed.', next_action: 'Check the screenshot and fix the wide element.', evidence: { overflow_px: o } })
    else if (o >= 4) add({ ...base, check_key: 'overflow', status: 'needs_review', observed: `The page is ${o}px wider than the ${kind} screen.`, explanation: 'A small sideways scroll may or may not be noticeable.', next_action: 'Check the screenshot.', evidence: { overflow_px: o } })
    else add({ ...base, check_key: 'overflow', status: 'passed', observed: `No sideways scrolling on ${kind}.`, explanation: 'The page fits the screen width.' })
    return true
  }

  try {
    for (const kind of ['desktop', 'mobile']) {
      if (stopped) break
      const context = await newContext(kind)
      await pool(pages, limits.concurrency, async (target, idx) => {
        if (stopped) return
        const v = await visit(context, kind, target, 'page_load')
        const ok = pageFindings(target, v, kind)
        if (ok && idx < 6) {
          try {
            const shot = await v.page.screenshot({ type: 'jpeg', quality: 60, fullPage: false, timeout: 15000 })
            const path = await ctx.upload(`${kind}-${idx + 1}`, shot)
            add({ url: target.url, viewport: kind, check_key: 'screenshot', status: 'passed', observed: `${kind === 'mobile' ? 'Mobile' : 'Desktop'} screenshot captured.`, explanation: 'For visual review.', evidence: { screenshot: path } })
          } catch (e) {
            add({ url: target.url, viewport: kind, check_key: 'screenshot', status: 'could_not_check', observed: 'The screenshot could not be captured.', explanation: 'Review the page by hand.', evidence: { error_code: netError(e.message) || 'SCREENSHOT_FAILED' } })
          }
        }
        if (ok && kind === 'desktop') {
          try {
            const hrefs = await v.page.$$eval('a[href]', (as) => as.map((a) => a.href).slice(0, 400))
            for (const h of hrefs) {
              let u
              try { u = new URL(h) } catch { continue }
              if (!/^https?:$/.test(u.protocol) || !hostInDomains(u.hostname, domains)) continue
              u.hash = ''
              const key = u.toString()
              if (pages.some((p) => p.url === key) || links.has(key)) continue
              links.set(key, { url: key, found_on: target.url, risky: RISKY_LINK.test(u.pathname + u.search) })
            }
          } catch { /* link collection is best effort */ }
        }
        await v.page.close().catch(() => {})
        await tick(`${kind}: ${target.label || target.url}`)
      })
      await context.close()
    }

    // Destinations: opened only. Never filled in, clicked, booked, or paid.
    if (destinations.length && !stopped) {
      const context = await newContext('desktop')
      for (const d of destinations) {
        if (stopped) break
        const v = await visit(context, 'desktop', d, 'destination')
        const base = { url: d.url, viewport: 'desktop', check_key: 'destination' }
        const own = hostInDomains(hostOf(d.url), domains)
        const limitNote = d.kind === 'booking' ? ' This only shows the page opens; it does not confirm booking works.' : d.kind === 'checkout' ? ' This only shows the page opens; it does not confirm payment works.' : d.kind === 'contact' ? ' This only shows the page opens; it does not confirm messages are delivered.' : ''
        if (v.err) {
          const code = netError(v.err.message)
          const desc = describeNavError(code, blockedFor(d.url), 'destination')
          add({ ...base, ...desc, check_key: desc.check_key === 'page_load' ? 'destination' : desc.check_key, status: own || desc.status !== 'failed' ? desc.status : 'needs_review', evidence: { error_code: code } })
        } else {
          const status = v.resp?.status() ?? 0
          const wall = BOT_WALL.test(v.title || '')
          const guard = v.resp?.headers()['x-care-blocked']
          if (guard) add({ ...base, ...describeNavError(null, guard, 'destination'), evidence: { blocked_reason: guard } })
          else if (wall || status === 401 || status === 403 || status === 429) add({ ...base, status: 'could_not_check', observed: `${d.label} showed an access or robot check page (HTTP ${status}).`, explanation: 'The service limits automated visitors. This is not a site defect.', next_action: 'Open it by hand.', evidence: { http_status: status, final_url: v.finalUrl } })
          else if (status >= 400) add({ ...base, status: own && status < 500 ? 'failed' : 'needs_review', observed: `${d.label} answered with HTTP ${status}.`, explanation: own ? 'Visitors following this link see an error.' : 'The outside service returned an error. It may be temporary.', next_action: 'Open it by hand and check the link.', evidence: { http_status: status, final_url: v.finalUrl } })
          else add({ ...base, status: 'passed', observed: `${d.label} opened (HTTP ${status}).`, explanation: `The destination page loaded.${limitNote}`, evidence: { http_status: status, final_url: v.finalUrl } })
        }
        await v.page.close().catch(() => {})
        await tick(`destination: ${d.label}`)
      }
      await context.close()
    }
  } finally {
    await browser.close().catch(() => {})
  }

  // Links within the agreed pages (same approved domains only), checked with HEAD/GET.
  const all = [...links.values()]
  const safe = all.filter((l) => !l.risky).slice(0, limits.maxLinks)
  const skipped = all.length - safe.length
  let okCount = 0
  if (!stopped) {
    await pool(safe, Math.min(4, limits.concurrency * 2), async (l) => {
      if (stopped) return
      const r = await checkLink(l.url, { timeoutMs: 10000, ua: `Mozilla/5.0 ${UA_SUFFIX}` })
      const base = { url: l.url, check_key: 'internal_links', evidence: { found_on: l.found_on, http_status: r.status ?? null, final_url: r.final, redirect_chain: r.chain } }
      if (r.blocked) add({ ...base, status: 'could_not_check', observed: `Not opened (${r.blocked}).`, explanation: 'The checker only opens public addresses.', next_action: 'Check the link by hand.' })
      else if (r.loop) add({ ...base, status: 'failed', observed: 'The link redirects in a loop.', explanation: 'Visitors can’t reach this page.', next_action: 'Fix the redirect.' })
      else if (r.error) add({ ...base, status: 'could_not_check', observed: `The link did not respond (${r.error}).`, explanation: 'This can be temporary and is not proof of a broken link.', next_action: 'Open it by hand.' })
      else if (r.status === 404 || r.status === 410) add({ ...base, status: 'failed', observed: `Broken link: HTTP ${r.status}.`, explanation: `Visitors who click this link on ${pathOf(l.found_on)} see an error page.`, possible_cause: 'The page was moved or deleted.', next_action: 'Update or remove the link.' })
      else if (r.status >= 500) add({ ...base, status: 'needs_review', observed: `The link returned HTTP ${r.status}.`, explanation: 'The server reported an error. It may be temporary.', next_action: 'Open it again later.' })
      else if (r.status === 401 || r.status === 403 || r.status === 429) add({ ...base, status: 'could_not_check', observed: `The site refused the automated request (HTTP ${r.status}).`, explanation: 'People may still be able to open it.', next_action: 'Open it by hand if it matters.' })
      else if (r.final && !hostInDomains(hostOf(r.final), domains)) add({ ...base, status: 'needs_review', observed: `The link redirects outside the approved domains to ${r.final}.`, explanation: 'This may be intended.', next_action: 'Confirm the redirect is expected.' })
      else okCount++
      await tick('links')
    })
  }
  if (okCount || (!all.length && !stopped)) add({ url: config.site_url, check_key: 'internal_links', status: 'passed', observed: all.length ? `${okCount} link(s) within the site opened without errors.` : 'No other links within the approved domains were found on the agreed pages.', explanation: 'Links found on the agreed pages were checked.', evidence: {} })
  if (skipped > 0) add({ url: config.site_url, check_key: 'internal_links', status: 'not_applicable', observed: `${skipped} link(s) were not opened because they look like account, cart, or action links, or were over the ${limits.maxLinks} link limit.`, explanation: 'Read only checks skip links that could change something.', evidence: {} })
  if (writeAttempts.length) add({ url: config.site_url, check_key: 'scan', status: 'not_applicable', observed: `${writeAttempts.length} background request(s) that would send data were blocked (for example ${writeAttempts[0].method}).`, explanation: 'The checker is read only, so it blocks anything that sends data. Some widgets may look different in screenshots because of this.', evidence: { request_url: writeAttempts[0].url } })

  if (stopped && stopped !== 'lease lost') {
    add({ url: config.site_url, check_key: 'scan', status: 'could_not_check', observed: stopped === 'canceled' ? 'The check was canceled before it finished.' : 'The check stopped at its time limit before finishing.', explanation: 'Items that did not run are not confirmed.', next_action: 'Retry the check, or check the remaining items by hand.' })
  }
  return { findings, stopped }
}
