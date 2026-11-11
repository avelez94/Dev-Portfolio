/**
 * Launch checklist for the Mary's Logistics Group name and brokerage launch. Statuses are recorded
 * by the owner in Dashboard > Settings; nothing here is filed, paid for or verified
 * automatically.
 */
export const LAUNCH_ITEMS = [
  { key: "md_name_approval", label: "Maryland business name approval", help: "Name availability and the LLC filing or amendment accepted by the Maryland Department of Assessments and Taxation." },
  { key: "llc_name_confirmed", label: "Registered LLC name confirmed", help: "The exact registered legal name, recorded in Business identity once confirmed." },
  { key: "federal_trademark", label: "Federal trademark clearance", help: "A clearance search of federal registrations and pending applications for similar logistics names." },
  { key: "common_law_review", label: "Common law business name review", help: "A review of unregistered businesses using similar names in the United States, including the similarly named company already identified abroad." },
  { key: "domain_selection", label: "Domain selection", help: "Final website domain chosen and registered. Record it in Business identity." },
  { key: "fmcsa_records", label: "FMCSA records match the legal name", help: "Broker authority application and registration show the verified legal name." },
  { key: "surety_bond", label: "Surety bond name alignment", help: "BMC 84 or BMC 85 financial security issued in the verified legal name." },
  { key: "business_banking", label: "Business banking identity", help: "Business accounts opened or updated in the verified legal name." },
  { key: "insurance_records", label: "Insurance records", help: "Contingent cargo and general liability policies issued in the verified legal name." },
  { key: "legal_templates", label: "Legal templates reviewed for the new name", help: "Carrier agreements, shipper terms and rate confirmations reviewed before first use." },
] as const;

export const CHECKLIST_STATUSES = [
  { value: "todo", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "not_applicable", label: "Not applicable" },
] as const;

export const TRADEMARK_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "Search in progress" },
  { value: "cleared", label: "Cleared by a professional review" },
  { value: "conflict_found", label: "Possible conflict found" },
] as const;

export const AUTHORITY_STATUSES = [
  { value: "not_filed", label: "Not filed" },
  { value: "application_pending", label: "Application pending" },
  { value: "granted_pending_filings", label: "Granted, filings pending (bond, BOC 3)" },
  { value: "active", label: "Active and verified in FMCSA records" },
] as const;
