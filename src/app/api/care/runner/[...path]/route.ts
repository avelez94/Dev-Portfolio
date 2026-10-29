/**
 * Endpoints for the check runner (the GitHub Actions workflow). Authenticated
 * with CARE_RUNNER_TOKEN. The runner can only lease queued runs, report
 * progress on its own lease, upload evidence into its own run's folder, and
 * submit results, which are validated before they're stored.
 */
import { NextRequest, NextResponse } from 'next/server'
import { careEnabled, careOff, secretMatches } from '@/lib/care/config'
import { db, CareError, putObject, EVIDENCE_BUCKET } from '@/lib/care/db'
import { completeRun, requireRunningRun } from '@/lib/care/runs'

export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEASE_SECONDS = 180
const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } })
const ownerOk = (o: unknown): o is string => typeof o === 'string' && /^[\w.:-]{3,80}$/.test(o)

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!careEnabled()) return careOff()
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secretMatches(auth, process.env.CARE_RUNNER_TOKEN)) return json({ error: 'Unauthorized' }, 401)
  const { path } = await ctx.params
  try {
    if (path.length === 1 && path[0] === 'peek') {
      // Lets the workflow skip installing a browser when nothing is waiting.
      const r = await db.from('care_scan_runs').select('id', { count: 'exact', head: true }).eq('status', 'queued').lte('available_at', new Date().toISOString())
      return (r.count || 0) > 0 ? json({ queued: r.count }) : new NextResponse(null, { status: 204 })
    }
    if (path.length === 1 && path[0] === 'claim') {
      const body = await req.json()
      if (!ownerOk(body.owner)) throw new CareError('Bad runner id.')
      const r = await db.rpc('care_claim_scan_run', { p_owner: body.owner, p_lease_seconds: LEASE_SECONDS })
      if (r.error) throw new CareError(r.error.message, 500)
      const run = Array.isArray(r.data) ? r.data[0] : r.data
      if (!run) return new NextResponse(null, { status: 204 })
      return json({ run: { id: run.id, cycle_id: run.cycle_id, site_id: run.site_id, attempts: run.attempts, config: run.config, lease_seconds: LEASE_SECONDS, evidence_prefix: `${run.site_id}/${run.cycle_id}/${run.id}/` } })
    }
    if (path.length === 3 && path[0] === 'runs' && UUID.test(path[1])) {
      const runId = path[1]
      if (path[2] === 'heartbeat') {
        const body = await req.json()
        if (!ownerOk(body.owner)) throw new CareError('Bad runner id.')
        const progress = body.progress && typeof body.progress === 'object'
          ? { done: Number(body.progress.done) || 0, total: Number(body.progress.total) || 0, step: String(body.progress.step || '').slice(0, 120) }
          : null
        const r = await db.rpc('care_heartbeat', { p_run: runId, p_owner: body.owner, p_lease_seconds: LEASE_SECONDS, p_progress: progress })
        if (r.error) throw new CareError(r.error.message, 500)
        const row = Array.isArray(r.data) ? r.data[0] : r.data
        return json({ ok: !!row?.ok, cancel: !!row?.cancel_requested })
      }
      if (path[2] === 'evidence') {
        const owner = req.nextUrl.searchParams.get('owner')
        const name = req.nextUrl.searchParams.get('name') || ''
        if (!ownerOk(owner) || !/^[\w.-]{1,60}$/.test(name)) throw new CareError('Bad request.')
        const type = req.headers.get('content-type') || ''
        if (type !== 'image/jpeg' && type !== 'image/png') throw new CareError('Only JPEG or PNG screenshots.', 415)
        const run = await requireRunningRun(runId, owner)
        const buf = Buffer.from(await req.arrayBuffer())
        if (buf.length === 0 || buf.length > 2_500_000) throw new CareError('Screenshot too large.', 413)
        const ext = type === 'image/png' ? 'png' : 'jpg'
        const p = `${run.site_id}/${run.cycle_id}/${run.id}/${name.replace(/\.(jpe?g|png)$/i, '')}.${ext}`
        await putObject(EVIDENCE_BUCKET, p, buf, type)
        return json({ path: p })
      }
      if (path[2] === 'complete') {
        const text = await req.text()
        if (text.length > 3_000_000) throw new CareError('Too much data.', 413)
        const body = JSON.parse(text)
        if (!ownerOk(body.owner)) throw new CareError('Bad runner id.')
        return json(await completeRun(runId, body.owner, body))
      }
    }
    return json({ error: 'Not found' }, 404)
  } catch (e) {
    if (e instanceof CareError) return json({ error: e.message }, e.status)
    if (e instanceof SyntaxError) return json({ error: 'Invalid JSON.' }, 400)
    console.error('care runner error', e)
    return json({ error: 'Something went wrong.' }, 500)
  }
}
