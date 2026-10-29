import type { Metadata } from 'next'
import Link from 'next/link'
import s from '@/components/site/site.module.css'
import { PageHeader, SubNav } from '@/components/site/blocks'
import { CARE_AGREEMENT_TERMS, CARE_AGREEMENT_VERSION, CARE_TERMS_EFFECTIVE } from '@/content/care-terms'

const title = 'Website Care Terms'
const description = 'The Website Care agreement terms: plan time, billing, your monthly check, cancelling and refunds.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/care/terms' },
  openGraph: { title: `${title} | Alante Velez`, description, url: '/care/terms' },
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/ /g, '-')

/**
 * The versioned care agreement terms. The agreement a client signs shows the
 * same sections (src/content/care-terms.ts), with their scope and price.
 */
export default function CareTermsPage() {
  return (
    <>
      <PageHeader
        tone="teal"
        eyebrow="Website care"
        title="Care plan terms."
        lede={`Plan time, billing, your monthly check, cancelling and refunds, in plain language. Version ${CARE_AGREEMENT_VERSION}, effective ${CARE_TERMS_EFFECTIVE}.`}
      >
        <SubNav
          items={[
            { href: '#billing-and-your-monthly-check', label: 'Billing' },
            { href: '#refunds', label: 'Refunds' },
            { href: '#cancelling', label: 'Cancelling' },
            { href: '#duplicate-or-incorrect-charges', label: 'Billing errors' },
          ]}
        />
      </PageHeader>

      <section className={s.section} aria-label="Terms">
        <div className={s.termsDoc}>
          {CARE_AGREEMENT_TERMS.map((sec) => (
            <section key={sec.title} id={slug(sec.title)} className={s.termsDocSection} aria-labelledby={`${slug(sec.title)}-h`}>
              <h2 id={`${slug(sec.title)}-h`} className={s.termTitle}>
                {sec.title}
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
