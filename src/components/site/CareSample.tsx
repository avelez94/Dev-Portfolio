'use client'
/**
 * Public sample report preview on the Website Care page: two fictional
 * samples in tabs, rendered with the real report view, plus PDF downloads.
 */
import { useRef, useState } from 'react'
import s from './site.module.css'
import ReportView from '@/components/care/ReportView'
import type { Snapshot } from '@/lib/care/report-model'

type Sample = { slug: string; title: string; business: string; snapshot: Snapshot }

export default function CareSample({ samples }: { samples: Sample[] }) {
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = (i + (e.key === 'ArrowRight' ? 1 : samples.length - 1)) % samples.length
    setActive(next)
    tabs.current[next]?.focus()
  }
  const cur = samples[active]
  return (
    <div>
      <div role="tablist" aria-label="Sample reports" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 16px' }}>
        {samples.map((x, i) => (
          <button
            key={x.slug}
            ref={(el) => { tabs.current[i] = el }}
            role="tab"
            id={`sample-tab-${x.slug}`}
            aria-selected={i === active}
            aria-controls={`sample-panel-${x.slug}`}
            tabIndex={i === active ? 0 : -1}
            className={`${s.btn} ${i === active ? s.btnPrimary : s.btnGhost}`}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {x.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`sample-panel-${cur.slug}`} aria-labelledby={`sample-tab-${cur.slug}`}>
        <ReportView s={cur.snapshot} />
        <p style={{ margin: '14px 0 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {samples.map((x) => (
            <a key={x.slug} className={`${s.btn} ${s.btnGhost}`} href={`/care/sample-report/${x.slug}.pdf`} download>
              Download PDF: {x.title.toLowerCase()}
            </a>
          ))}
        </p>
      </div>
    </div>
  )
}
