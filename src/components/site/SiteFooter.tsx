import Link from 'next/link'
import s from './site.module.css'
import Year from './Year'
import { CONTACT_EMAIL, about, inquiryHref, navLinks, projects } from '@/content/site'

export default function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.footerTop}>
        <div>
          <p className={s.footerName}>Alante Velez</p>
          <p className={s.footerTag}>Websites people are excited to share.</p>
          <p className={s.footerTag}>{about.location}</p>
        </div>
        <nav aria-label="Footer" className={s.footerNav}>
          <p className={s.footerLabel}>Pages</p>
          <ul>
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
            <li>
              <Link href={inquiryHref()}>Let’s Talk</Link>
            </li>
          </ul>
        </nav>
        <div className={s.footerWork}>
          <p className={s.footerLabel}>Recent sites</p>
          <ul>
            {projects.map((p) => (
              <li key={p.slug}>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.name}
                  <span className={s.srOnly}> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={s.footerBottom}>
        <p>
          © <Year initial={new Date().getFullYear()} /> Alante Velez. All rights reserved.
        </p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </div>
    </footer>
  )
}
