import type { Metadata } from 'next'
import { demoDeployment } from '@/lib/demo/mode'
import DemoDocBridge from '../../../../admin/_demo/DemoDocBridge'

export const metadata: Metadata = { title: 'Your care agreement', robots: { index: false, follow: false } }

/** On demo deployments, a signed in demo session sees this client page with demo data. */
export default function AgreementLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {demoDeployment() && <DemoDocBridge />}
      {children}
    </>
  )
}
