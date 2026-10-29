import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * The admin dashboard's only path to the database and file storage.
 *
 * The dashboard used to query Supabase from the browser with the public anon
 * key, which only stays private if every table has strict row level security.
 * Now the browser talks to this route instead; it checks the admin cookie and
 * forwards the request with the server's service role key. That lets the
 * private tables be closed to the anon key entirely
 * (supabase/migrations/20261029_lock_down_private_tables.sql).
 *
 * Only the tables and storage bucket the dashboard uses are allowed.
 */

export const dynamic = 'force-dynamic'

const TABLES = new Set([
  'availability', 'blocked_dates', 'blocked_slots', 'bookings', 'clients', 'contracts', 'documents',
  'intake_submissions', 'invoice_milestones', 'invoices', 'meetings', 'pricing', 'projects', 'proposals', 'sows',
])
const BUCKETS = new Set(['freelance-docs'])
const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'prefer', 'range', 'x-upsert', 'cache-control', 'accept-profile', 'content-profile']
const FORWARD_RESPONSE_HEADERS = ['content-type', 'content-range', 'content-disposition', 'content-length', 'preference-applied']

function allowed(path: string[]): boolean {
  const [service, version, kind, name] = path
  if (service === 'rest' && version === 'v1' && path.length === 3) return TABLES.has(kind)
  // storage/v1/object/<bucket>/... and storage/v1/object/list/<bucket>
  if (service === 'storage' && version === 'v1' && kind === 'object') {
    if (['list', 'sign', 'authenticated', 'info', 'move', 'copy'].includes(name)) return BUCKETS.has(path[4])
    return BUCKETS.has(name)
  }
  return false
}

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { path } = await ctx.params
  if (!path?.length || path.some((p) => p === '..' || p === '.') || !allowed(path)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return NextResponse.json({ error: 'Database is not configured' }, { status: 500 })

  const target = `${base.replace(/\/$/, '')}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`
  const headers = new Headers({ apikey: key, Authorization: `Bearer ${key}` })
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(h)
    if (v) headers.set(h, v)
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: 'no-store',
  })
  const out = new Headers({ 'Cache-Control': 'no-store' })
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h)
    if (v) out.set(h, v)
  }
  return new NextResponse(req.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: out })
}

export const GET = forward
export const HEAD = forward
export const POST = forward
export const PATCH = forward
export const PUT = forward
export const DELETE = forward
