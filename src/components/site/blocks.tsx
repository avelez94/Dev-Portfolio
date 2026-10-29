import Image from 'next/image'
import Link from 'next/link'
import s from './site.module.css'
import { ArrowUpRight, Check } from './Shapes'
import { inquiryHref, projects, type Project } from '@/content/site'
import {
  SHOW_DRAFTS,
  UPTIME_MONITORING_CONFIGURED,
  carePlans,
  careBoundaries,
  careUpdatesNote,
  costs,
  costsNote,
  formatUSD,
  isDraft,
  packages,
  shown,
  updateExamples,
  type Faq,
} from '@/content/offers'

/* ------------------------------------------------------------------ */
/* Draft helpers (only used for the few policies still awaiting review) */
/* ------------------------------------------------------------------ */

export function Draft({ children = 'Draft' }: { children?: React.ReactNode }) {
  if (!SHOW_DRAFTS) return null
  return <span className={s.draft}>{children}</span>
}

function Price({ label, amount, suffix }: { label?: string; amount: number; suffix?: string }) {
  return (
    <p className={s.price}>
      {label && <span className={s.priceLabel}>{label}</span>}
      <span className={s.priceValue}>
        {formatUSD(amount)}
        {suffix && <span className={s.priceSuffix}>{suffix}</span>}
      </span>
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                        */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  lede,
  tone = 'cream',
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  lede: React.ReactNode
  tone?: 'cream' | 'teal'
  children?: React.ReactNode
}) {
  return (
    <header className={`${s.pageHeader} ${tone === 'teal' ? s.pageHeaderTeal : ''}`}>
      <div className={s.pageHeaderInner}>
        <p className={tone === 'teal' ? s.eyebrowLight : s.eyebrow}>{eyebrow}</p>
        <h1 className={s.pageTitle}>{title}</h1>
        <p className={s.pageLede}>{lede}</p>
        {children}
      </div>
    </header>
  )
}

export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className={s.subnav}>
      <ul>
        {items.map((i) => (
          <li key={i.href}>
            <a href={i.href}>{i.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function CtaBand({ title, body, label, href }: { title: React.ReactNode; body: string; label: string; href: string }) {
  return (
    <section className={s.ctaBand} aria-labelledby="cta-title" data-reveal>
      <div className={s.ctaInner}>
        <div>
          <h2 id="cta-title" className={s.ctaTitle}>
            {title}
          </h2>
          <p className={s.ctaBody}>{body}</p>
        </div>
        <Link href={href} className={`${s.btn} ${s.btnPrimary} ${s.btnLarge}`}>
          {label}
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Work                                                                 */
/* ------------------------------------------------------------------ */

function ProjectCard({ p, feature }: { p: Project; feature: boolean }) {
  return (
    <article
      className={`${s.project} ${feature ? s.projectFeature : ''}`}
      style={{ '--brand-bg': p.brand.bg, '--brand-accent': p.brand.accent } as React.CSSProperties}
      aria-labelledby={`proj-${p.slug}`}
      data-reveal
    >
      <div className={s.projectShot}>
        <span className={s.browserBar} aria-hidden="true">
          <span />
          <span />
          <span />
          <span className={s.browserUrl}>{p.urlLabel}</span>
        </span>
        <Image
          src={p.image.src}
          alt={p.image.alt}
          width={p.image.width}
          height={p.image.height}
          sizes={feature ? '(max-width: 900px) 92vw, 680px' : '(max-width: 900px) 92vw, 560px'}
          className={s.projectImg}
        />
      </div>
      <div className={s.projectBody}>
        <div className={s.projectMeta}>
          <span className={s.kicker}>{p.kicker}</span>
          {p.concept && <span className={s.conceptTag}>Concept project</span>}
          <span className={s.swatches} role="img" aria-label="The site’s brand colors">
            {p.brand.swatches.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
        </div>
        <h3 id={`proj-${p.slug}`} className={s.projectName}>
          {p.name}
        </h3>
        {p.role && <p className={s.projectRole}>My role: {p.role}</p>}
        <p className={s.projectWho}>
          <strong>For:</strong> {p.whoFor}
        </p>
        <p className={s.projectBuilt}>{p.whatIBuilt}</p>
        <p className={s.actionsLabel}>Visitors can</p>
        <ul className={s.chips}>
          {p.visitorActions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className={s.projectLink}>
          Visit {p.name}
          <ArrowUpRight />
          <span className={s.srOnly}> (opens in a new tab)</span>
        </a>
      </div>
    </article>
  )
}

export function ProjectGrid() {
  return (
    <div className={s.projects}>
      {projects.map((p, i) => (
        <ProjectCard key={p.slug} p={p} feature={i === 0} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Project categories                                                   */
/* ------------------------------------------------------------------ */

export function PackageCards() {
  return (
    <div className={s.packages}>
      {packages.map((pk, i) => (
        <article key={pk.id} className={s.packageCard} data-tone={i} data-reveal aria-labelledby={`pkg-${pk.id}`}>
          <h3 id={`pkg-${pk.id}`} className={s.packageName}>
            {pk.name}
          </h3>
          <p className={s.packageFor}>{pk.forWho}</p>
          <Price label={pk.priceLabel} amount={pk.price} />
          <p className={s.listLabel}>{pk.listLabel}</p>
          <ul className={s.checkList}>
            {pk.items.map((x) => (
              <li key={x}>
                <Check />
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <div className={s.packageNotes}>
            {pk.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
          <Link href={inquiryHref(pk.interest)} className={`${s.btn} ${i === 1 ? s.btnPrimary : s.btnGhost} ${s.btnBlock}`}>
            {pk.cta}
          </Link>
        </article>
      ))}
    </div>
  )
}

/** The three separate costs of a website. `compact` is the short version for the care page. */
export function CostBreakdown({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={`${s.costs} ${compact ? s.costsCompact : ''}`}>
      {costs.map((c, i) => (
        <li key={c.name} data-reveal style={{ '--i': i } as React.CSSProperties}>
          <span className={s.costNum} aria-hidden="true">
            {i + 1}
          </span>
          <span>
            <strong className={s.costName}>{c.name}</strong>
            {!compact && <span className={s.costBody}>{c.body}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function CostsNote() {
  return <p className={s.costsNote}>{costsNote}</p>
}

/* ------------------------------------------------------------------ */
/* Care plans                                                           */
/* ------------------------------------------------------------------ */

export function CarePlanCards() {
  return (
    <div className={s.carePlans}>
      {carePlans.map((cp, i) => (
        <article key={cp.id} className={s.carePlan} data-tone={i} data-reveal aria-labelledby={`care-${cp.id}`}>
          <h3 id={`care-${cp.id}`} className={s.carePlanName}>
            {cp.name}
          </h3>
          <p className={s.packageFor}>{cp.forWho}</p>
          <Price amount={cp.monthly} suffix=" / month" />
          <ul className={s.checkList}>
            {cp.items.map((x) => (
              <li key={x}>
                <Check />
                <span>{x}</span>
              </li>
            ))}
            {UPTIME_MONITORING_CONFIGURED && (
              <li>
                <Check />
                <span>Uptime monitoring</span>
              </li>
            )}
          </ul>
          <Link href={inquiryHref(cp.interest)} className={`${s.btn} ${i === 1 ? s.btnPrimary : s.btnGhost} ${s.btnBlock}`}>
            {cp.cta}
          </Link>
        </article>
      ))}
    </div>
  )
}

/** Side by side comparison of the three plans. */
export function CareCompare() {
  const rows: { label: string; cells: React.ReactNode[] }[] = [
    { label: 'Monthly price', cells: carePlans.map((p) => `${formatUSD(p.monthly)} / month`) },
    { label: 'Monthly website checks', cells: carePlans.map(() => 'Agreed pages, forms, and booking links') },
    { label: 'Monthly health report', cells: carePlans.map(() => 'Included, reviewed by me') },
    {
      label: 'Time for content updates or troubleshooting',
      cells: carePlans.map((p) =>
        p.minutes ? (
          `Up to ${p.minutes} minutes a month`
        ) : (
          <span key={p.id} className={s.cellNone}>
            Quoted separately
          </span>
        )
      ),
    },
  ]
  return (
    <div className={s.compareWrap} data-reveal>
      <table className={s.compare}>
        <caption className={s.srOnly}>Care plan comparison</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className={s.srOnly}>Feature</span>
            </th>
            {carePlans.map((p) => (
              <th key={p.id} scope="col">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CareTime() {
  return (
    <div className={s.scope}>
      <div className={s.scopeCol} data-reveal>
        <h3 className={s.scopeTitle}>What a content update looks like</h3>
        <ul className={s.checkList}>
          {updateExamples.map((x) => (
            <li key={x}>
              <Check />
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className={s.scopeNote}>{careUpdatesNote}</p>
      </div>
      <div className={`${s.scopeCol} ${s.scopeNot}`} data-reveal>
        <h3 className={s.scopeTitle}>Good to know</h3>
        <ul className={s.dotList}>
          {careBoundaries.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                  */
/* ------------------------------------------------------------------ */

export function FaqList({ faqs }: { faqs: Faq[] }) {
  const visible = faqs.filter((f) => shown(f.a) !== null)
  return (
    <div className={s.faqList}>
      {visible.map((f) => (
        <details key={f.q} className={s.faqItem}>
          <summary>
            <span>
              {f.q} {isDraft(f.a) && <Draft>Needs your review</Draft>}
            </span>
            <span className={s.summaryIcon} aria-hidden="true" />
          </summary>
          <p>{f.a.value}</p>
        </details>
      ))}
    </div>
  )
}
