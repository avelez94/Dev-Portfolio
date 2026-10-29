import { Suspense } from 'react'
import HomeView from './_home/HomeView'

export const metadata = { title: 'Home' }

export default function HomePage() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  )
}
