import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

/** Columns added by supabase/migrations/20261028_intake_flow.sql. */
export const INTAKE_FLOW_COLUMNS = [
  'stage',
  'source',
  'interest',
  'inquiry_note',
  'details',
  'details_completed_at',
  'linked_submission_id',
  'continue_token_hash',
  'continue_token_expires_at',
] as const

export const CONTINUE_LINK_DAYS = 14

/** Private link token: 256 random bits, only its hash is stored. */
export function newContinueToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + CONTINUE_LINK_DAYS * 86400000).toISOString() }
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function looksLikeToken(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(v)
}

export function isMissingColumn(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false
  return err.code === '42703' || err.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(err.message ?? '')
}

/** Website line saved in notes by the homepage form, e.g. "Existing website: example.com". */
export function websiteFromNotes(notes: string | null | undefined): string {
  const m = String(notes ?? '').match(/Existing website:\s*(\S+)/i)
  return m ? m[1] : ''
}

export type QuestionnaireDetails = {
  existing?: string
  website?: string
  platform?: string
  assets?: string[]
  integrations?: string[]
  references?: string
}

const S = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const L = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, 120)).slice(0, 20) : [])

/** Accepts the new `details` object or the original top level fields. */
export function readDetails(body: Record<string, unknown>): QuestionnaireDetails {
  const d = (body.details && typeof body.details === 'object' && !Array.isArray(body.details) ? body.details : body) as Record<string, unknown>
  const out: QuestionnaireDetails = {
    existing: S(d.existing, 40),
    website: S(d.website, 300),
    platform: S(d.platform, 200),
    assets: L(d.assets),
    integrations: L(d.integrations),
    references: S(d.references),
  }
  for (const k of Object.keys(out) as (keyof QuestionnaireDetails)[]) {
    const v = out[k]
    if (v === '' || (Array.isArray(v) && v.length === 0)) delete out[k]
  }
  return out
}

/** Plain text version, used when the database hasn't been migrated so no answer is lost. */
export function detailsAsText(d: QuestionnaireDetails): string {
  const parts: string[] = []
  if (d.existing) parts.push(`Has a website now: ${d.existing}`)
  if (d.website) parts.push(`Current website: ${d.website}`)
  if (d.platform) parts.push(`Site platform: ${d.platform}`)
  if (d.assets?.length) parts.push(`Assets ready: ${d.assets.join(', ')}`)
  if (d.integrations?.length) parts.push(`Integrations: ${d.integrations.join(', ')}`)
  if (d.references) parts.push(`Sites they like: ${d.references}`)
  return parts.join('\n')
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return 'earlier'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' })
}
