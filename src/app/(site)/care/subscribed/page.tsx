import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import s from '@/components/site/site.module.css'
import { PageHeader } from '@/components/site/blocks'
import { careEnabled } from '@/lib/care/config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thank you',
  robots: { index: false, follow: false },
}

/**
 * Where Stripe Checkout returns. This page only says thanks: it does not start
 * or confirm anything. Only Stripe's verified payment notice starts the paid
 * period and queues its check.
 */
export default function CareSubscribedPage() {
  if (!careEnabled()) notFound()
  return (
    <PageHeader
      tone="teal"
      eyebrow="Website care"
      title="Thank you."
      lede="Stripe is confirming your payment. Your monthly website check is automatically queued when payment is confirmed, and I’ll send your report once I’ve reviewed the results. Questions in the meantime? Just reply to any of my emails."
    >
      <Link href="/care" className={`${s.btn} ${s.btnGhost}`}>
        Back to Website Care
      </Link>{' '}
      <Link href="/care/terms" className={`${s.btn} ${s.btnGhost}`}>
        Care Terms
      </Link>
    </PageHeader>
  )
}
