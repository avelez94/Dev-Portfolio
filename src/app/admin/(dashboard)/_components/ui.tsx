'use client'
/**
 * Small shared pieces for the admin pages: the page frame (content plus the
 * details panel), headers, loading, error and empty states, form fields,
 * and dialogs. Class names and styles are the ones the dashboard always used.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { useTheme } from './theme'

/** Main content with an optional details panel on the right (below on phones). */
export function PageFrame({ children, panel }: { children: ReactNode; panel?: ReactNode }) {
  const { d } = useTheme()
  return (
    <div className={panel ? 'main' : 'main no-panel'} style={{ display: 'grid', gridTemplateColumns: panel ? '1fr 320px' : '1fr', height: '100vh', overflow: 'hidden', minWidth: 0 }}>
      <main id="admin-main" tabIndex={-1} className="center" style={{ background: d.bg, minWidth: 0 }}>
        <div className="admin-topbar" style={{ display: 'none', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div className="tb-logo" aria-hidden="true">AV</div>
          <div className="sb-admin" style={{ marginTop: 0 }}>Admin</div>
        </div>
        {children}
      </main>
      {panel && (
        <aside className="panel" aria-label="Details" style={{ background: d.white, borderColor: d.border }}>
          <div className="panel-inner">{panel}</div>
        </aside>
      )}
    </div>
  )
}

export function PageHeader({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  const { d } = useTheme()
  return (
    <div className="page-header">
      <h1 className="page-greeting" style={{ color: d.text }}>{title}</h1>
      {sub && <div className="page-sub" style={{ color: d.text3 }}>{sub}</div>}
    </div>
  )
}

/** Loading, error, or the page itself. */
export function PageState({ loading, error, retry, what, children }: { loading: boolean; error: string | null; retry: () => void; what: string; children: ReactNode }) {
  const { d } = useTheme()
  if (error) {
    return (
      <div role="alert" className="form-card" style={{ background: d.red, borderColor: d.redText, color: d.text, marginTop: 12 }}>
        <div className="form-title" style={{ color: d.redText }}>Couldn’t load {what}</div>
        <div style={{ fontSize: 13, color: d.text2, marginBottom: 12 }}>{error} Nothing was changed.</div>
        <button className="btn-save" onClick={retry}>Try Again</button>
      </div>
    )
  }
  if (loading) return <div className="empty-note" role="status" style={{ paddingTop: 60, color: d.text2, fontSize: 14 }}>Loading {what}…</div>
  return <>{children}</>
}

export function Empty({ children, left }: { children: ReactNode; left?: boolean }) {
  const { d } = useTheme()
  return <div className="empty-note" style={{ color: d.text3, ...(left ? { textAlign: 'left', paddingLeft: 0, paddingTop: 4 } : {}) }}>{children}</div>
}

/** A labeled field; the label names the control for screen readers. */
export function Field({ label, children, wide, style }: { label: string; children: ReactNode; wide?: boolean; style?: React.CSSProperties }) {
  const { d } = useTheme()
  return (
    <div className="form-group" style={{ ...(wide ? { gridColumn: '1/-1' } : {}), ...style }}>
      <div className="form-label" style={{ color: d.text3 }}>{label}</div>
      {children}
    </div>
  )
}

/** Modal dialog: Escape and the backdrop close it, focus moves inside when it opens. */
export function Dialog({ label, onClose, children, maxWidth = 480, padding = 32, z = 1000, closeOnBackdrop = true }: { label: string; onClose: () => void; children: ReactNode; maxWidth?: number | string; padding?: number | string; z?: number; closeOnBackdrop?: boolean }) {
  const { d } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="admin-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,5,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: z, padding: 24 }} onClick={closeOnBackdrop ? onClose : undefined}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="admin-modal" style={{ background: d.white, borderRadius: 20, padding, width: '100%', maxWidth, border: '1px solid ' + d.border }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function DialogTitle({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { d } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ fontFamily: ADMIN_FONTS.display, fontSize: 18, fontWeight: 600, color: d.text }}>{children}</div>
      <button aria-label="Close" className="icon-btn" style={{ color: d.text3, fontSize: 18 }} onClick={onClose}>x</button>
    </div>
  )
}

/** Label and value rows used in the invoice and project dialogs. */
export function DetailRows({ rows, pad = 8 }: { rows: { label: string; val: ReactNode }[]; pad?: number }) {
  const { d } = useTheme()
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${pad}px 0`, borderBottom: '1px solid ' + d.border }}>
          <div style={{ fontSize: 12, color: d.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.label}</div>
          <div style={{ fontSize: 13, color: d.text, fontWeight: 500 }}>{row.val}</div>
        </div>
      ))}
    </>
  )
}

/** Section heading with a count, as on the dashboard home. */
export function SectionLabel({ children, count, color, countBg, countColor }: { children: ReactNode; count?: number; color?: string; countBg?: string; countColor?: string }) {
  const { d } = useTheme()
  return (
    <div className="section-label" style={{ color: color || d.text2 }}>
      {children}
      {count !== undefined && <span className="section-label-count" style={{ background: countBg || d.surface, color: countColor || d.text3 }}>{count}</span>}
    </div>
  )
}
