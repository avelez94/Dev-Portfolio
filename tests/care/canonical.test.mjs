/** The canonical www origin: the bare domain redirects, and Stripe and the check runner don't follow redirects. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../..', import.meta.url).pathname
const { createJiti } = createRequire(import.meta.url)('jiti')
const jiti = createJiti(import.meta.url, { alias: { '@': ROOT + 'src' } })
const { canonicalUrl, CANONICAL_ORIGIN } = await jiti.import(ROOT + 'src/content/site.ts')

test('the bare domain becomes the www origin; other hosts are kept', () => {
  assert.equal(CANONICAL_ORIGIN, 'https://www.alantevelez.com')
  assert.equal(canonicalUrl('https://alantevelez.com'), 'https://www.alantevelez.com')
  assert.equal(canonicalUrl('https://alantevelez.com/'), 'https://www.alantevelez.com')
  assert.equal(canonicalUrl('http://alantevelez.com/care/agreement/x'), 'https://www.alantevelez.com/care/agreement/x')
  assert.equal(canonicalUrl('https://www.alantevelez.com/'), 'https://www.alantevelez.com')
  assert.equal(canonicalUrl('https://alantevelez.com.evil.example'), 'https://alantevelez.com.evil.example')
  assert.equal(canonicalUrl('http://localhost:3230'), 'http://localhost:3230')
  assert.equal(canonicalUrl('https://dev-portfolio-abc-cutrated-mile.vercel.app/'), 'https://dev-portfolio-abc-cutrated-mile.vercel.app')
})

test('the runner and its workflow point at the www origin and stop on a redirect instead of losing the token', () => {
  const wf = readFileSync(ROOT + '.github/workflows/website-care-checks.yml', 'utf8')
  assert.match(wf, /CARE_APP_URL\s+https:\/\/www\.alantevelez\.com/)
  assert.match(wf, /3\*\) echo "::error::CARE_APP_URL redirects/)
  const run = readFileSync(ROOT + 'care-runner/run.mjs', 'utf8')
  assert.match(run, /redirect: 'manual'/)
  assert.doesNotMatch(readFileSync(ROOT + 'docs/WEBSITE_CARE.md', 'utf8'), /https:\/\/<deployment>\/api\/care\/stripe\/webhook/)
})

test('enrollment is online agreements only: no offline agreement button or instructions', () => {
  for (const f of ['src/app/admin/(dashboard)/care/AgreementPanel.tsx', 'src/app/admin/(dashboard)/care/ManualPeriodPanel.tsx', 'docs/WEBSITE_CARE_GUIDE.md']) {
    assert.doesNotMatch(readFileSync(ROOT + f, 'utf8'), /Record an existing signed agreement|agreement\/offline/, f)
  }
})
