'use client'
import { useState, type ReactNode } from 'react'
import { CARE_CSS } from '../ui'

const GUIDE_CSS = `
.guide h2{font-size:22px;margin:0 0 10px}.guide h3{font-size:17px;margin:16px 0 6px}.guide h4{font-size:15px;margin:12px 0 4px}
.guide p,.guide ul,.guide ol{margin:0 0 10px}.guide ul,.guide ol{padding-left:22px}.guide li{margin:3px 0}
.guide blockquote{margin:0 0 10px;padding:8px 12px;border-left:3px solid var(--coral);background:var(--surface);border-radius:8px}
.guide code{background:var(--surface2);border-radius:6px;padding:1px 5px;font-size:13px;overflow-wrap:anywhere}
.guide .guide-shot{display:block;max-width:100%;height:auto;border-radius:10px;border:1px solid var(--border2);margin:8px 0 12px}
.guide-toc{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
`

type S = { id: string; title: string; text: string; body: ReactNode[] }

export default function GuideView({ title, intro, sections }: { title: string; intro: ReactNode[]; sections: S[] }) {
  const [q, setQ] = useState('')
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = words.length ? sections.filter((s) => words.every((w) => s.text.includes(w))) : sections
  return (
    <div className="care care-frame guide">
      <style>{CARE_CSS + GUIDE_CSS}</style>
      <header className="care-top">
        <div style={{ marginRight: 'auto' }}>
          <div className="care-label">Website Care</div>
          <h1 style={{ fontSize: 20 }}>{title}</h1>
        </div>
        <a className="care-btn small" href="/admin/care" style={{ textDecoration: 'none' }}>Back to Website Care</a>
      </header>
      <main id="admin-main" tabIndex={-1} className="care-main" style={{ maxWidth: 900 }}>
        <section className="care-panel">
          {intro}
          <label className="care-label" htmlFor="guide-q">Search the guide</label>
          <input id="guide-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: estimate, failed payment, Not set" />
          <nav aria-label="Guide sections" className="guide-toc">
            {shown.map((s) => <a key={s.id} className="care-btn small" href={`#${s.id}`} style={{ textDecoration: 'none' }}>{s.title}</a>)}
          </nav>
          {words.length > 0 && <p className="care-muted" style={{ marginTop: 8 }} role="status">{shown.length} of {sections.length} sections match.</p>}
        </section>
        {shown.map((s) => (
          <section key={s.id} id={s.id} className="care-panel" aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`}>{s.title}</h2>
            {s.body}
          </section>
        ))}
      </main>
    </div>
  )
}
