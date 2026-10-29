/**
 * Network guard for the check runner. Same rules as the app
 * (src/lib/care/url-safety.ts): only public addresses, only standard web ports.
 * Every host is resolved here and the connection is made to the exact address
 * that was checked, so DNS rebinding can't swap in a private address.
 */
import { BlockList, isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

const blocked = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(net, bits, 'ipv4')
for (const [net, bits] of [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['100::', 64], ['2001::', 23], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
]) blocked.addSubnet(net, bits, 'ipv6')

export function isBlockedAddress(ip) {
  const v = isIP(ip)
  if (v === 4) return blocked.check(ip, 'ipv4')
  if (v === 6) {
    const m = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (m) return blocked.check(m[1], 'ipv4')
    return blocked.check(ip, 'ipv6')
  }
  return true
}

/**
 * Local testing only: exact host names mapped to addresses (for fixture sites).
 * Refused inside GitHub Actions so it can never weaken a real run.
 */
export function testHosts() {
  const raw = process.env.CARE_RUNNER_TEST_HOSTS
  if (!raw) return {}
  if (process.env.GITHUB_ACTIONS === 'true') throw new Error('CARE_RUNNER_TEST_HOSTS is not allowed in GitHub Actions.')
  return JSON.parse(raw)
}

const cache = new Map()

/** Returns { ok: true, address, family } or { ok: false, reason }. */
export async function resolveSafe(hostname, port) {
  const host = String(hostname).replace(/^\[|\]$/g, '').toLowerCase()
  const test = testHosts()
  const p = Number(port)
  if (Object.prototype.hasOwnProperty.call(test, host)) {
    const val = String(test[host])
    // "dns:ADDR" simulates a public DNS answer: the normal rules still apply.
    if (val.startsWith('dns:')) {
      const addr = val.slice(4)
      if (p !== 80 && p !== 443) return { ok: false, reason: `port ${p} is not a standard web port` }
      return isBlockedAddress(addr) ? { ok: false, reason: 'resolves to a private or reserved address' } : { ok: true, address: addr, family: isIP(addr) }
    }
    return { ok: true, address: val, family: isIP(val) || 4, test: true }
  }
  if (p !== 80 && p !== 443) return { ok: false, reason: `port ${p} is not a standard web port` }
  if (isIP(host)) return isBlockedAddress(host) ? { ok: false, reason: 'private or reserved address' } : { ok: true, address: host, family: isIP(host) }
  if (/(^|\.)(localhost|local|internal|intranet|lan|localdomain|home\.arpa)$/.test(host) || !host.includes('.')) return { ok: false, reason: 'internal host name' }
  const key = host
  const hit = cache.get(key)
  if (hit && hit.t > Date.now() - 60_000) return hit.v
  let v
  try {
    const all = await lookup(host, { all: true, verbatim: true })
    const bad = all.find((a) => isBlockedAddress(a.address))
    v = !all.length ? { ok: false, reason: 'does not resolve' } : bad ? { ok: false, reason: 'resolves to a private or reserved address' } : { ok: true, address: all[0].address, family: all[0].family }
  } catch (e) {
    v = { ok: false, reason: 'DNS lookup failed', dns: true, code: e.code }
  }
  cache.set(key, { t: Date.now(), v })
  return v
}

export function hostInDomains(host, domains) {
  const h = String(host).toLowerCase()
  return (domains || []).some((d) => {
    const x = String(d).toLowerCase().replace(/^\*\./, '')
    return h === x || h.endsWith('.' + x)
  })
}
