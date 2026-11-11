import "server-only";
import { isAdminRole, type StaffSession } from "@/lib/auth";
import { METRICS, REVENUE_RECOGNITION, type MetricKey } from "@/lib/metrics/definitions";
import { addDays, dayStartUtc, type Period } from "@/lib/metrics/period";
import { kpiValues, loadCarriers, loadCustomers, loadSnapshot, type Filters } from "@/lib/metrics/queries";
import { buildInsights } from "@/lib/insights/rules";
import { pct, toCents } from "@/lib/money";
import { formatValue } from "@/lib/metrics/format";
import { industryCategories, label, leadSources, prospectStatuses } from "@/config/admin";

import type { Column, Report, Section } from "./types";
import { cell } from "./types";
export type { Column, Report, Section };
export { cell };

export type ReportDef = { key: string; title: string; description: string; source: string; adminOnly?: boolean; operational?: boolean; filters: ("shipper" | "carrier" | "freight")[] };

export const REPORTS: ReportDef[] = [
  { key: "executive-summary", title: "Executive Summary", description: "Headline metrics for the period with comparisons and the plain English findings from the insight rules.", source: "analytics_sales, analytics_quotes, analytics_operations, analytics_financial", filters: [] },
  { key: "sales-pipeline", title: "Sales Pipeline", description: "Funnel from stage history, stage movements, lead sources and industries for prospects created in the period.", source: "analytics_sales (prospect_stage_events)", filters: [] },
  { key: "shipper-outreach", title: "Shipper Outreach", description: "Every recorded call, email and meeting in the period, response rate and follow up timeliness.", source: "crm_activities, follow_up_tasks", filters: ["shipper"] },
  { key: "freight-activity", title: "Freight Activity", description: "Shipments booked in the period with lane, freight type, carrier and status.", source: "shipments", operational: true, filters: ["shipper", "carrier", "freight"] },
  { key: "profitability", title: "Profitability", description: "Revenue, carrier cost and gross brokerage margin by customer and freight type, with operating expenses.", source: "analytics_financial", adminOnly: true, operational: true, filters: ["shipper", "carrier", "freight"] },
  { key: "receivables", title: "Receivables", description: "Open customer invoices with balances, due dates and aging as of the end of the period.", source: "invoices, invoice_payments", adminOnly: true, operational: true, filters: ["shipper"] },
  { key: "carrier-payables", title: "Carrier Payables", description: "Open carrier bills with balances, due dates and aging as of the end of the period.", source: "carrier_bills, carrier_payments", adminOnly: true, operational: true, filters: ["carrier"] },
  { key: "carrier-performance", title: "Carrier Performance", description: "Completed shipments, on time pickup and delivery with unknowns shown separately, exceptions and POD turnaround.", source: "analytics_carriers", operational: true, filters: [] },
  { key: "customer-performance", title: "Customer Performance", description: "Completed loads, revenue and margin by customer, and customer concentration.", source: "analytics_customers", operational: true, filters: [] },
  { key: "lane-analysis", title: "Lane Analysis", description: "Completed loads by lane with average charge, carrier cost, gross margin and exceptions.", source: "analytics_operations", operational: true, filters: ["shipper", "carrier", "freight"] },
];

export function canView(def: ReportDef, s: StaffSession) {
  return !def.adminOnly || isAdminRole(s.role);
}

const fmtNow = () => new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function buildReport(def: ReportDef, s: StaffSession, period: Period, f: Filters): Promise<Report> {
  const base = { key: def.key, title: def.title, description: def.description, period: `${period.label} (${period.from} to ${period.to})`, generatedAt: fmtNow(), source: def.source };
  const admin = isAdminRole(s.role);
  const cur = await loadSnapshot(s, period.from, period.to, f);
  const notes: string[] = [];
  const summary: Report["summary"] = [];
  const sections: Section[] = [];
  const kv = kpiValues(cur);

  switch (def.key) {
    case "executive-summary": {
      const prev = await loadSnapshot(s, period.prevFrom, period.prevTo, f);
      const pv = kpiValues(prev);
      const keys = (["new_prospects", "shippers_contacted", "response_rate", "active_conversations", "potential_customers", "website_inquiries", "carrier_inquiries", "quotes_created", "quote_win_rate", "shipments_completed", "completed_revenue", "gross_margin", "gross_margin_pct", "avg_margin_per_load", "cash_collected", "receivables_open", "operating_profit"] as MetricKey[])
        .filter((k) => !(METRICS[k] as { adminOnly?: boolean }).adminOnly || admin);
      sections.push({ title: "Key metrics", note: period.compareLabel, columns: [{ key: "metric", label: "Metric" }, { key: "current", label: "This period" }, { key: "previous", label: "Previous period" }, { key: "definition", label: "Definition" }],
        rows: keys.map((k) => ({ metric: METRICS[k].label, current: formatValue(METRICS[k].unit, kv[k]), previous: formatValue(METRICS[k].unit, pv[k]), definition: METRICS[k].definition })) });
      const ins = buildInsights(cur, prev, period.label, { operational: Boolean(cur.ops?.completed || cur.fin) });
      sections.push({ title: "Findings", columns: [{ key: "finding", label: "Finding" }, { key: "basis", label: "Basis" }], rows: ins.map((i) => ({ finding: i.text, basis: `${i.period}. ${i.how}` })) });
      if (admin) notes.push(REVENUE_RECOGNITION);
      break;
    }
    case "sales-pipeline": {
      const sa = cur.sales;
      summary.push({ label: "New prospects", value: String(sa?.new_prospects ?? 0) }, { label: "Total prospects", value: String(sa?.prospects_total ?? 0) }, { label: "Later marked lost", value: String(sa?.funnel_lost ?? 0) });
      const funnel = (sa?.funnel ?? []) as { stage: string; reached: number }[];
      sections.push({ title: "Funnel (prospects created in the period)", note: "Reached means the stage history shows the prospect at that stage or beyond by the end of the period.", columns: [{ key: "stage", label: "Stage" }, { key: "reached", label: "Reached", format: "count" }, { key: "share", label: "Share of cohort", format: "percent" }],
        rows: funnel.map((r) => ({ stage: label(prospectStatuses, r.stage), reached: r.reached, share: pct(r.reached, sa?.new_prospects) })) });
      sections.push({ title: "Stage movements in the period", columns: [{ key: "stage", label: "Moved to" }, { key: "count", label: "Changes", format: "count" }], rows: Object.entries(sa?.stage_moves ?? {}).map(([k, c]) => ({ stage: label(prospectStatuses, k), count: c as number })) });
      sections.push({ title: "Lead sources", columns: [{ key: "source", label: "Source" }, { key: "count", label: "New prospects", format: "count" }], rows: Object.entries(sa?.by_source ?? {}).map(([k, c]) => ({ source: label(leadSources, k), count: c as number })) });
      sections.push({ title: "Industries", columns: [{ key: "industry", label: "Industry" }, { key: "count", label: "New prospects", format: "count" }], rows: Object.entries(sa?.by_industry ?? {}).map(([k, c]) => ({ industry: label(industryCategories, k), count: c as number })) });
      break;
    }
    case "shipper-outreach": {
      const sa = cur.sales;
      let q = s.db.from("crm_activities").select("occurred_at, shipper_id, activity_type, direction, outcome, got_response, summary").not("shipper_id", "is", null)
        .gte("occurred_at", dayStartUtc(period.from)).lt("occurred_at", dayStartUtc(addDays(period.to, 1))).order("occurred_at", { ascending: false }).limit(2000);
      if (f.shipper) q = q.eq("shipper_id", f.shipper);
      const { data } = await q;
      const ids = [...new Set((data ?? []).map((a) => a.shipper_id as string))];
      const { data: names } = ids.length ? await s.db.from("shipper_prospects").select("id, company").in("id", ids) : { data: [] };
      const nm = new Map((names ?? []).map((r) => [r.id as string, r.company as string]));
      summary.push({ label: "Outbound outreach", value: String(sa?.outreach.total ?? 0) }, { label: "Response rate", value: formatValue("percent", kv.response_rate) }, { label: "Shippers contacted", value: String(sa?.shippers_contacted ?? 0) });
      const fu = sa?.follow_up_performance ?? {};
      sections.push({ title: "Follow up timeliness", columns: [{ key: "k", label: "Follow ups due in period" }, { key: "v", label: "Count", format: "count" }], rows: [["Completed on time", fu.on_time], ["Completed late", fu.late], ["Overdue", fu.overdue], ["Not yet due", fu.open_not_due], ["Closed automatically or cancelled", fu.cancelled_or_auto]].map(([k, v]) => ({ k: k as string, v: n(v) })) });
      sections.push({ title: "Activity log", note: "Activities recorded by the team. Response means the contact replied meaningfully.", columns: [{ key: "date", label: "Date", format: "date" }, { key: "shipper", label: "Shipper" }, { key: "type", label: "Type" }, { key: "outcome", label: "Outcome" }, { key: "responded", label: "Responded" }, { key: "summary", label: "Summary" }],
        rows: (data ?? []).map((a) => ({ date: String(a.occurred_at).slice(0, 10), shipper: nm.get(a.shipper_id as string) ?? "", type: `${a.direction} ${a.activity_type}`, outcome: String(a.outcome).replace("_", " "), responded: a.got_response ? "Yes" : "No", summary: String(a.summary).slice(0, 160) })) });
      break;
    }
    case "freight-activity": {
      let q = s.db.from("shipments").select("reference, booked_at, status, freight_type, equipment, origin_city, origin_state, dest_city, dest_state, shipper_id, carrier_id, customer_rate")
        .gte("booked_at", dayStartUtc(period.from)).lt("booked_at", dayStartUtc(addDays(period.to, 1))).order("booked_at", { ascending: false }).limit(2000);
      if (f.shipper) q = q.eq("shipper_id", f.shipper);
      if (f.carrier) q = q.eq("carrier_id", f.carrier);
      if (f.freightType) q = q.eq("freight_type", f.freightType);
      const { data } = await q;
      const o = cur.ops;
      summary.push({ label: "Booked", value: String(o?.booked ?? 0) }, { label: "Completed", value: String(o?.completed ?? 0) }, { label: "Cancelled", value: String(o?.cancelled ?? 0) }, { label: "Open exceptions", value: String(o?.open_exceptions ?? 0) });
      sections.push({ title: "Shipments booked in the period", columns: [{ key: "reference", label: "Reference" }, { key: "date", label: "Booked", format: "date" }, { key: "status", label: "Status" }, { key: "lane", label: "Lane" }, { key: "type", label: "Freight type" }, { key: "equipment", label: "Equipment" }, ...(admin ? [{ key: "rate", label: "Customer rate", format: "money" as const }] : [])],
        rows: (data ?? []).map((x) => ({ reference: x.reference, date: String(x.booked_at).slice(0, 10), status: String(x.status).replace("_", " "), lane: `${x.origin_city}, ${x.origin_state} to ${x.dest_city}, ${x.dest_state}`, type: x.freight_type, equipment: x.equipment, rate: n(x.customer_rate) })) });
      break;
    }
    case "profitability": {
      const fi = cur.fin;
      if (!fi) break;
      summary.push(...(["completed_revenue", "gross_margin", "gross_margin_pct", "avg_margin_per_load", "operating_profit"] as MetricKey[]).map((k) => ({ label: METRICS[k].label, value: formatValue(METRICS[k].unit, kv[k]) })));
      sections.push({ title: "By customer", columns: [{ key: "company", label: "Customer" }, { key: "loads", label: "Loads", format: "count" }, { key: "revenue", label: "Revenue", format: "money" }, { key: "margin", label: "Gross margin", format: "money" }, { key: "pct", label: "Margin %", format: "percent" }],
        rows: (fi.by_customer as { company: string; loads: number; revenue: string; margin: string | null }[]).map((c) => ({ company: c.company, loads: c.loads, revenue: n(c.revenue), margin: n(c.margin), pct: pct(toCents(c.margin), toCents(c.revenue)) })) });
      sections.push({ title: "By freight type", columns: [{ key: "type", label: "Freight type" }, { key: "loads", label: "Loads", format: "count" }, { key: "revenue", label: "Revenue", format: "money" }, { key: "margin", label: "Gross margin", format: "money" }, { key: "avg", label: "Avg margin per load", format: "money" }],
        rows: Object.entries(fi.by_freight_type as Record<string, { loads: number; revenue: string; margin: string; avg_margin: string }>).map(([k, v]) => ({ type: k, loads: v.loads, revenue: n(v.revenue), margin: n(v.margin), avg: n(v.avg_margin) })) });
      sections.push({ title: "Operating expenses", columns: [{ key: "cat", label: "Category" }, { key: "amount", label: "Amount", format: "money" }], rows: Object.entries(fi.expenses_by_category as Record<string, string>).map(([k, v]) => ({ cat: k.replace("_", " "), amount: n(v) })) });
      notes.push(REVENUE_RECOGNITION, `${fi.loads_missing_cost} completed loads without a recorded carrier cost are excluded from margin.`);
      break;
    }
    case "receivables":
    case "carrier-payables": {
      const fi = cur.fin;
      if (!fi) break;
      const isAR = def.key === "receivables";
      const aging = (isAR ? fi.receivables_aging : fi.payables_aging) as Record<string, string>;
      summary.push({ label: isAR ? "Open receivables" : "Open payables", value: formatValue("money", toCents(isAR ? fi.receivables_open : fi.payables_open)) });
      sections.push({ title: "Aging as of period end", columns: [{ key: "bucket", label: "Days past due" }, { key: "amount", label: "Balance", format: "money" }], rows: [["Current", "current"], ["1 to 30", "d1_30"], ["31 to 60", "d31_60"], ["61 to 90", "d61_90"], ["Over 90", "d90_plus"]].map(([l, k]) => ({ bucket: l, amount: n(aging[k]) })) });
      if (isAR) {
        let q = s.db.from("invoices").select("id, number, shipper_id, issued_on, due_on, amount").eq("status", "issued").lte("issued_on", period.to).order("due_on").limit(2000);
        if (f.shipper) q = q.eq("shipper_id", f.shipper);
        const { data: inv } = await q;
        const ids = (inv ?? []).map((i) => i.id as string);
        const { data: pays } = ids.length ? await s.db.from("invoice_payments").select("invoice_id, amount, received_on").in("invoice_id", ids).lte("received_on", period.to) : { data: [] };
        const sIds = [...new Set((inv ?? []).map((i) => i.shipper_id as string))];
        const { data: names } = sIds.length ? await s.db.from("shipper_prospects").select("id, company").in("id", sIds) : { data: [] };
        const nm = new Map((names ?? []).map((r) => [r.id as string, r.company as string]));
        const rows = (inv ?? []).map((i) => {
          const paid = (pays ?? []).filter((p) => p.invoice_id === i.id).reduce((a, p) => a + (toCents(p.amount) ?? 0), 0);
          const bal = (toCents(i.amount) ?? 0) - paid;
          return { number: i.number, customer: nm.get(i.shipper_id as string) ?? "", issued: i.issued_on, due: i.due_on, amount: n(i.amount), balance: bal / 100, days: Math.round((Date.parse(period.to) - Date.parse(String(i.due_on))) / 86_400_000) };
        }).filter((r) => (r.balance ?? 0) > 0);
        sections.push({ title: "Open invoices", columns: [{ key: "number", label: "Invoice" }, { key: "customer", label: "Customer" }, { key: "issued", label: "Issued", format: "date" }, { key: "due", label: "Due", format: "date" }, { key: "amount", label: "Amount", format: "money" }, { key: "balance", label: "Balance", format: "money" }, { key: "days", label: "Days past due", format: "count" }], rows });
      } else {
        let q = s.db.from("carrier_bills").select("id, carrier_id, carrier_invoice_reference, received_on, due_on, amount").neq("status", "void").lte("received_on", period.to).order("due_on").limit(2000);
        if (f.carrier) q = q.eq("carrier_id", f.carrier);
        const { data: bills } = await q;
        const ids = (bills ?? []).map((b) => b.id as string);
        const { data: pays } = ids.length ? await s.db.from("carrier_payments").select("bill_id, amount").in("bill_id", ids).lte("paid_on", period.to) : { data: [] };
        const cIds = [...new Set((bills ?? []).map((b) => b.carrier_id as string))];
        const { data: names } = cIds.length ? await s.db.from("carrier_leads").select("id, company_name").in("id", cIds) : { data: [] };
        const nm = new Map((names ?? []).map((r) => [r.id as string, r.company_name as string]));
        const rows = (bills ?? []).map((b) => {
          const paid = (pays ?? []).filter((p) => p.bill_id === b.id).reduce((a, p) => a + (toCents(p.amount) ?? 0), 0);
          return { carrier: nm.get(b.carrier_id as string) ?? "", ref: b.carrier_invoice_reference ?? "", received: b.received_on, due: b.due_on, amount: n(b.amount), balance: ((toCents(b.amount) ?? 0) - paid) / 100 };
        }).filter((r) => (r.balance ?? 0) > 0);
        sections.push({ title: "Open carrier bills", note: "Payment method and bank details are never stored in this system.", columns: [{ key: "carrier", label: "Carrier" }, { key: "ref", label: "Carrier invoice" }, { key: "received", label: "Received", format: "date" }, { key: "due", label: "Due", format: "date" }, { key: "amount", label: "Amount", format: "money" }, { key: "balance", label: "Balance", format: "money" }], rows });
      }
      break;
    }
    case "carrier-performance": {
      const rows = (await loadCarriers(s, period.from, period.to)) ?? [];
      const r = (a: number, b: number) => pct(a, a + b);
      sections.push({ title: "Carriers with completed shipments", note: "On time rates exclude unknown timestamps, which are counted separately.", columns: [{ key: "carrier", label: "Carrier" }, { key: "completed", label: "Completed", format: "count" }, { key: "pickup", label: "On time pickup", format: "percent" }, { key: "delivery", label: "On time delivery", format: "percent" }, { key: "unknown", label: "Unknown timestamps", format: "count" }, { key: "exceptions", label: "Exceptions", format: "count" }, { key: "pod", label: "POD hours", format: "count" }],
        rows: rows.map((c) => ({ carrier: c.company_name, completed: c.completed, pickup: r(c.pickup_on_time, c.pickup_late), delivery: r(c.delivery_on_time, c.delivery_late), unknown: c.pickup_unknown + c.delivery_unknown, exceptions: c.exceptions, pod: c.avg_pod_hours })) });
      break;
    }
    case "customer-performance": {
      const rows = (await loadCustomers(s, period.from, period.to)) ?? [];
      if (cur.fin?.top3_share_pct !== undefined && cur.fin?.top3_share_pct !== null) summary.push({ label: "Three largest customers' share of revenue", value: `${cur.fin.top3_share_pct}%` });
      sections.push({ title: "Customers with completed shipments", columns: [{ key: "company", label: "Customer" }, { key: "industry", label: "Industry" }, { key: "loads", label: "Loads", format: "count" }, ...(admin ? [{ key: "revenue", label: "Revenue", format: "money" as const }, { key: "margin", label: "Gross margin", format: "money" as const }, { key: "avg", label: "Avg margin per load", format: "money" as const }] : [])],
        rows: rows.map((c) => ({ company: c.company, industry: label(industryCategories, c.industry_category), loads: c.loads, revenue: n(c.revenue), margin: n(c.margin), avg: n(c.avg_margin) })) });
      break;
    }
    case "lane-analysis": {
      const lanes = (cur.ops?.lanes ?? []) as Record<string, string | number | null>[];
      summary.push({ label: "Lanes", value: String(lanes.length) }, { label: "Repeat lanes", value: String(cur.ops?.repeat_lanes ?? 0) });
      sections.push({ title: "Lanes (completed loads)", note: "Margin is brokerage gross margin. It does not show whether a lane is profitable for the carrier.", columns: [{ key: "origin", label: "Origin" }, { key: "dest", label: "Destination" }, { key: "loads", label: "Loads", format: "count" }, { key: "rate", label: "Avg customer charge", format: "money" }, { key: "cost", label: "Avg carrier cost", format: "money" }, { key: "margin", label: "Avg gross margin", format: "money" }, { key: "pct", label: "Margin %", format: "percent" }, { key: "exc", label: "Exceptions", format: "count" }],
        rows: lanes.map((l) => ({ origin: `${l.origin_city}, ${l.origin_state}`, dest: `${l.dest_city}, ${l.dest_state}`, loads: n(l.loads), rate: n(l.avg_customer_rate), cost: n(l.avg_carrier_cost), margin: n(l.avg_margin), pct: n(l.margin_pct), exc: n(l.exceptions) })) });
      break;
    }
  }
  return { ...base, summary, sections, notes };
}
