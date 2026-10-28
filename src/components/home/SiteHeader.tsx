'use client'

import { useEffect, useRef, useState } from 'react'
import s from '@/app/home.module.css'

const links = [
  { href: '#work', label: 'Work' },
  { href: '#services', label: 'Services' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#about', label: 'About' },
]

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onResize = () => {
      if (window.innerWidth > 900) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header className={`${s.header} ${scrolled ? s.headerScrolled : ''}`}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>
      <div className={s.headerInner}>
        <a href="#top" className={s.logo} aria-label="Alante Velez, back to top">
          <span className={s.logoMark} aria-hidden="true">
            AV
          </span>
          <span className={s.logoText}>Alante Velez</span>
        </a>

        <nav aria-label="Main" className={s.navDesktop}>
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={s.headerActions}>
          <a href="#contact" className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`}>
            Let’s Talk
          </a>
          <button
            ref={buttonRef}
            type="button"
            className={s.menuButton}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span className={s.srOnly}>{open ? 'Close menu' : 'Open menu'}</span>
            <span className={`${s.menuIcon} ${open ? s.menuIconOpen : ''}`} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <nav
        id="mobile-menu"
        aria-label="Main"
        className={`${s.navMobile} ${open ? s.navMobileOpen : ''}`}
        hidden={!open}
      >
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <a href="#contact" onClick={() => setOpen(false)} className={s.navMobileCta}>
              Let’s Talk
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
