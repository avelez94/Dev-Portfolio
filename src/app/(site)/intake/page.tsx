import type { Metadata } from 'next'
import { Suspense } from 'react'
import IntakeWizard from '@/components/site/IntakeWizard'

export const metadata: Metadata = {
  title: 'Project Questionnaire',
  description: 'Tell me about your project in about five minutes, then choose a time for a 20 minute discovery call.',
  alternates: { canonical: '/intake' },
  // The page can carry a private link token, so don't send it to other sites.
  referrer: 'no-referrer',
}

export default function IntakePage() {
  return (
    <Suspense fallback={null}>
      <IntakeWizard />
    </Suspense>
  )
}
