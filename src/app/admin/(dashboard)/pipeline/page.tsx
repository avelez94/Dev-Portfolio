import { Suspense } from 'react'
import PipelineView from './_parts/PipelineView'

export const metadata = { title: 'Pipeline' }

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineView />
    </Suspense>
  )
}
