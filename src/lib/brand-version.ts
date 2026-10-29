/**
 * Which look a stored record's documents use. Saved on the record when it's
 * created (invoices.brand_version, invoice_milestones.brand_version), so a
 * later download always matches what the client originally received, no
 * matter when it's downloaded. Records without a value predate the studio
 * styling and keep the original layout.
 */
export const DOC_BRAND_VERSION = 'studio-2026-10'

export function usesStudioBrand(record: { brand_version?: string | null } | null | undefined): boolean {
  return record?.brand_version === DOC_BRAND_VERSION
}

type DbError = { code?: string; message?: string } | null | undefined

/** True when the database doesn't have the brand_version column yet (migration not run). */
export function missingBrandColumn(err: DbError): boolean {
  if (!err) return false
  return (err.code === '42703' || err.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(err.message ?? '')) && /brand_version/.test(err.message ?? '')
}
