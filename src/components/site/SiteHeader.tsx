'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import s from './site.module.css'
import { inquiryHref, navLinks } from '@/content/site'

function isCurrent(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export default function SiteHeader() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [lastPath, setLastPath] = useState(pathname)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close the mobile menu whenever the route changes.
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

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
      if (window.innerWidth > 1000) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const links = navLinks.map((l) => {
    const current = isCurrent(pathname, l.href)
    return { ...l, current }
  })

  return (
    <header className={`${s.header} ${scrolled ? s.headerScrolled : ''}`}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>
      <div className={s.headerInner}>
        <Link href="/" className={s.logo} aria-label="Alante Velez, home">
          <span className={s.logoMark} aria-hidden="true">
            AV
          </span>
          <span className={s.logoText}>Alante Velez</span>
        </Link>

        <nav aria-label="Main" className={s.navDesktop}>
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={l.current ? 'page' : undefined} className={l.current ? s.navCurrent : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={s.headerActions}>
          <Link href={inquiryHref()} className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`} onClick={() => setOpen(false)}>
            Let’s Talk
          </Link>
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

      <nav id="mobile-menu" aria-label="Main" className={s.navMobile} hidden={!open}>
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={l.current ? 'page' : undefined}
                className={l.current ? s.navCurrent : undefined}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href={inquiryHref()} onClick={() => setOpen(false)} className={s.navMobileCta}>
              Let’s Talk
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}
