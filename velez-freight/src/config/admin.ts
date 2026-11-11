/** Labels and allowed values for the private dashboard. Must match database check constraints. */
export const prospectStatuses = [
  { value: "researching", label: "Researching" },
  { value: "contact_identified", label: "Contact Identified" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "qualified", label: "Qualified" },
  { value: "follow_up", label: "Follow Up" },
  { value: "potential_customer", label: "Potential Customer" },
  { value: "active_customer", label: "Active Customer" },
  { value: "closed", label: "Closed" },
] as const;

export const contactStatuses = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "follow_up", label: "Follow up" },
  { value: "resolved", label: "Resolved" },
  { value: "spam", label: "Spam" },
] as const;

export const quoteStatuses = [
  { value: "pending_review", label: "Pending review" },
  { value: "in_review", label: "In review" },
  { value: "follow_up", label: "Follow up" },
  { value: "responded", label: "Responded" },
  { value: "declined", label: "Declined" },
  { value: "resolved", label: "Resolved" },
  { value: "spam", label: "Spam" },
] as const;

export const verificationStatuses = [
  { value: "unverified", label: "Unverified" },
  { value: "in_review", label: "In review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
] as const;

export const inquiryTypeLabels: Record<string, string> = {
  general: "General",
  shipper: "Shipper",
  carrier: "Carrier",
  launch_notification: "Launch notification",
  quote: "Freight quote",
};

export const entityTypes = ["shipper_prospect", "carrier_lead", "contact_inquiry", "quote_inquiry"] as const;
export type EntityType = (typeof entityTypes)[number];

export const label = (list: readonly { value: string; label: string }[], v: string | null | undefined) => list.find((x) => x.value === v)?.label ?? v ?? "";

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "";
export const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "";
