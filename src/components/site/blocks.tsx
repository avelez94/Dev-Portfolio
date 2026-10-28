import Image from 'next/image'
import Link from 'next/link'
import s from './site.module.css'
import { ArrowUpRight, Check, NotIncluded } from './Shapes'
import { projects, type Project } from '@/content/site'
import {
  SHOW_DRAFTS,
  UPTIME_MONITORING_CONFIGURED,
  carePlans,
  careExcludes,
  careIncludes,
  formatUSD,
  isDraft,
  packages,
  shown,
  type Faq,
  type Offer,
} from '@/content/offers'
import { inquiryHref } from '@/content/site'

/* ------------------------------------------------------------------ */
/* Draft helpers                                                        */
/* ------------------------------------------------------------------ */

export function Draft({ children = 'Draft' }: { children?: React.ReactNode }) {
  if (!SHOW_DRAFTS) return null
  return <span className={s.draft}>{children}</span>
}

/** Renders an offer value (with a Draft badge) or nothing at all. */
export function OfferText({ offer }: { offer: Offer<string | null> }) {
  const v = shown(offer)
  if (v === null && !SHOW_DRAFTS) return null
  return (
    <>
      {v ?? <span className={s.blank}>pending</span>}
      {isDraft(offer) && <Draft />}
    </>
  )
}

export function DraftBanner({ children }: { children: React.ReactNode }) {
  if (!SHOW_DRAFTS) return null
  return (
    <p className={s.draftBanner}>
      <strong>Preview only.</strong> {children}
    </p>
  )
}

function Price({ price, suffix }: { price: Offer<number | null> | 'discuss'; suffix?: string }) {
  if (price === 'discuss') {
    return (
      <p className={s.price}>
        <span className={`${s.priceValue} ${s.priceQuote}`}>Let’s discuss your project</span>
      </p>
    )
  }
  const v = shown(price)
  if (typeof v === 'number') {
    return (
      <p className={s.price}>
        <span className={s.priceLabel}>Starting at</span>
        <span className={s.priceValue}>
          {formatUSD(v)}
          {suffix && <span className={s.priceSuffix}>{suffix}</span>}
          {isDraft(price) && <Draft>Price pending approval</Draft>}
        </span>
      </p>
    )
  }
  if (SHOW_DRAFTS) {
    return (
      <p className={s.price}>
        <span className={s.priceLabel}>Starting at</span>
        <span className={`${s.priceValue} ${s.pricePending}`}>
          $ TBD{suffix && <span className={s.priceSuffix}>{suffix}</span>}
          <Draft>Price pending approval</Draft>
        </span>
      </p>
    )
  }
  return (
    <p className={s.price}>
      <span className={`${s.priceValue} ${s.priceQuote}`}>Pricing in your proposal</span>
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
/* Packages                                                             */
/* ------------------------------------------------------------------ */

export function PackageCards() {
  return (
    <div className={s.packages}>
      {packages.map((pk, i) => {
        const specs = pk.specs.filter((sp) => shown(sp.value) !== null)
        return (
          <article key={pk.id} className={s.packageCard} data-tone={i} data-reveal aria-labelledby={`pkg-${pk.id}`}>
            <h3 id={`pkg-${pk.id}`} className={s.packageName}>
              {pk.name}
            </h3>
            <p className={s.packageFor}>{pk.forWho}</p>
            <Price price={pk.price} />
            {specs.length > 0 && (
              <dl className={s.packageSpecs}>
                {specs.map((sp) => (
                  <div key={sp.label}>
                    <dt>{sp.label}</dt>
                    <dd>
                      <OfferText offer={sp.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <ul className={s.checkList}>
              {pk.includes.map((x) => (
                <li key={x}>
                  <Check />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <Link href={inquiryHref(pk.interest)} className={`${s.btn} ${i === 1 ? s.btnPrimary : s.btnGhost} ${s.btnBlock}`}>
              Ask About {pk.name}
            </Link>
          </article>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Care plans                                                           */
/* ------------------------------------------------------------------ */

/** True when visitors can actually see what makes the two plans different. */
export function plansDiffer() {
  return carePlans.some((p) => shown(p.timeAllowance) !== null || (p.priority && shown(p.priority) !== null) || shown(p.monthlyPrice) !== null)
}

function SharedIncludes() {
  return (
    <>
      {careIncludes.map((x) => (
        <li key={x}>
          <Check />
          <span>{x}</span>
        </li>
      ))}
      {UPTIME_MONITORING_CONFIGURED && (
        <li>
          <Check />
          <span>Uptime monitoring, so I hear about outages quickly</span>
        </li>
      )}
    </>
  )
}

export function CarePlanCards() {
  if (!plansDiffer()) {
    // Nothing that separates the plans is approved yet, so show one honest card.
    return (
      <div className={s.carePlans}>
        <article className={`${s.carePlan} ${s.carePlanSingle}`} data-reveal aria-labelledby="care-single">
          <h3 id="care-single" className={s.carePlanName}>
            Monthly website care
          </h3>
          <p className={s.packageFor}>
            Two levels, {carePlans.map((p) => p.name).join(' and ')}, depending on how often your site changes. Both include everything listed
            under What’s covered below, and your proposal spells out the details and cost.
          </p>
          <div className={s.planButtons}>
            {carePlans.map((p) => (
              <Link key={p.id} href={inquiryHref(p.interest)} className={`${s.btn} ${s.btnGhost}`}>
                Ask About {p.name}
              </Link>
            ))}
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className={s.carePlans}>
      {carePlans.map((cp, i) => {
        const time = shown(cp.timeAllowance)
        const priority = cp.priority ? shown(cp.priority) : null
        const response = shown(cp.responseTime)
        return (
          <article key={cp.id} className={s.carePlan} data-reveal aria-labelledby={`care-${cp.id}`}>
            <h3 id={`care-${cp.id}`} className={s.carePlanName}>
              {cp.name}
            </h3>
            <p className={s.packageFor}>{cp.forWho}</p>
            <Price price={cp.monthlyPrice} suffix=" / month" />
            <ul className={s.checkList}>
              {time !== null && (
                <li>
                  <Check />
                  <span>
                    Up to {time} a month for content updates and fixes <Draft />
                  </span>
                </li>
              )}
              <SharedIncludes />
              {priority !== null && (
                <li>
                  <Check />
                  <span>
                    {priority} <Draft />
                  </span>
                </li>
              )}
            </ul>
            {(response !== null || SHOW_DRAFTS) && (
              <p className={s.careResponse}>
                Response time: <OfferText offer={cp.responseTime} />
              </p>
            )}
            <Link href={inquiryHref(cp.interest)} className={`${s.btn} ${i === 1 ? s.btnPrimary : s.btnGhost} ${s.btnBlock}`}>
              Ask About {cp.name}
            </Link>
          </article>
        )
      })}
    </div>
  )
}

/** Side by side comparison. Only rows with something visible are rendered. */
export function CareCompare() {
  if (!plansDiffer()) return null
  const rows: { label: string; cells: React.ReactNode[] }[] = []
  const add = (label: string, cells: (React.ReactNode | null)[]) => {
    if (cells.some((c) => c !== null)) rows.push({ label, cells: cells.map((c, i) => c ?? <span key={i} className={s.cellNone}>Not included</span>) })
  }
  add(
    'Monthly time for updates and fixes',
    carePlans.map((p) => (shown(p.timeAllowance) !== null ? <OfferText key={p.id} offer={p.timeAllowance} /> : null))
  )
  add('Form and booking link checks', carePlans.map(() => 'Included'))
  add('Software updates and backups', carePlans.map(() => 'Where your platform needs them'))
  add(
    'Priority handling',
    carePlans.map((p) => (p.priority && shown(p.priority) !== null ? <OfferText key={p.id} offer={p.priority} /> : null))
  )
  if (SHOW_DRAFTS || carePlans.some((p) => shown(p.responseTime) !== null)) {
    rows.push({ label: 'Response time', cells: carePlans.map((p) => <OfferText key={p.id} offer={p.responseTime} />) })
  }

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

export function CareScope() {
  return (
    <div className={s.scope}>
      <div className={s.scopeCol} data-reveal>
        <h3 className={s.scopeTitle}>Every plan includes</h3>
        <ul className={s.checkList}>
          <SharedIncludes />
        </ul>
      </div>
      <div className={`${s.scopeCol} ${s.scopeNot}`} data-reveal>
        <h3 className={s.scopeTitle}>Not part of care plans</h3>
        <ul className={s.minusList}>
          {careExcludes.map((x) => (
            <li key={x}>
              <NotIncluded />
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className={s.scopeNote}>
          Those are quoted as their own projects. Care plans don’t include unlimited edits or around the clock support, and no one can promise a
          site will never have a problem. What a care plan does mean is that you won’t be figuring it out alone.
        </p>
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
