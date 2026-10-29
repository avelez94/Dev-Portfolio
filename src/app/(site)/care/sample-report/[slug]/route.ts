/**
 * Public download of the fictional sample reports. Built from static sample
 * data with the real report template; no database, no client data.
 */
import { NextResponse } from 'next/server'
import { careSample, CARE_SAMPLES } from '@/content/care-samples'
import { reportPdf } from '@/lib/care/report-pdf'

export function generateStaticParams() {
  return CARE_SAMPLES.map((s) => ({ slug: `${s.slug}.pdf` }))
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const sample = careSample(String(slug).replace(/\.pdf$/, ''))
  if (!sample) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const pdf = await reportPdf(sample.snapshot)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Sample health report, ${sample.business}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}
