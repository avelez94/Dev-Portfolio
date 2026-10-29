import type { Metadata } from 'next'
import { Suspense } from 'react'
import BookingCalendar from '@/components/site/BookingCalendar'

export const metadata: Metadata = {
  title: 'Book Your Discovery Call',
  description: 'Choose a time for a 20 minute discovery call.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookingCalendar />
    </Suspense>
  )
}
