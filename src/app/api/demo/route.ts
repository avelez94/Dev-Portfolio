/**
 * The admin demo engine (preview deployments only; see src/lib/demo). The
 * browser posts the admin request it would have made, together with its demo
 * session's state; the request runs against that state and the result comes
 * back with the updated state. Requires the admin sign in. Answers 404 on
 * production and wherever demo mode is off.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { demoDeployment } from '@/lib/demo/mode'
import { installDemoIntercept } from '@/lib/demo/intercept'
import { withDemo, type DemoState } from '@/lib/demo/engine'
import { dispatchDemo, seedWork, type DemoRequest } from '@/lib/demo/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BODY = 4_000_000
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])

export async function POST(req: NextRequest) {
  if (!demoDeployment()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const denied = requireAdmin(req)
  if (denied) return denied
  installDemoIntercept()
  const text = await req.text()
  if (text.length > MAX_BODY) return NextResponse.json({ error: 'The demo data grew too large. Use Reset demo to start again.' }, { status: 413 })
  let input: { state: DemoState | null; request: DemoRequest }
  try {
    input = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const r = input?.request
  if (!r || !METHODS.has(r.method) || typeof r.path !== 'string' || !r.path.startsWith('/api/')) return NextResponse.json({ error: 'Bad demo request.' }, { status: 400 })
  try {
    const out = await withDemo(input.state ?? null, () => dispatchDemo(r, req.nextUrl.origin, req.headers.get('cookie') || ''), seedWork)
    return NextResponse.json({ response: out.result, state: out.state, fresh: out.fresh }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('demo request failed', e)
    return NextResponse.json({ error: 'The demo couldn’t run that request. Use Reset demo if this keeps happening.' }, { status: 500 })
  }
}
