import type { Metadata } from 'next'
import Link from 'next/link'
import s from '@/components/site/site.module.css'
import { CtaBand, DraftBanner, FaqList, PackageCards, PageHeader, SubNav } from '@/components/site/blocks'
import { ServiceIcon } from '@/components/site/Shapes'
import { inquiryHref, processSteps, services, youllNeed } from '@/content/site'
import { projectFaqs } from '@/content/offers'

const title = 'Services & Pricing'
const description =
  'New websites, redesigns, online stores, booking and payments, custom web applications, and maintenance. See packages, what’s included, and how a project works.'

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
        lede="Brand new, long overdue for a refresh, or needing something custom. Here’s what I do, where packages start, and how we’d work together."
      >
        <SubNav
          items={[
            { href: '#services', label: 'Services' },
            { href: '#packages', label: 'Packages' },
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

      {/* ---------------- Packages ---------------- */}
      <section id="packages" className={s.pricing} aria-labelledby="packages-title">
        <div className={s.sectionHead} data-reveal>
          <p className={s.eyebrow}>Packages</p>
          <h2 id="packages-title" className={s.sectionTitle}>
            Clear starting points, <em>no guesswork.</em>
          </h2>
          <p className={s.sectionLede}>
            Every project gets a written proposal with the exact scope and price before any work begins. These packages show where things usually start.
          </p>
          <DraftBanner>Prices, page limits, revision rounds, and writing help below are proposals awaiting approval. Production builds leave them out.</DraftBanner>
        </div>
        <PackageCards />
        <div className={s.pricingNotes} data-reveal>
          <p>
            <strong>Good to know:</strong> extra pages, online stores, and integrations beyond a package are quoted separately. Third party
            subscriptions like domains, hosting, booking tools, or email services are paid to those providers and may add monthly costs.
          </p>
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
            Questions about care plans and maintenance live on the <Link href="/care">Website Care</Link> page.
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
