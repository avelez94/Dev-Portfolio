/**
 * Destination rules for Website Care. Only public http and https addresses on
 * the standard ports are accepted. Loopback, private, link local (including
 * cloud metadata at 169.254.169.254), carrier grade NAT, multicast, and other
 * reserved ranges are refused, both as literal addresses and after DNS
 * resolution. The check runner applies the same rules to every request the
 * browser makes, including redirects and page subrequests.
 */
import { BlockList, isIP } from 'node:net'
import dns from 'node:dns'
import { testHostMap } from './config'

// Separate lists: Node's BlockList matches IPv4 addresses against IPv4-mapped
// IPv6 rules too, so "::ffff:0:0/96" in a shared list would block every IPv4 address.
const blocked4 = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as [string, number][]) blocked4.addSubnet(net, bits, 'ipv4')
const blocked6 = new BlockList()
for (const [net, bits] of [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['100::', 64], ['2001::', 23], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as [string, number][]) blocked6.addSubnet(net, bits, 'ipv6')

export function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) return blocked4.check(ip, 'ipv4')
  if (v === 6) {
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return blocked4.check(mapped[1], 'ipv4')
    return blocked6.check(ip, 'ipv6')
  }
  return true
}

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|localdomain|corp)$/i

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string }

/** Syntax and policy checks that don't need DNS. */
export function checkUrlShape(raw: string, approvedDomains?: string[]): UrlCheck {
  let u: URL
  try {
    u = new URL(String(raw).trim())
  } catch {
    return { ok: false, reason: 'This is not a valid web address.' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: 'Only http and https addresses are allowed.' }
  if (u.username || u.password) return { ok: false, reason: 'Addresses with a username or password are not allowed.' }
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const test = testHostMap()
  const isTestHost = Object.prototype.hasOwnProperty.call(test, host)
  if (u.port && !['80', '443'].includes(u.port) && !isTestHost) return { ok: false, reason: 'Only the standard web ports are allowed.' }
  if (isIP(host)) {
    if (isBlockedAddress(host)) return { ok: false, reason: 'Private, local, and reserved network addresses are not allowed.' }
    return { ok: false, reason: 'Use the website’s domain name, not a numeric address.' }
  }
  if (!isTestHost && (BLOCKED_NAMES.test(host) || !host.includes('.'))) return { ok: false, reason: 'Internal and local host names are not allowed.' }
  if (approvedDomains && !hostInDomains(host, approvedDomains)) return { ok: false, reason: `${host} is not one of the approved domains.` }
  return { ok: true, url: u }
}

export function normalizeDomain(d: string): string {
  return String(d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, '').replace(/\.$/, '')
}

export function hostInDomains(host: string, domains: string[]): boolean {
  const h = host.toLowerCase()
  return domains.map(normalizeDomain).some((d) => d && (h === d || h.endsWith('.' + d)))
}

/** Full check including DNS: every resolved address must be public. */
export async function checkUrlResolves(raw: string, approvedDomains?: string[]): Promise<UrlCheck> {
  const shape = checkUrlShape(raw, approvedDomains)
  if (!shape.ok) return shape
  const host = shape.url.hostname.toLowerCase()
  const test = testHostMap()
  if (Object.prototype.hasOwnProperty.call(test, host)) return shape
  try {
    // Looked up through the module at call time, so the preview demo can answer it (src/lib/demo/intercept.ts).
    const addrs = await dns.promises.lookup(host, { all: true, verbatim: true })
    if (!addrs.length) return { ok: false, reason: `${host} does not resolve.` }
    if (addrs.some((a) => isBlockedAddress(a.address))) return { ok: false, reason: `${host} points to a private or reserved network address.` }
    return shape
  } catch {
    return { ok: false, reason: `${host} could not be found in DNS right now.` }
  }
}
