'use client'
/**
 * The shared admin frame for every dashboard page: sidebar (bottom bar on
 * phones), surface switch, sign out, the session expired prompt, and the
 * dashboard styles. Sign in itself is enforced by src/proxy.ts for pages and
 * by requireAdmin on every API route, independently of this UI.
 */
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { adminFetch } from '../_lib/api'
import { adminCss } from './styles'
import { ThemeContext, themeFor } from './theme'
import { confirmLeave, useBeforeUnloadGuard } from './unsaved'
import DemoBar from '../../_demo/DemoBar'

const icon = (path: ReactNode) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">{path}</svg>
export const NAV_ITEMS = [
  { href: '/admin', label: 'Home', icon: icon(<path d="M2 7.5L9 2l7 5.5V16a1 1 0 01-1 1H3a1 1 0 01-1-1V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />) },
  { href: '/admin/pipeline', label: 'Pipeline', icon: icon(<><rect x="2" y="2" width="5" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" /><rect x="11" y="5" width="5" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" /></>) },
  { href: '/admin/revenue', label: 'Revenue', icon: icon(<><path d="M2 14l4-4 3 3 4-5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 4h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>) },
  { href: '/admin/documents', label: 'Docs', icon: icon(<><rect x="3" y="1" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6 5h6M6 8h6M6 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>) },
  { href: '/admin/schedule', label: 'Schedule', icon: icon(<><rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6 2v2M12 2v2M2 7h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>) },
]
const CARE_ITEM = { href: '/admin/care', label: 'Care', icon: icon(<><path d="M9 16s-6-3.6-6-8.2A3.3 3.3 0 019 5.6a3.3 3.3 0 016 2.2C15 12.4 9 16 9 16z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M5.5 9h2l1-2 1.5 3.5 1-1.5h1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></>) }

/** True when the link is the current page (Home only matches exactly). */
export const isActive = (href: string, path: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'))

export default function AdminShell({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  const path = usePathname() || '/admin'
  const [dark, setDark] = useState(true)
  // Website Care link shows only where the feature is switched on (its API answers 404 otherwise).
  const [careOn, setCareOn] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const theme = themeFor(dark)
  const { d } = theme

  useBeforeUnloadGuard()

  useEffect(() => {
    try { if (localStorage.getItem('admin-surface') === 'charcoal') setDark(false) } catch { /* storage unavailable */ } // eslint-disable-line react-hooks/set-state-in-effect
    fetch('/api/care/admin/status', { cache: 'no-store' }).then((r) => setCareOn(r.ok)).catch(() => {})
    const onExpired = () => setSessionExpired(true)
    window.addEventListener('admin-session-expired', onExpired)
    return () => window.removeEventListener('admin-session-expired', onExpired)
  }, [])

  // Screen readers: give each form control the name of the visible label above it.
  // (The forms use styled text labels; this connects them without changing the layout.)
  useEffect(() => {
    const root = document.querySelector('.shell')
    if (!root) return
    const name = () => {
      root.querySelectorAll<HTMLElement>('.form-group').forEach((g) => {
        const label = g.querySelector('.form-label')?.textContent?.trim()
        const ctl = g.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea')
        if (label && ctl && !ctl.getAttribute('aria-label') && !ctl.id) ctl.setAttribute('aria-label', label)
      })
      root.querySelectorAll<HTMLElement>('.hour-item').forEach((row) => {
        const day = row.querySelector('.hi-day')?.textContent?.trim() || ''
        const times = row.querySelectorAll<HTMLInputElement>('input[type=time]')
        if (times[0] && !times[0].getAttribute('aria-label')) times[0].setAttribute('aria-label', `${day} start time`)
        if (times[1] && !times[1].getAttribute('aria-label')) times[1].setAttribute('aria-label', `${day} end time`)
      })
      root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder]:not([aria-label]),textarea[placeholder]:not([aria-label])').forEach((el) => {
        if (!el.id && !el.closest('label')) el.setAttribute('aria-label', el.placeholder)
      })
    }
    name()
    const mo = new MutationObserver(name)
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])

  function switchSurface() {
    const next = !dark
    setDark(next)
    try { localStorage.setItem('admin-surface', next ? 'teal' : 'charcoal') } catch { /* storage unavailable */ }
  }

  async function handleLogout() {
    if (!confirmLeave()) return
    await adminFetch('/api/admin/auth', { method: 'DELETE' })
    window.location.href = '/admin/login?signedout=1'
  }

  const items = careOn ? [...NAV_ITEMS, CARE_ITEM] : NAV_ITEMS
  const here = typeof window === 'undefined' ? path : window.location.pathname + window.location.search

  return (
    <ThemeContext.Provider value={theme}>
      <style>{adminCss(d)}</style>
      <div className="admin-frame">
      {demo && <DemoBar />}
      <div className="shell" style={{ background: d.bg, color: d.text, display: 'grid', gridTemplateColumns: '80px 1fr' }}>
        <a href="#admin-main" className="admin-skip">Skip to content</a>
        <nav className="sidebar" aria-label="Admin" style={{ background: d.white, borderColor: d.border }}>
          <div className="sb-admin-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="sb-logo" aria-hidden="true">AV</div>
            <div className="sb-admin">Admin</div>
          </div>
          <div className="sb-nav">
            {items.map(({ href, label, icon }) => {
              const on = isActive(href, path)
              return (
                <Link key={href} href={href} className="sb-btn" aria-current={on ? 'page' : undefined}
                  style={{ color: on ? d.accent : d.text2, background: on ? d.accentBg : 'none', textDecoration: 'none' }}
                  onClick={(e) => { if (!on && !confirmLeave()) e.preventDefault() }}>
                  {icon}
                  <span className="sb-btn-label" style={{ color: on ? d.accent : d.text2 }}>{label}</span>
                </Link>
              )
            })}
          </div>
          <div className="sb-divider" style={{ background: d.border }} />
          <button className="sb-toggle" style={{ background: 'none' }} onClick={switchSurface} aria-label={`Surface color: ${dark ? 'teal' : 'charcoal'}. Switch to ${dark ? 'charcoal' : 'teal'}`} title="Switch surface color">
            <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: dark ? '#10302D' : '#221C1A', border: '1.5px solid ' + d.text2, marginRight: 4, verticalAlign: '-1px' }} />
            <span className="sb-toggle-label">{dark ? 'Teal' : 'Charcoal'}</span>
          </button>
          <button className="sb-toggle" style={{ background: 'none', marginTop: 6 }} onClick={handleLogout} aria-label="Log out" title="Log out">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="sb-toggle-label" style={{ marginLeft: 4 }}>Log out</span>
          </button>
        </nav>
        {children}
      </div>
      </div>
      {sessionExpired && (
        <div className="admin-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,5,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 16 }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="session-title" aria-describedby="session-body" className="admin-modal" style={{ background: d.white, border: '1px solid ' + d.border2, padding: 28, maxWidth: 420, width: '100%' }}>
            <div className="admin-eyebrow">Admin</div>
            <h2 id="session-title" style={{ fontFamily: ADMIN_FONTS.display, fontSize: 24, fontWeight: 600, color: d.text, marginBottom: 8 }}>Your session has ended</h2>
            <p id="session-body" style={{ color: d.text2, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>Sign in again to keep working. Anything you were typing on this page hasn&rsquo;t been sent or saved since the session ended.</p>
            <a className="btn-save" href={`/admin/login?from=${encodeURIComponent(here)}&expired=1`} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Sign In Again</a>
          </div>
        </div>
      )}
    </ThemeContext.Provider>
  )
}
