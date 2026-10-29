import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import s from '@/components/site/site.module.css'
import { PageHeader } from '@/components/site/blocks'
import { careDemo } from '@/content/care-demo'
import { CARE_QUEUED_LINE } from '@/content/care-terms'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Payment to scan demo',
  robots: { index: false, follow: false },
}

/**
 * Preview only walkthrough of what happens after a care payment, built from a
 * recorded local test run. Never served on the production deployment.
 */
export default function PaymentToScanDemo() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const d = careDemo
  return (
    <>
      <PageHeader
        tone="teal"
        eyebrow="Preview only • fictional data"
        title="From payment to scan."
        lede={`${CARE_QUEUED_LINE} This walkthrough was recorded from a local end to end run of the real app with mock Stripe, GitHub and email services.`}
      />

      <section className={s.section} aria-labelledby="timeline-h">
        <div className={s.termsDoc}>
          <h2 id="timeline-h" className={s.sectionTitleSm}>
            One payment, <em>recorded.</em>
          </h2>
          <p className={s.termsDocFoot}>
            {d.plan} • recorded {d.recordedAt} • {d.checksPassed} of {d.checksTotal} payment checks passed in that run
          </p>
          <ol className={s.demoSteps}>
            {d.steps.map((st, i) => (
              <li key={i} className={s.termsDocSection}>
                <span className={s.demoAt}>{st.at}</span>
                <h3 className={s.termTitle}>{st.label}</h3>
                <p>{st.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={s.section} aria-labelledby="scen-h">
        <div className={s.termsDoc}>
          <h2 id="scen-h" className={s.sectionTitleSm}>
            Every case, <em>tested.</em>
          </h2>
          {d.scenarios.map((sc) => (
            <section key={sc.title} className={s.termsDocSection} aria-label={sc.title}>
              <h3 className={s.termTitle}>{sc.title}</h3>
              <p>
                <strong>When:</strong> {sc.what}
              </p>
              <p>
                <strong>Then:</strong> {sc.outcome}
              </p>
            </section>
          ))}
          <p className={s.termsDocFoot}>
            <Link href="/care/terms">Care terms</Link> • <Link href="/care#questions">Billing FAQ</Link>
          </p>
        </div>
      </section>
    </>
  )
}
