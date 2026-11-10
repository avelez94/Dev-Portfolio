/**
 * Continue to payment from the client's agreement page. Opens (or reuses) a
 * Stripe Checkout for the verified price, only for a signed agreement that
 * still covers the confirmed scope, plan and price.
 */
import { NextRequest, NextResponse } from 'next/server'
import { careEnabled } from '@/lib/care/config'
import { CareError } from '@/lib/care/db'
import { agreementCheckout, TOKEN_RE } from '@/lib/care/agreement'
import { inDemoScope } from '@/lib/demo/context'
import { NO_STORE } from '@/lib/public-docs'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!careEnabled() && !inDemoScope()) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  const { token } = await params
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  try {
    const link = await agreementCheckout(token)
    return NextResponse.json({ url: link.url }, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof CareError) {
      // Price and Stripe details are for the owner; the client gets a plain message.
      const msg = e.status === 404 ? 'Not found' : /Stripe|price ID|price \w+_/i.test(e.message) ? 'Payment isn’t available right now. I’ve been notified and will follow up.' : e.message
      return NextResponse.json({ error: msg }, { status: e.status, headers: NO_STORE })
    }
    console.error('care agreement checkout error', (e as Error).message)
    return NextResponse.json({ error: 'Payment isn’t available right now. Please try again shortly.' }, { status: 500, headers: NO_STORE })
  }
}
