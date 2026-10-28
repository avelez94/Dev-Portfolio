#!/usr/bin/env node
/**
 * Keeps public/Website_Pricing_Guide.pdf in step with the offer data.
 *
 * The PDF is a generated file. Editing offers.ts does NOT update it, so this
 * script records a fingerprint of every source the guide is printed from and
 * `check` fails (and so does `npm run build`) until the PDF is regenerated.
 *
 *   node scripts/pricing-guide.mjs generate [baseUrl]   print PDF + record fingerprint (needs playwright)
 *   node scripts/pricing-guide.mjs stamp                record fingerprint after printing manually
 *   node scripts/pricing-guide.mjs check                fail if sources changed since the PDF was made
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = [
  'src/content/offers.ts',
  'src/content/guide.ts',
  'src/app/pricing-guide/page.tsx',
  'src/app/pricing-guide/guide.module.css',
]
const PDF = 'public/Website_Pricing_Guide.pdf'
const STAMP = 'src/content/pricing-guide.stamp.json'

function fingerprint() {
  const h = createHash('sha256')
  for (const f of SOURCES) {
    h.update(f + '\n')
    h.update(readFileSync(join(root, f), 'utf8').replace(/\r\n/g, '\n'))
  }
  return h.digest('hex')
}

function writeStamp() {
  const pdfHash = createHash('sha256').update(readFileSync(join(root, PDF))).digest('hex')
  const stamp = { sourcesFingerprint: fingerprint(), pdfSha256: pdfHash, generatedAt: new Date().toISOString(), sources: SOURCES }
  writeFileSync(join(root, STAMP), JSON.stringify(stamp, null, 2) + '\n')
  console.log(`Recorded pricing guide fingerprint in ${STAMP}`)
}

function check() {
  const fail = (msg) => {
    console.error(`\n✖ Pricing guide is out of date. ${msg}\n`)
    console.error('  Regenerate it, then commit the PDF and stamp:')
    console.error('    npm run build && npm run start       (in one terminal)')
    console.error('    npm run guide:pdf                    (in another)')
    console.error('  Manual alternative: print /pricing-guide to PDF (Letter, no margins, background graphics),')
    console.error(`  save over ${PDF}, then run: npm run guide:stamp\n`)
    process.exit(1)
  }
  if (!existsSync(join(root, PDF))) fail(`${PDF} is missing.`)
  if (!existsSync(join(root, STAMP))) fail(`${STAMP} is missing.`)
  const stamp = JSON.parse(readFileSync(join(root, STAMP), 'utf8'))
  if (stamp.sourcesFingerprint !== fingerprint()) fail('Offer or guide sources changed after the PDF was generated.')
  const pdfHash = createHash('sha256').update(readFileSync(join(root, PDF))).digest('hex')
  if (stamp.pdfSha256 !== pdfHash) fail('The PDF file changed without being regenerated from the current sources.')
  console.log('✓ Pricing guide PDF matches the current offer data.')
}

async function generate(baseUrl = 'http://localhost:3000') {
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    console.error('Playwright is not installed. Either run: npm i -D playwright && npx playwright install chromium')
    console.error(`or print ${baseUrl}/pricing-guide to PDF by hand and then run: npm run guide:stamp`)
    process.exit(1)
  }
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  const page = await browser.newPage()
  const res = await page.goto(`${baseUrl.replace(/\/$/, '')}/pricing-guide`, { waitUntil: 'networkidle' })
  if (!res || !res.ok()) {
    console.error(`Could not load ${baseUrl}/pricing-guide (is the site running?)`)
    process.exit(1)
  }
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: join(root, PDF), format: 'Letter', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } })
  await browser.close()
  console.log(`Wrote ${PDF}`)
  writeStamp()
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'generate') await generate(arg)
else if (cmd === 'stamp') writeStamp()
else if (cmd === 'check') check()
else {
  console.log('Usage: node scripts/pricing-guide.mjs <generate [baseUrl] | stamp | check>')
  process.exit(1)
}
