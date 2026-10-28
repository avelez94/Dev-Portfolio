import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Inserts a row that includes newer columns (terms_version, hourly_rate).
 * If the database hasn't had the migration applied yet, PostgREST rejects the
 * unknown columns; we then retry without them so sending documents never breaks.
 * Without the stamp, a document renders with the legacy wording, so run
 * supabase/migrations/20261028_terms_version.sql before deploying.
 */
export async function insertWithOptionalColumns<T = Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>,
  optional: string[]
): Promise<{ data: T | null; error: unknown; stampedTerms: boolean }> {
  const first = await supabaseAdmin.from(table).insert(row).select().single()
  if (!first.error) return { data: first.data as T, error: null, stampedTerms: true }

  const msg = `${first.error.code ?? ''} ${first.error.message ?? ''}`
  const missingColumn = /PGRST204|42703|column/i.test(msg) && optional.some((c) => msg.includes(c))
  if (!missingColumn) return { data: null, error: first.error, stampedTerms: false }

  console.warn(`[${table}] optional columns missing (${optional.join(', ')}); run the terms_version migration. Saving without them.`)
  const fallback = { ...row }
  optional.forEach((c) => delete fallback[c])
  const second = await supabaseAdmin.from(table).insert(fallback).select().single()
  return { data: (second.data as T) ?? null, error: second.error, stampedTerms: false }
}
