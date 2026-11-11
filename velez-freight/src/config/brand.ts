/**
 * Brand identity. The public brand name is fixed here because page copy is written around it.
 * The LEGAL entity name is separate and is shown only after the owner records it as verified in
 * Dashboard > Website Content (business_settings.legal_entity_name and legal_name_confirmed).
 */
export const brand = {
  /** Public brand used across the website, dashboard, reports and emails. */
  name: "Mary’s Logistics Group",
  short: "Mary’s Logistics",
  /** Intended legal name. Not shown publicly until registration is verified. */
  intendedLegalName: "Mary’s Logistics Group LLC",
  /**
   * Former public name. Kept only for records created before the rebrand (for example
   * VFG reference numbers) and for the migration history; never shown as current branding.
   */
  previousName: "Velez Freight Group",
  /** Prefix for new record references (quotes, shipments, invoices). Older records keep VFG. */
  referencePrefix: "MLG",
} as const;
