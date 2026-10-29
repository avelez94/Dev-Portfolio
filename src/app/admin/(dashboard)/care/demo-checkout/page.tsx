import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { demoDeployment } from '@/lib/demo/mode'
import DemoCheckout from './DemoCheckout'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Simulated checkout' }

/** Demo only: stands in for the Stripe checkout page the client would see. */
export default function DemoCheckoutPage() {
  if (!demoDeployment()) notFound()
  return <DemoCheckout />
}
