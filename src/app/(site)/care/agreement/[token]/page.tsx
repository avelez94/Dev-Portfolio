import { notFound } from 'next/navigation'
import { careEnabled } from '@/lib/care/config'
import { demoDeployment } from '@/lib/demo/mode'
import AgreementClient from './AgreementClient'

export const dynamic = 'force-dynamic'

/** The client's persistent private care agreement page: read, sign, then pay. */
export default async function AgreementPage({ params }: { params: Promise<{ token: string }> }) {
  if (!careEnabled() && !demoDeployment()) notFound()
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound()
  return <AgreementClient token={token} />
}
