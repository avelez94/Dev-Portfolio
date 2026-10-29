/**
 * Checks a website address the way "Confirm setup and enable reviews" does,
 * using this computer's real DNS: the address must be public and inside the
 * approved domains. Read only: it looks the name up and prints the result. It
 * doesn't open the website, write to any database, or send anything.
 *
 *   node scripts/check-care-address.mjs https://www.example.com/ example.com
 */
import dns from 'node:dns'
import { createRequire } from 'node:module'

const ROOT = new URL('..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src', 'server-only': ROOT + 'tests/care/empty.mjs' } })
const { checkUrlResolves } = await jiti.import(ROOT + 'src/lib/care/url-safety.ts')

const [url, domains] = process.argv.slice(2)
if (!url) { console.log('Usage: node scripts/check-care-address.mjs <website address> [approved domains, comma separated]'); process.exit(2) }
const host = new URL(url).hostname
const addrs = await dns.promises.lookup(host, { all: true, verbatim: true }).catch((e) => e.code)
console.log(`DNS answer for ${host}:`, addrs)
const r = await checkUrlResolves(url, domains ? domains.split(',').map((d) => d.trim()) : undefined)
console.log(r.ok ? `Allowed: ${url} would pass the setup confirmation address check.` : `Refused: ${r.reason}`)
process.exit(r.ok ? 0 : 1)
