import type { Metadata } from 'next'
import Link from 'next/link'
import s from '@/components/site/site.module.css'
import { CareCompare, CarePlanCards, plansDiffer, CareScope, CtaBand, DraftBanner, FaqList, PageHeader, SubNav } from '@/components/site/blocks'
import { inquiryHref } from '@/content/site'
import { careBenefits, careFaqs } from '@/content/offers'

const title = 'Website Care'
const description =
  'Monthly website care plans for content updates, form and booking link checks, troubleshooting, and software updates. See what’s included and what isn’t.'

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
        lede="If you’d like me to keep looking after your site, a care plan covers the small stuff each month so things keep running smoothly and you always know who to call."
      >
        <SubNav
          items={[
            { href: '#plans', label: 'Plans' },
            { href: '#scope', label: 'What’s covered' },
            { href: '#questions', label: 'Questions' },
          ]}
        />
      </PageHeader>

      {/* ---------------- Benefits ---------------- */}
      <section className={s.section} aria-labelledby="benefits-title">
        <h2 id="benefits-title" className={s.srOnly}>
          Why a care plan helps
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
            {plansDiffer()
              ? 'Both plans include the same checks and care. The difference is how much monthly time you get for updates and fixes.'
              : 'Choose the level of care that matches how often your site changes.'}
          </p>
          <DraftBanner>Prices, monthly time allowances, response times, and priority handling below are proposals awaiting approval. Production builds leave them out.</DraftBanner>
        </div>
        <CarePlanCards />
        <CareCompare />
      </section>

      {/* ---------------- Scope ---------------- */}
      <section id="scope" className={s.section} aria-labelledby="scope-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>What’s covered</p>
          <h2 id="scope-title" className={s.sectionTitle}>
            Care keeps things running. <em>New work is its own project.</em>
          </h2>
          <p className={s.sectionLede}>
            Want new pages, features, or a fresh look? See <Link href="/services">Services & Pricing</Link>.
          </p>
        </div>
        <CareScope />
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="questions" className={s.faq} aria-labelledby="faq-title">
        <div className={s.faqIntro} data-reveal>
          <p className={s.eyebrow}>Questions</p>
          <h2 id="faq-title" className={s.sectionTitle}>
            About <em>website care.</em>
          </h2>
          <p className={s.sectionLede}>
            Questions about new projects live on the <Link href="/services#questions">Services & Pricing</Link> page.
          </p>
        </div>
        <FaqList faqs={careFaqs} />
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
