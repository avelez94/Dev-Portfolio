import type { Metadata } from 'next'
import Link from 'next/link'
import s from '@/components/site/site.module.css'
import { PageHeader, SubNav } from '@/components/site/blocks'
import { CARE_TERMS_EFFECTIVE, CARE_TERMS_VERSION, careTermsSections } from '@/content/care-terms'

const title = 'Website Care Terms'
const description = 'How Website Care plans are billed, how the monthly check starts, and how cancellation and refunds work.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/care/terms' },
  openGraph: { title: `${title} | Alante Velez`, description, url: '/care/terms' },
}

/**
 * The versioned care terms that Stripe Checkout asks clients to accept.
 * Content lives in src/content/care-terms.ts so every surface shares it.
 */
export default function CareTermsPage() {
  return (
    <>
      <PageHeader
        tone="teal"
        eyebrow="Website care"
        title="Care plan terms."
        lede={`Billing, your monthly check, cancelling and refunds, in plain language. Version ${CARE_TERMS_VERSION}, effective ${CARE_TERMS_EFFECTIVE}.`}
      >
        <SubNav
          items={[
            { href: '#billing', label: 'Billing' },
            { href: '#refunds', label: 'Refunds' },
            { href: '#cancel', label: 'Cancelling' },
            { href: '#billing-errors', label: 'Billing errors' },
          ]}
        />
      </PageHeader>

      <section className={s.section} aria-label="Terms">
        <div className={s.termsDoc}>
          {careTermsSections.map((sec) => (
            <section key={sec.id} id={sec.id} className={s.termsDocSection} aria-labelledby={`${sec.id}-h`}>
              <h2 id={`${sec.id}-h`} className={s.termTitle}>
                {sec.heading}
              </h2>
              {sec.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
          <p className={s.termsDocFoot}>
            Questions about these terms? <Link href="/care">Back to Website Care</Link> or just reply to any of my emails.
          </p>
        </div>
      </section>
    </>
  )
}
