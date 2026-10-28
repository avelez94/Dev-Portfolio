'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Progressive scroll reveal. Content is fully visible without JavaScript:
 * elements with [data-reveal] are only hidden after this component adds
 * `reveal-ready` to <html>, and never when the visitor prefers reduced motion.
 * Re-runs on every route change so client side navigation reveals new pages.
 */
export default function RevealObserver() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduce.matches || !('IntersectionObserver' in window)) return

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    els.forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-visible')
    })
    root.classList.add('reveal-ready')

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )
    els.forEach((el) => {
      if (!el.classList.contains('is-visible')) io.observe(el)
    })

    const onChange = () => {
      if (reduce.matches) {
        els.forEach((el) => el.classList.add('is-visible'))
        root.classList.remove('reveal-ready')
      }
    }
    reduce.addEventListener('change', onChange)

    return () => {
      io.disconnect()
      reduce.removeEventListener('change', onChange)
      // Leave everything visible while the next route mounts.
      els.forEach((el) => el.classList.add('is-visible'))
      root.classList.remove('reveal-ready')
    }
  }, [pathname])

  return null
}
