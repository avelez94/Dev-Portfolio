/**
 * Regulatory credentials tracked in Settings > Regulatory & Compliance. Entering a value never
 * verifies it: a credential is verified only when the owner records where and when it was
 * checked. Only verified credentials can be shown on the website, and only once operating.
 */
export type CredentialKind =
  | "mc_number" | "usdot_number" | "broker_authority" | "surety_bond" | "boc3" | "contingent_cargo"
  | "general_liability" | "ucr" | "scac" | "state_registration" | "ein";

export type CredentialStatus = "not_entered" | "entered" | "pending_verification" | "verified" | "expired" | "rejected";

export const CREDENTIALS: { kind: CredentialKind; label: string; publicLabel?: string; help: string; numeric?: boolean; canBePublic: boolean; private?: boolean }[] = [
  { kind: "mc_number", label: "MC number", publicLabel: "MC", help: "Motor carrier (broker) docket number issued by FMCSA. Digits only.", numeric: true, canBePublic: true },
  { kind: "usdot_number", label: "USDOT number", publicLabel: "USDOT", help: "USDOT number issued by FMCSA. Digits only.", numeric: true, canBePublic: true },
  { kind: "broker_authority", label: "Property broker authority", help: "Authority status as shown in FMCSA licensing and insurance records. Enter the authority type or docket.", canBePublic: false },
  { kind: "surety_bond", label: "BMC 84 surety bond or BMC 85 trust", help: "Financial security on file with FMCSA. Enter the provider and bond or trust number.", canBePublic: false },
  { kind: "boc3", label: "BOC 3 process agent filing", help: "Process agent designation on file with FMCSA. Enter the process agent company.", canBePublic: false },
  { kind: "contingent_cargo", label: "Contingent cargo insurance", help: "Insurer and policy number. Record the expiration date.", canBePublic: false },
  { kind: "general_liability", label: "General liability insurance", help: "Insurer and policy number. Record the expiration date.", canBePublic: false },
  { kind: "ucr", label: "Unified Carrier Registration (UCR)", help: "Annual UCR registration year and confirmation.", canBePublic: false },
  { kind: "scac", label: "SCAC code", publicLabel: "SCAC", help: "Standard Carrier Alpha Code, if one is obtained.", canBePublic: true },
  { kind: "state_registration", label: "Maryland business registration", help: "Department ID from the Maryland Department of Assessments and Taxation.", canBePublic: false },
  { kind: "ein", label: "Employer Identification Number (EIN)", help: "Private. Visible to owners and admins only and never shown on the website.", canBePublic: false, private: true },
];

export const CREDENTIAL_STATUSES: { value: CredentialStatus; label: string }[] = [
  { value: "not_entered", label: "Not entered" },
  { value: "entered", label: "Entered, not verified" },
  { value: "pending_verification", label: "Waiting on verification" },
  { value: "verified", label: "Verified" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected or inactive" },
];

export const credentialLabel = (kind: string) => CREDENTIALS.find((c) => c.kind === kind)?.label ?? kind;
export const credentialStatusLabel = (s: string) => CREDENTIAL_STATUSES.find((x) => x.value === s)?.label ?? s;

/** Official public lookup pages. Links only: nothing is sent to FMCSA automatically. */
export function fmcsaLookupUrl(kind: CredentialKind, value: string | null) {
  if (!value) return "https://safer.fmcsa.dot.gov/CompanySnapshot.aspx";
  if (kind === "usdot_number") return `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${encodeURIComponent(value)}`;
  if (kind === "mc_number") return `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=${encodeURIComponent(value)}`;
  return "https://li-public.fmcsa.dot.gov/LIVIEW/pkg_carrquery.prc_carrlist";
}

export const DAYS = [
  { key: "mon", label: "Monday" }, { key: "tue", label: "Tuesday" }, { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" }, { key: "fri", label: "Friday" }, { key: "sat", label: "Saturday" }, { key: "sun", label: "Sunday" },
] as const;
export type DayKey = (typeof DAYS)[number]["key"];
export type BusinessHours = Partial<Record<DayKey, { open: string; close: string } | { closed: true }>>;

export const AFTER_HOURS = [
  { value: "none", label: "No after hours support" },
  { value: "by_arrangement", label: "After hours by arrangement" },
  { value: "urgent_line", label: "Urgent shipment line after hours" },
  { value: "around_the_clock", label: "Around the clock (24/7) support" },
] as const;

export const SOCIAL_NETWORKS = [
  { key: "linkedin", label: "LinkedIn" }, { key: "facebook", label: "Facebook" }, { key: "instagram", label: "Instagram" },
  { key: "x", label: "X" }, { key: "youtube", label: "YouTube" },
] as const;

export const DISPLAY_PREFS = [
  { key: "show_email", label: "Show the public email address" },
  { key: "show_phone", label: "Show the public phone number" },
  { key: "show_hours", label: "Show business hours on the Contact page" },
  { key: "show_credentials", label: "Show verified credentials in the footer (only once operating)" },
  { key: "show_social", label: "Show social media links in the footer" },
] as const;
export type DisplayPrefs = Record<(typeof DISPLAY_PREFS)[number]["key"], boolean>;
export const DEFAULT_DISPLAY: DisplayPrefs = { show_email: true, show_phone: true, show_hours: false, show_credentials: true, show_social: false };
