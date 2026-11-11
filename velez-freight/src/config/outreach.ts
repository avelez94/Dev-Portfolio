export const MESSAGE_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "muted" | "danger" }> = {
  draft: { label: "Draft", tone: "muted" },
  pending_approval: { label: "Waiting for approval", tone: "warn" },
  approved: { label: "Approved, not sent", tone: "warn" },
  sending: { label: "Sending", tone: "warn" },
  sent: { label: "Sent", tone: "ok" },
  failed: { label: "Not sent (failed)", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
};
export const DELIVERY_STATUS: Record<string, string> = { none: "No delivery update yet", delivered: "Delivered", delayed: "Delivery delayed", bounced: "Bounced", complained: "Marked as spam" };
export const TEMPLATE_CATEGORIES: { value: string; label: string }[] = [
  { value: "introduction", label: "Introductions" }, { value: "follow_up", label: "Follow ups" }, { value: "relationship", label: "Relationships" },
  { value: "carrier", label: "Carriers" }, { value: "launch", label: "Launch" }, { value: "quote", label: "Quotes" }, { value: "shipment", label: "Shipments" }, { value: "other", label: "Other" },
];
export const SAMPLE_VARIABLES = { "contact.first_name": "Jordan", "contact.name": "Jordan Lee", "company.name": "Example Supply Co" } as const;
