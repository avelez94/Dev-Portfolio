/**
 * Address checks for website enrollment: public addresses pass, private and
 * reserved ones are refused, in IPv4, IPv6, and IPv4-mapped IPv6 form.
 * (A shared IPv4/IPv6 list once refused every IPv4 address, so confirming any
 * real website failed.)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const { isBlockedAddress } = await jiti.import(ROOT + 'src/lib/care/url-safety.ts')
// The check runner has its own copy of the rules (it runs in GitHub Actions); both must agree.
const runner = await import(ROOT + 'care-runner/lib/ip-guard.mjs')
const GUARDS = [['app', isBlockedAddress], ['runner', runner.isBlockedAddress]]

test('public addresses are allowed', () => {
  // Includes Vercel's addresses: the runner once refused every public IPv4 site, including www.alantevelez.com.
  for (const [name, guard] of GUARDS) for (const ip of ['93.184.215.14', '8.8.8.8', '151.101.1.69', '76.76.21.21', '216.198.79.1', '64.29.17.1', '2606:4700::6810:85e5', '::ffff:93.184.215.14']) assert.equal(guard(ip), false, `${name}: ${ip}`)
})

test('private, loopback, link local, documentation, and multicast addresses are refused', () => {
  for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.5.5', '192.168.1.1', '192.0.2.10', '100.64.0.1', '224.0.0.1', '::1', 'fe80::1', 'fd00::1', '2001:db8::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip']) for (const [name, guard] of GUARDS) assert.equal(guard(ip), true, `${name}: ${ip}`)
})
