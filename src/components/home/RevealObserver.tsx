'use client'

import { useEffect } from 'react'

/**
 * Progressive scroll reveal. Content is fully visible without JavaScript:
 * elements with [data-reveal] are only hidden after this component adds
 * `reveal-ready` to <html>, and never when the visitor prefers reduced motion.
 */
export default function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduce.matches || !('IntersectionObserver' in window)) return

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    // Anything already on screen shows immediately, so nothing blinks on load.
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
      root.classList.remove('reveal-ready')
    }
  }, [])

  return null
}
