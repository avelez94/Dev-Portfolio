/**
 * Server only data access for Website Care (service role). Nothing here is
 * reachable from the browser; admin pages go through /api/care/admin, which
 * checks the admin cookie first.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { CareSettings } from './schedule'

export const db = supabaseAdmin

export const EVIDENCE_BUCKET = 'care-evidence'
export const REPORTS_BUCKET = 'care-reports'

/** Untyped database row (the project has no generated Supabase types). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>

export class CareError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function must(res: { data: any; error: { message: string; code?: string } | null }, what: string): any {
  if (res.error?.code === 'PGRST116') throw new CareError(`${what} not found`, 404)
  if (res.error) throw new CareError(`${what}: ${res.error.message}`, 500)
  if (res.data === null || res.data === undefined) throw new CareError(`${what}: not found`, 404)
  return res.data
}

export async function getSettings(): Promise<CareSettings> {
  return must(await db.from('care_settings').select('*').eq('id', 1).single(), 'Care settings') as CareSettings
}

export async function logActivity(a: { site_id?: string | null; cycle_id?: string | null; actor: string; action: string; detail?: Record<string, unknown> }) {
  const { error } = await db.from('care_activity').insert({ site_id: a.site_id ?? null, cycle_id: a.cycle_id ?? null, actor: a.actor, action: a.action, detail: a.detail ?? {} })
  if (error) console.error('care activity log failed', error.message)
}

export async function putObject(bucket: string, path: string, body: Buffer, contentType: string) {
  const { error } = await db.storage.from(bucket).upload(path, body, { contentType, upsert: false })
  if (error) throw new CareError(`Could not store file: ${error.message}`, 500)
  return path
}

export async function getObject(bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await db.storage.from(bucket).download(path)
  if (error || !data) throw new CareError('File not found', 404)
  return Buffer.from(await data.arrayBuffer())
}

export function ownerName(): string {
  return 'Alante'
}
