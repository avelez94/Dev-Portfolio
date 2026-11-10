/**
 * The client's private care agreement link. GET returns only what the page
 * shows; POST signs the current version. Reachable by anyone holding the
 * token, so nothing private (signature image, IP, notes) is ever returned.
 * Off (404) unless Website Care is enabled, or inside the preview demo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { careEnabled } from '@/lib/care/config'
import { CareError } from '@/lib/care/db'
import { publicAgreement, signAgreement, TOKEN_RE } from '@/lib/care/agreement'
import { inDemoScope } from '@/lib/demo/context'
import { NO_STORE } from '@/lib/public-docs'

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE })

function fail(e: unknown) {
  if (e instanceof CareError) return json({ error: e.status === 404 ? 'Not found' : e.message }, e.status)
  console.error('care agreement error', (e as Error).message)
  return json({ error: 'Something went wrong. Please try again.' }, 500)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!careEnabled() && !inDemoScope()) return json({ error: 'Not found' }, 404)
  const { token } = await params
  if (!TOKEN_RE.test(token)) return json({ error: 'Not found' }, 404)
  try { return json(await publicAgreement(token)) } catch (e) { return fail(e) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!careEnabled() && !inDemoScope()) return json({ error: 'Not found' }, 404)
  const { token } = await params
  if (!TOKEN_RE.test(token)) return json({ error: 'Not found' }, 404)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Please try again.' }, 400) }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  try { return json(await signAgreement(token, body, ip)) } catch (e) { return fail(e) }
}
