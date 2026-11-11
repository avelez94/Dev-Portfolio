// Shared rules for document files (used by the upload form and the server).

export const DOCUMENT_BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

/** Accepted file types and the extension the stored file gets. Mirrors the bucket settings. */
export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_TYPES).join(",");

export const DOC_TYPE_LABELS: Record<string, string> = {
  rate_confirmation: "Rate confirmation",
  bol: "Bill of lading",
  pod: "Proof of delivery",
  invoice: "Invoice",
  insurance_certificate: "Insurance certificate",
  carrier_agreement: "Carrier agreement",
  w9: "W9",
  other: "Other",
  authority_record: "FMCSA authority record",
  surety_bond: "Surety bond or trust",
  boc3_filing: "BOC 3 filing",
  registration_record: "Registration record",
};

/** Document types whose files only owners and admins may open (taxpayer details). */
export const RESTRICTED_DOC_TYPES = new Set(["w9"]);

export type DocumentEntity = "shipment" | "carrier_lead" | "shipper_prospect" | "regulatory_credential";

/** Records whose files only owners and admins may attach or open (business compliance evidence). */
export const ADMIN_ONLY_ENTITIES = new Set<string>(["regulatory_credential"]);

export const ENTITY_TABLES: Record<DocumentEntity, string> = {
  shipment: "shipments",
  carrier_lead: "carrier_leads",
  shipper_prospect: "shipper_prospects",
  regulatory_credential: "regulatory_credentials",
};

/** Storage key for a new file: <entity type>/<entity id>/<random id>.<ext>. */
export const STORAGE_PATH = /^(shipment|carrier_lead|shipper_prospect|regulatory_credential)\/([0-9a-f-]{36})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp|heic|heif)$/;

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
