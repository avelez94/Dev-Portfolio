import type { Metadata } from 'next'
import Link from 'next/link'
import s from '@/components/site/site.module.css'
import { CareCompare, CarePlanCards, CareTime, CostBreakdown, CtaBand, PageHeader, SubNav } from '@/components/site/blocks'
import { inquiryHref } from '@/content/site'
import { careBenefits, careSubscribeNote, occasionalSupport } from '@/content/offers'

const title = 'Website Care'
const description =
  'Optional monthly care plans from $59 a month: monthly website checks, a monthly health report, and time for content updates or troubleshooting. Occasional support is also available.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/care' },
  openGraph: { title: `${title} | Alante Velez`, description, url: '/care' },
  twitter: { title: `${title} | Alante Velez`, description },
}

export default function CarePage() {
  return (
    <>
      <PageHeader
        tone="teal"
        eyebrow="Website care"
        title="Launch day isn’t goodbye."
        lede="If you’d like me to keep looking after your site, a care plan covers regular checks and, on most plans, time each month for updates. If you’d rather ask for help only when you need it, that works too."
      >
        <SubNav
          items={[
            { href: '#plans', label: 'Plans' },
            { href: '#time', label: 'How time works' },
            { href: '#support', label: 'Occasional support' },
          ]}
        />
      </PageHeader>

      {/* ---------------- Benefits ---------------- */}
      <section className={s.section} aria-labelledby="benefits-title">
        <h2 id="benefits-title" className={s.srOnly}>
          What a care plan gives you
        </h2>
        <ul className={s.benefits}>
          {careBenefits.map((b, i) => (
            <li key={b.title} className={s.benefit} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <span className={s.benefitNum} aria-hidden="true">
                {i + 1}
              </span>
              <h3 className={s.benefitTitle}>{b.title}</h3>
              <p>{b.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Plans ---------------- */}
      <section id="plans" className={s.section} aria-labelledby="plans-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>Plans</p>
          <h2 id="plans-title" className={s.sectionTitle}>
            Pick the pace <em>that fits.</em>
          </h2>
          <p className={s.sectionLede}>
            Every plan includes monthly website checks and a monthly health report. Business and Premium Care add monthly time for content updates or
            troubleshooting. Care plans are optional.
          </p>
        </div>
        <CarePlanCards />
        <CareCompare />
        {careSubscribeNote.approved && (
          <p className={s.sectionLede} data-reveal>
            <strong>{careSubscribeNote.title}.</strong> {careSubscribeNote.body}
          </p>
        )}
      </section>

      {/* ---------------- Included time ---------------- */}
      <section id="time" className={s.section} aria-labelledby="time-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>How included time works</p>
          <h2 id="time-title" className={s.sectionTitle}>
            Clear time, <em>no surprises.</em>
          </h2>
          <p className={s.sectionLede}>
            Business and Premium Care include a set amount of time each month instead of a count of edits, so small changes and quick fixes fit
            naturally.
          </p>
        </div>
        <CareTime />
      </section>

      {/* ---------------- Occasional support ---------------- */}
      <section id="support" className={s.section} aria-labelledby="support-title">
        <div className={s.supportPanel} data-reveal>
          <div>
            <p className={s.eyebrow}>Occasional support</p>
            <h2 id="support-title" className={s.sectionTitleSm}>
              Need help now and then?
            </h2>
            <p className={s.sectionLede}>No plan required. Ask when something comes up.</p>
            <Link href={inquiryHref('support')} className={`${s.btn} ${s.btnGhost}`}>
              Ask About Occasional Support
            </Link>
          </div>
          <ul className={s.dotList}>
            {occasionalSupport.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- Costs reference ---------------- */}
      <section className={s.section} aria-labelledby="costs-ref-title">
        <div className={s.costsRef} data-reveal>
          <h2 id="costs-ref-title" className={s.sectionTitleSm}>
            Care is one of three separate costs
          </h2>
          <CostBreakdown compact />
          <p className={s.costsNote}>
            Hosting, domains, provider subscriptions, and transaction fees are paid separately from any care plan.{' '}
            <Link href="/services#costs">How the costs work</Link>.
          </p>
        </div>
      </section>

      <CtaBand
        title={
          <>
            Want someone <em>in your corner?</em>
          </>
        }
        body="Tell me about your site and how often it changes, and I’ll suggest the plan that fits."
        label="Ask About Website Care"
        href={inquiryHref('care')}
      />
    </>
  )
}
