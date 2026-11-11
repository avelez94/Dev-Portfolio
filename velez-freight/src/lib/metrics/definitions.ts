/**
 * The single list of business metrics. Each definition states exactly how the number is
 * calculated and which SQL function computes it (supabase/migrations/20261112000200_analytics.sql).
 * Pages, charts, reports, exports and insights all reference these keys so a KPI cannot be
 * computed two different ways. Dates use the business time zone (America/New_York).
 */
export type Unit = "count" | "money" | "percent" | "hours" | "days";
export type Mode = "prelaunch" | "active";

export type MetricDef = {
  key: string;
  label: string;
  unit: Unit;
  /** Plain English calculation shown in tooltips, reports and documentation. */
  definition: string;
  source: string;
  /** Prelaunch metrics are always shown; active metrics only once operations are enabled. */
  mode: Mode;
  adminOnly?: boolean;
  /** Where the underlying records can be reviewed. */
  drill: string;
  /** True when a higher value is better (for comparison colouring). */
  higherIsBetter?: boolean;
};

export const REVENUE_RECOGNITION =
  "Freight revenue and carrier cost are recognized on the recorded delivery date of shipments whose status is delivered or completed. Cancelled shipments are excluded. These are management figures, not GAAP financial statements.";

export const METRICS = {
  // ---------------------------------------------------------------- Sales and CRM (prelaunch)
  prospects_total: { key: "prospects_total", label: "Total shipper prospects", unit: "count", mode: "prelaunch", drill: "/admin/shippers", higherIsBetter: true,
    definition: "All shipper records created on or before the end of the period, in every stage including lost.", source: "analytics_sales" },
  new_prospects: { key: "new_prospects", label: "New prospects", unit: "count", mode: "prelaunch", drill: "/admin/shippers?sort=newest", higherIsBetter: true,
    definition: "Shipper records created during the period.", source: "analytics_sales" },
  shippers_contacted: { key: "shippers_contacted", label: "Shippers contacted", unit: "count", mode: "prelaunch", drill: "/admin/shippers?view=contacted", higherIsBetter: true,
    definition: "Distinct shippers with at least one outbound call, email, meeting or text logged in the period with outcome completed, left message or no answer. Bounced emails and scheduled meetings do not count.", source: "analytics_sales" },
  active_conversations: { key: "active_conversations", label: "Active conversations", unit: "count", mode: "prelaunch", drill: "/admin/shippers?status=responded", higherIsBetter: true,
    definition: "Distinct shippers currently Responded, Qualified or Potential Customer with at least one logged activity during the period.", source: "analytics_sales" },
  follow_ups_due: { key: "follow_ups_due", label: "Follow ups due", unit: "count", mode: "prelaunch", drill: "/admin/tasks?view=today&category=follow_up", higherIsBetter: false,
    definition: "Open follow up tasks due today or earlier that are not snoozed. Not affected by the date filter.", source: "analytics_sales" },
  potential_customers: { key: "potential_customers", label: "Potential customers", unit: "count", mode: "prelaunch", drill: "/admin/shippers?status=potential_customer", higherIsBetter: true,
    definition: "Shippers currently in the Potential Customer stage. Current snapshot, not affected by the date filter.", source: "analytics_sales" },
  carrier_inquiries: { key: "carrier_inquiries", label: "Carrier inquiries", unit: "count", mode: "prelaunch", drill: "/admin/inquiries?type=carrier", higherIsBetter: true,
    definition: "Carrier partnership inquiries submitted through the website during the period.", source: "analytics_sales" },
  website_inquiries: { key: "website_inquiries", label: "New website inquiries", unit: "count", mode: "prelaunch", drill: "/admin/inquiries", higherIsBetter: true,
    definition: "General, shipper and launch notification inquiries plus freight quote requests submitted during the period. Carrier inquiries are counted separately.", source: "analytics_sales" },
  response_rate: { key: "response_rate", label: "Response rate", unit: "percent", mode: "prelaunch", drill: "/admin/insights?tab=sales", higherIsBetter: true,
    definition: "Eligible outbound outreach that received a meaningful response, divided by eligible outbound outreach. Eligible means completed, left message or no answer during the period. Not available when there was no eligible outreach.", source: "analytics_sales" },
  lead_conversion: { key: "lead_conversion", label: "Prospect to customer conversion", unit: "percent", mode: "prelaunch", drill: "/admin/insights?tab=sales", higherIsBetter: true,
    definition: "Of shippers created during the period, the share whose stage history reached Active Customer by the end of the period. Uses recorded stage changes, not the latest status.", source: "analytics_sales" },
  contact_to_customer_days: { key: "contact_to_customer_days", label: "Contact to customer time", unit: "days", mode: "active", adminOnly: true, drill: "/admin/insights?tab=sales", higherIsBetter: false,
    definition: "Average days from a shipper's first completed outbound outreach to the delivery of its first shipment whose invoice is paid in full, for customers reaching that point during the period.", source: "analytics_contact_to_customer" },

  // ---------------------------------------------------------------- Operations (active)
  freight_inquiries: { key: "freight_inquiries", label: "Freight inquiries received", unit: "count", mode: "active", drill: "/admin/inquiries?type=quote", higherIsBetter: true,
    definition: "Freight quote requests submitted through the website during the period.", source: "quote_inquiries" },
  quotes_created: { key: "quotes_created", label: "Quotes created", unit: "count", mode: "active", drill: "/admin/quotes", higherIsBetter: true,
    definition: "Quotes created during the period, any status except cancelled.", source: "quotes" },
  quotes_accepted: { key: "quotes_accepted", label: "Quotes accepted", unit: "count", mode: "active", drill: "/admin/quotes?status=accepted", higherIsBetter: true,
    definition: "Quotes whose decision (accepted) was recorded during the period.", source: "quotes" },
  quote_win_rate: { key: "quote_win_rate", label: "Quote win rate", unit: "percent", mode: "active", drill: "/admin/quotes", higherIsBetter: true,
    definition: "Accepted quotes divided by quotes with a recorded decision (accepted, declined or expired) during the period. Open quotes are excluded.", source: "quotes" },
  shipments_booked: { key: "shipments_booked", label: "Shipments booked", unit: "count", mode: "active", drill: "/admin/shipments", higherIsBetter: true,
    definition: "Shipments booked during the period, excluding cancelled.", source: "analytics_operations" },
  shipments_completed: { key: "shipments_completed", label: "Shipments completed", unit: "count", mode: "active", drill: "/admin/shipments?status=delivered", higherIsBetter: true,
    definition: "Shipments delivered or completed with a delivery date in the period.", source: "analytics_operations" },
  active_shipments: { key: "active_shipments", label: "Active shipments", unit: "count", mode: "active", drill: "/admin/shipments?status=active", higherIsBetter: true,
    definition: "Shipments currently booked, dispatched or in transit. Current snapshot.", source: "analytics_operations" },
  on_time_pickup: { key: "on_time_pickup", label: "On time pickup", unit: "percent", mode: "active", drill: "/admin/insights?tab=operations", higherIsBetter: true,
    definition: "Completed shipments whose verified pickup time is at or before the end of the pickup appointment window, divided by completed shipments with a verified pickup time and a window. Unverified or missing timestamps are reported as unknown and excluded from the rate, never counted as on time.", source: "analytics_operations" },
  on_time_delivery: { key: "on_time_delivery", label: "On time delivery", unit: "percent", mode: "active", drill: "/admin/insights?tab=operations", higherIsBetter: true,
    definition: "Same rule as on time pickup, using the delivery appointment window and verified delivery time.", source: "analytics_operations" },

  // ---------------------------------------------------------------- Financial (active, admins)
  booked_revenue: { key: "booked_revenue", label: "Booked freight revenue", unit: "money", mode: "active", adminOnly: true, drill: "/admin/shipments", higherIsBetter: true,
    definition: "Customer rates of shipments booked during the period, excluding cancelled. Booked revenue is not yet earned and is not cash.", source: "analytics_financial" },
  completed_revenue: { key: "completed_revenue", label: "Completed freight revenue", unit: "money", mode: "active", adminOnly: true, drill: "/admin/reports/profitability", higherIsBetter: true,
    definition: "Customer rates of shipments delivered or completed during the period (the revenue recognition rule).", source: "analytics_financial" },
  gross_margin: { key: "gross_margin", label: "Gross brokerage margin", unit: "money", mode: "active", adminOnly: true, drill: "/admin/reports/profitability", higherIsBetter: true,
    definition: "Customer freight revenue minus carrier freight cost, for completed shipments in the period that have a recorded carrier cost.", source: "analytics_financial" },
  gross_margin_pct: { key: "gross_margin_pct", label: "Gross margin %", unit: "percent", mode: "active", adminOnly: true, drill: "/admin/reports/profitability", higherIsBetter: true,
    definition: "Gross brokerage margin divided by the customer freight revenue of the same shipments.", source: "analytics_financial" },
  avg_margin_per_load: { key: "avg_margin_per_load", label: "Average margin per load", unit: "money", mode: "active", adminOnly: true, drill: "/admin/reports/profitability", higherIsBetter: true,
    definition: "Total gross brokerage margin divided by the number of eligible completed loads (completed in the period with a recorded carrier cost).", source: "analytics_financial" },
  receivables_open: { key: "receivables_open", label: "Customer receivables", unit: "money", mode: "active", adminOnly: true, drill: "/admin/invoices?view=open", higherIsBetter: false,
    definition: "Issued invoice amounts minus payments received, as of the end of the period. Void invoices are excluded.", source: "analytics_financial" },
  overdue_invoices: { key: "overdue_invoices", label: "Overdue invoices", unit: "count", mode: "active", adminOnly: true, drill: "/admin/invoices?view=overdue", higherIsBetter: false,
    definition: "Issued invoices with an unpaid balance whose due date is before the end of the period.", source: "analytics_financial" },
  payables_due: { key: "payables_due", label: "Carrier payments due (7 days)", unit: "money", mode: "active", adminOnly: true, drill: "/admin/payables", higherIsBetter: false,
    definition: "Unpaid balances of carrier bills due within seven days after the end of the period, including anything already past due.", source: "analytics_financial" },
  cash_collected: { key: "cash_collected", label: "Cash collected", unit: "money", mode: "active", adminOnly: true, drill: "/admin/invoices", higherIsBetter: true,
    definition: "Customer payments received during the period (by payment date).", source: "analytics_financial" },
  operating_profit: { key: "operating_profit", label: "Operating profit estimate", unit: "money", mode: "active", adminOnly: true, drill: "/admin/reports/profitability", higherIsBetter: true,
    definition: "Recognized gross brokerage margin minus operating expenses recorded for the period. Excludes taxes and owner distributions. An estimate for management, not an income statement.", source: "analytics_financial" },
} as const satisfies Record<string, MetricDef>;

export type MetricKey = keyof typeof METRICS;
export const metric = (k: MetricKey): MetricDef => METRICS[k];

export const PRELAUNCH_KPIS: MetricKey[] = ["prospects_total", "new_prospects", "shippers_contacted", "active_conversations", "follow_ups_due", "potential_customers", "carrier_inquiries", "website_inquiries"];
export const ACTIVE_KPIS: MetricKey[] = ["freight_inquiries", "quotes_created", "quotes_accepted", "quote_win_rate", "completed_revenue", "gross_margin", "avg_margin_per_load", "active_shipments", "payables_due", "receivables_open", "overdue_invoices", "booked_revenue"];
