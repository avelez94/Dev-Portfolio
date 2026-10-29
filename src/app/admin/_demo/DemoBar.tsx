'use client'
/**
 * The demo strip shown on every admin page in demo mode: the demo label, what
 * was simulated in this session (emails, meetings, checks, payments, and
 * anything refused), and Reset demo. Rendering it also installs the browser
 * side of the demo (src/lib/demo/browser.ts) before any page loads data.
 */
import { useEffect, useState } from 'react'
import { ADMIN_CORAL, ADMIN_INK } from '@/lib/admin-theme'
import { DEMO_LABEL } from '@/lib/demo/mode'
import { demoInfo, installDemoFetch, onDemoChange, resetDemo } from '@/lib/demo/browser'

const KIND: Record<string, string> = { email: 'Email', meeting: 'Meeting', scan: 'Check', payment: 'Payment', invoice: 'Invoice', blocked: 'Refused', note: 'Simulated' }

export default function DemoBar() {
  installDemoFetch()
  const [info, setInfo] = useState<ReturnType<typeof demoInfo>>({ log: [], started: null, persisted: true })
  const [open, setOpen] = useState(false)
  useEffect(() => { setInfo(demoInfo()); return onDemoChange(() => setInfo(demoInfo())) }, []) // eslint-disable-line react-hooks/set-state-in-effect

  function reset() {
    if (!window.confirm('Reset the demo? Your changes in this demo session are discarded and the original fictional data comes back.')) return
    resetDemo()
    window.location.reload()
  }

  const log = [...info.log].reverse()
  return (
    <div role="region" aria-label="Demo mode" data-testid="demo-bar" style={{ background: ADMIN_CORAL, color: ADMIN_INK, borderBottom: `2px solid ${ADMIN_INK}`, padding: '6px 12px', fontSize: 13, position: 'relative', zIndex: 1200 }}>
      <div style={{ display: 'flex', gap: '6px 12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ flex: '1 1 220px' }}>{DEMO_LABEL}</strong>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={btn}>Simulated actions ({info.log.length})</button>
        <button type="button" onClick={reset} style={btn}>Reset demo</button>
      </div>
      {!info.persisted && <p style={{ margin: '4px 0 0' }}>This browser isn’t keeping demo changes between pages; they last until you reload.</p>}
      {open && (
        <div style={{ marginTop: 6, background: '#FFFAF3', borderRadius: 10, padding: 10, maxHeight: '45vh', overflow: 'auto', border: `1.5px solid ${ADMIN_INK}` }}>
          <p style={{ margin: '0 0 6px' }}>Nothing here reached a real service. Emails, Zoom meetings, website checks, and Stripe payments are simulated; anything else outside the demo is refused.</p>
          {log.length === 0 ? <p style={{ margin: 0 }}>Nothing simulated yet in this demo session.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              {log.map((e, i) => (
                <li key={i} style={{ overflowWrap: 'anywhere' }}>
                  <b>{KIND[e.kind] || 'Simulated'}:</b> {e.summary} <span style={{ opacity: 0.7 }}>({new Date(e.at).toLocaleTimeString()})</span>
                  {typeof e.detail?.text === 'string' && <details><summary>Email text</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: '4px 0' }}>{e.detail.text}</pre></details>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

const btn: React.CSSProperties = { font: 'inherit', fontWeight: 700, background: '#FFFAF3', color: ADMIN_INK, border: `1.5px solid ${ADMIN_INK}`, borderRadius: 999, padding: '4px 12px', minHeight: 32, cursor: 'pointer' }
