/** Labels and allowed values for the private dashboard. Must match database check constraints. */
export const prospectStatuses = [
  { value: "researching", label: "Researching" },
  { value: "contact_identified", label: "Contact Identified" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "qualified", label: "Qualified" },
  { value: "potential_customer", label: "Potential Customer" },
  { value: "active_customer", label: "Active Customer" },
  { value: "lost", label: "Lost / Not Interested" },
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

export const entityTypes = ["shipper_prospect", "carrier_lead", "contact_inquiry", "quote_inquiry", "quote", "shipment", "invoice", "carrier_bill"] as const;

export const leadSources = [
  { value: "research", label: "Manual research" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "inbound_inquiry", label: "Inbound inquiry" },
  { value: "manual", label: "Other manual entry" },
  { value: "other", label: "Other" },
] as const;

export const industryCategories = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "distribution", label: "Distribution" },
  { value: "automotive", label: "Automotive" },
  { value: "industrial", label: "Industrial" },
  { value: "retail", label: "Retail" },
  { value: "food_beverage", label: "Food and beverage" },
  { value: "construction", label: "Construction" },
  { value: "other", label: "Other" },
] as const;

export const taskCategories = [
  { value: "follow_up", label: "Follow up" },
  { value: "inquiry_review", label: "Inquiry review" },
  { value: "quote", label: "Quote" },
  { value: "carrier_verification", label: "Carrier verification" },
  { value: "document", label: "Document" },
  { value: "invoice", label: "Invoice" },
  { value: "payable", label: "Carrier payable" },
  { value: "shipment", label: "Shipment" },
  { value: "compliance", label: "Compliance" },
  { value: "admin", label: "Administration" },
  { value: "outreach", label: "Outreach" },
  { value: "other", label: "Other" },
] as const;

export const activityTypes = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "text", label: "Text message" },
  { value: "other", label: "Other" },
] as const;

export const activityOutcomes = [
  { value: "completed", label: "Completed (conversation happened or message delivered)" },
  { value: "left_message", label: "Left a message" },
  { value: "no_answer", label: "No answer" },
  { value: "bounced", label: "Email bounced" },
  { value: "scheduled", label: "Scheduled for later" },
] as const;

export const freightTypes = [
  { value: "expedited", label: "Expedited" },
  { value: "dedicated", label: "Dedicated" },
  { value: "general", label: "General" },
] as const;
export type EntityType = (typeof entityTypes)[number];

export const label = (list: readonly { value: string; label: string }[], v: string | null | undefined) => list.find((x) => x.value === v)?.label ?? v ?? "";

/** Calendar dates (YYYY-MM-DD) are formatted as written, never shifted by time zone. */
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(d);
  return new Date(day ? `${d}T12:00:00Z` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: day ? "UTC" : "America/New_York" });
};
export const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "";
