import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * New proposals, SOWs, and contracts must be stamped with the current terms.
 * If the database is missing the columns from
 * supabase/migrations/20261028_terms_version.sql, issuing is blocked rather than
 * saving a document that would render the old $65 wording.
 */

export const MIGRATION_FILE = 'supabase/migrations/20261028_terms_version.sql'
export const MIGRATION_REQUIRED = 'MIGRATION_REQUIRED'

const REQUIRED: Record<string, string[]> = {
  proposals: ['terms_version', 'hourly_rate', 'payment_plan'],
  sows: ['terms_version', 'payment_plan'],
  contracts: ['terms_version', 'hourly_rate', 'payment_plan'],
}

let verified = false

function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42703' || err.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(err.message ?? '')
}

export class MigrationRequiredError extends Error {
  constructor(public detail: string) {
    super(detail)
  }
}

/** Throws MigrationRequiredError when the terms columns are missing. */
export async function assertTermsSchema(tables: (keyof typeof REQUIRED)[]): Promise<void> {
  if (verified) return
  for (const table of tables) {
    const cols = REQUIRED[table]
    const { error } = await supabaseAdmin.from(table).select(cols.join(',')).limit(1)
    if (isMissingColumn(error)) {
      throw new MigrationRequiredError(`The ${table} table is missing ${cols.join(', ')}.`)
    }
    if (error) throw error
  }
  if (tables.length === Object.keys(REQUIRED).length) verified = true
}

/** Treats a missing column on insert the same way, in case the schema changed after the check. */
export function throwIfMissingColumn(err: { code?: string; message?: string } | null | undefined, table: string) {
  if (isMissingColumn(err)) {
    verified = false
    throw new MigrationRequiredError(`The ${table} table is missing the terms columns.`)
  }
}

export function migrationResponse(err: MigrationRequiredError) {
  return NextResponse.json(
    {
      error: MIGRATION_REQUIRED,
      message: `Not sent. The database needs the terms migration before new proposals, SOWs, or contracts can be issued. Run ${MIGRATION_FILE} in the Supabase SQL editor, then try again. Existing documents are unaffected. (${err.detail})`,
    },
    { status: 503 }
  )
}
