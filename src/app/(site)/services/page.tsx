import type { Metadata } from 'next'
import Link from 'next/link'
import s from '@/components/site/site.module.css'
import { CostBreakdown, CostsNote, CtaBand, FaqList, PackageCards, PageHeader, SubNav } from '@/components/site/blocks'
import { ServiceIcon } from '@/components/site/Shapes'
import { inquiryHref, processSteps, services, youllNeed } from '@/content/site'
import { projectFaqs, projectTerms } from '@/content/offers'

const title = 'Services & Pricing'
const description =
  'Business websites from $1,500, booking and payment sites from $2,500, and custom websites or applications from $5,000. See what’s included, how projects work, and what costs to expect.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/services' },
  openGraph: { title: `${title} | Alante Velez`, description, url: '/services' },
  twitter: { title: `${title} | Alante Velez`, description },
}

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services & Pricing"
        title={
          <>
            Whatever stage you’re at, <em>we can start there.</em>
          </>
        }
        lede="Brand new, long overdue for a refresh, or needing something custom. Here’s what I help with, where projects start, and how we’d work together."
      >
        <SubNav
          items={[
            { href: '#services', label: 'Services' },
            { href: '#pricing', label: 'Pricing' },
            { href: '#costs', label: 'Costs' },
            { href: '#process', label: 'How it works' },
            { href: '#questions', label: 'Questions' },
          ]}
        />
      </PageHeader>

      {/* ---------------- Services ---------------- */}
      <section id="services" className={s.section} aria-labelledby="services-title">
        <div className={s.sectionHead} data-reveal>
          <h2 id="services-title" className={s.sectionTitleSm}>
            Six ways I can help
          </h2>
          <p className={s.sectionLede}>These are the needs I help with. Each one fits into one of the three project types below, depending on scope.</p>
        </div>
        <ul className={s.serviceGrid}>
          {services.map((sv, i) => (
            <li key={sv.id} className={s.serviceItem} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <span className={s.serviceIcon} data-tone={i % 3}>
                <ServiceIcon id={sv.id} />
              </span>
              <div>
                <h3 className={s.serviceName}>{sv.name}</h3>
                <p className={s.serviceBody}>{sv.body}</p>
                <div className={s.serviceLinks}>
                  <Link href={inquiryHref(sv.id)} className={s.inlineLink}>
                    Ask about {sv.name.toLowerCase()}
                  </Link>
                  {sv.id === 'care' && (
                    <Link href="/care" className={s.inlineLink}>
                      See care plans
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="pricing" className={s.pricing} aria-labelledby="pricing-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>Pricing</p>
          <h2 id="pricing-title" className={s.sectionTitle}>
            Three ways to start, <em>no guesswork.</em>
          </h2>
          <p className={s.sectionLede}>
            Starting prices cover the baseline scope listed on each card. Your final price depends on your requirements and is confirmed in a written
            proposal before any work begins.
          </p>
        </div>
        <PackageCards />
        <p className={s.guideLink} data-reveal>
          <a href="/Website_Pricing_Guide.pdf" download className={`${s.btn} ${s.btnGhost}`}>
            Download the Pricing Guide
          </a>
          <span>PDF, 5 pages. The same offers as this page, ready to save or share.</span>
        </p>
      </section>

      {/* ---------------- Costs ---------------- */}
      <section id="costs" className={s.section} aria-labelledby="costs-title">
        <div className={s.costsPanel} data-reveal>
          <div>
            <p className={s.eyebrow}>What you’ll pay for</p>
            <h2 id="costs-title" className={s.sectionTitleSm}>
              Three costs, kept separate
            </h2>
            <CostsNote />
            <p className={s.costsNote}>
              Ongoing care is optional. See <Link href="/care">Website Care</Link> for plans and occasional support.
            </p>
          </div>
          <CostBreakdown />
        </div>
      </section>

      {/* ---------------- Process ---------------- */}
      <section id="process" className={s.process} aria-labelledby="process-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>How it works</p>
          <h2 id="process-title" className={s.sectionTitle}>
            Four steps, <em>zero mystery.</em>
          </h2>
        </div>
        <ol className={s.steps}>
          {processSteps.map((st, i) => (
            <li key={st.name} className={s.step} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <span className={s.stepNum} aria-hidden="true">
                {i + 1}
              </span>
              <h3 className={s.stepName}>{st.name}</h3>
              <p className={s.stepBody}>{st.body}</p>
            </li>
          ))}
        </ol>

        <div className={s.termsGrid}>
          {projectTerms.map((term, i) => (
            <div key={term.title} className={s.termCard} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <h3 className={s.termTitle}>{term.title}</h3>
              <p>{term.body}</p>
            </div>
          ))}
        </div>

        <div className={s.needCard} data-reveal>
          <h3 className={s.needTitle}>What I’ll need from you</h3>
          <ul>
            {youllNeed.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="questions" className={s.faq} aria-labelledby="faq-title">
        <div className={s.faqIntro} data-reveal>
          <p className={s.eyebrow}>Questions</p>
          <h2 id="faq-title" className={s.sectionTitle}>
            Good questions <em>to ask.</em>
          </h2>
          <p className={s.sectionLede}>
            Questions about care plans and occasional support are answered on the <Link href="/care">Website Care</Link> page.
          </p>
        </div>
        <FaqList faqs={projectFaqs} />
      </section>

      <CtaBand
        title={
          <>
            Ready when <em>you are.</em>
          </>
        }
        body="Tell me a little about your business and what you need. I’ll take it from there."
        label="Let’s Talk About Your Website"
        href={inquiryHref()}
      />
    </>
  )
}
