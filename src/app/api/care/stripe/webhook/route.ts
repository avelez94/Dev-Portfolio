/**
 * Stripe webhook for Website Care. The signature is verified against the raw
 * body before anything else happens. Events are recorded once by id; a
 * processing error returns 500 so Stripe retries it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { careEnabled, careOff } from '@/lib/care/config'
import { CareError } from '@/lib/care/db'
import { verifyEvent, processEvent } from '@/lib/care/stripe'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!careEnabled()) return careOff()
  const raw = await req.text()
  let event
  try {
    event = verifyEvent(raw, req.headers.get('stripe-signature'))
  } catch (e) {
    const status = e instanceof CareError ? e.status : 400
    return NextResponse.json({ error: e instanceof CareError ? e.message : 'Invalid request' }, { status })
  }
  try {
    const r = await processEvent(event)
    return NextResponse.json({ received: true, ...r })
  } catch (e) {
    console.error('care webhook processing failed', event.type, event.id, (e as Error).message)
    return NextResponse.json({ error: 'Processing failed; Stripe will retry.' }, { status: 500 })
  }
}
