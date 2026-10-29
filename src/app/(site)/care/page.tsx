import type { Metadata } from 'next'
import Link from 'next/link'
import s from '@/components/site/site.module.css'
import { CareCompare, CarePlanCards, CareTime, CostBreakdown, CtaBand, FaqList, PageHeader, SubNav } from '@/components/site/blocks'
import { inquiryHref } from '@/content/site'
import { careBenefits, careFaqs, careSubscribeNote, occasionalSupport } from '@/content/offers'
import { CARE_FLEXIBLE_TIME, CARE_STANDARD_MINUTES, CARE_TERMS, CARE_QUEUED_LINE, CARE_TERMS_PATH } from '@/content/care-terms'
import { CARE_SAMPLES } from '@/content/care-samples'
import CareSample from '@/components/site/CareSample'

const title = 'Website Care'
const description =
  'Optional monthly care plans from $59 a month: monthly website checks, a monthly health report, and flexible time for updates, fixes, new pages, or features. Occasional support is also available.'

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
            { href: '#sample', label: 'Sample report' },
            { href: '#time', label: 'How time works' },
            { href: '#terms', label: 'Care terms' },
            { href: '#support', label: 'Occasional support' },
            { href: '#faq', label: 'Questions' },
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
            Every plan includes monthly website checks and a monthly health report. Business and Premium Care add flexible time you can use on any
            website work. Care plans are optional.
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

      {/* ---------------- Sample report ---------------- */}
      <section id="sample" className={s.section} aria-labelledby="sample-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>Monthly health report</p>
          <h2 id="sample-title" className={s.sectionTitle}>
            See what you’d <em>get each month.</em>
          </h2>
          <p className={s.sectionLede}>
            A short report you can read in seconds: what passed, anything that needs attention, anything I couldn’t verify, and the next step. I review every report before it’s sent. These samples use fictional businesses.
          </p>
        </div>
        <CareSample samples={CARE_SAMPLES.map((x) => ({ ...x }))} />
      </section>

      {/* ---------------- Included time ---------------- */}
      <section id="time" className={s.section} aria-labelledby="time-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>How included time works</p>
          <h2 id="time-title" className={s.sectionTitle}>
            Clear time, <em>no surprises.</em>
          </h2>
          <p className={s.sectionLede}>{CARE_FLEXIBLE_TIME}</p>
          <p className={s.sectionLede}>{CARE_STANDARD_MINUTES}</p>
        </div>
        <CareTime />
      </section>

      {/* ---------------- Care terms ---------------- */}
      <section id="terms" className={s.section} aria-labelledby="terms-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>Care terms</p>
          <h2 id="terms-title" className={s.sectionTitle}>
            Know how it works <em>before you start.</em>
          </h2>
          <p className={s.sectionLede}>
            These terms are part of your care agreement. Plans are billed monthly in advance. {CARE_QUEUED_LINE}{' '}
            <Link href={CARE_TERMS_PATH}>Read the full agreement terms, including cancellation and refunds</Link>.
          </p>
        </div>
        <div className={s.benefits}>
          {CARE_TERMS.map((t) => (
            <div key={t.title} className={s.benefit} data-reveal>
              <h3 className={s.benefitTitle}>{t.title}</h3>
              {t.body.map((b) => <p key={b}>{b}</p>)}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Questions ---------------- */}
      <section id="faq" className={s.section} aria-labelledby="care-faq-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>Questions</p>
          <h2 id="care-faq-title" className={s.sectionTitle}>
            Plan time and billing, <em>answered.</em>
          </h2>
        </div>
        <FaqList faqs={careFaqs} />
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
