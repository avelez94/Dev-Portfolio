import type { Metadata } from 'next'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderGuide } from './markdown'
import GuideView from './GuideView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Website Care owner’s guide' }

/** The owner's guide, rendered from docs/WEBSITE_CARE_GUIDE.md (the same file you can read on GitHub). */
export default function GuidePage() {
  const md = readFileSync(join(process.cwd(), 'docs', 'WEBSITE_CARE_GUIDE.md'), 'utf8')
  const { title, intro, sections } = renderGuide(md, (src) => src.replace(/^website-care-guide\//, '/admin/care/guide/img/'))
  return <GuideView title={title} intro={intro} sections={sections.map((s) => ({ id: s.id, title: s.title, text: s.text.toLowerCase(), body: s.body }))} />
}
