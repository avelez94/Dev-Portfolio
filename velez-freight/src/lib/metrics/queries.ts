import "server-only";
import { cache } from "react";
import type { StaffSession } from "@/lib/auth";
import type { Period } from "./period";
import { pct, toCents } from "@/lib/money";
import type { MetricKey } from "./definitions";

/** Optional dimensions shared by operational and financial analytics. */
export type Filters = { shipper?: string; carrier?: string; freightType?: string; originState?: string; destState?: string };

type Json = Record<string, unknown> & { [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function rpc(s: StaffSession, fn: string, args: Record<string, unknown>): Promise<Json | null> {
  const { data, error } = await s.db.rpc(fn, args);
  if (error) {
    // Permission refusals are expected for staff on financial functions: treat as unavailable.
    if (error.code !== "42501") console.error(`[analytics] ${fn} failed`, error.message);
    return null;
  }
  return data as Json;
}

const dims = (f: Filters = {}) => ({
  p_shipper: f.shipper ?? null, p_carrier: f.carrier ?? null, p_freight_type: f.freightType ?? null,
  p_origin_state: f.originState ?? null, p_dest_state: f.destState ?? null,
});

export const loadSales = cache((s: StaffSession, from: string, to: string) => rpc(s, "analytics_sales", { p_from: from, p_to: to }));
export const loadQuotes = cache((s: StaffSession, from: string, to: string, shipper?: string, freightType?: string) =>
  rpc(s, "analytics_quotes", { p_from: from, p_to: to, p_shipper: shipper ?? null, p_freight_type: freightType ?? null }));
export const loadOps = cache((s: StaffSession, from: string, to: string, f?: Filters) => rpc(s, "analytics_operations", { p_from: from, p_to: to, ...dims(f) }));
export const loadFinancial = cache((s: StaffSession, from: string, to: string, f?: Filters) =>
  s.role === "staff" ? Promise.resolve(null) : rpc(s, "analytics_financial", { p_from: from, p_to: to, ...dims(f) }));
export const loadTrends = cache((s: StaffSession, from: string, to: string, grain: string, f?: Filters) =>
  rpc(s, "analytics_trends", { p_from: from, p_to: to, p_grain: grain, ...dims(f) }));
export const loadContactToCustomer = cache((s: StaffSession, from: string, to: string) => rpc(s, "analytics_contact_to_customer", { p_from: from, p_to: to }));
export const loadCustomers = cache((s: StaffSession, from: string, to: string) => rpc(s, "analytics_customers", { p_from: from, p_to: to }) as Promise<Json[] | null>);
export const loadCarriers = cache((s: StaffSession, from: string, to: string) => rpc(s, "analytics_carriers", { p_from: from, p_to: to }) as Promise<Json[] | null>);

export type Snapshot = { sales: Json | null; quotes: Json | null; ops: Json | null; fin: Json | null };

export async function loadSnapshot(s: StaffSession, from: string, to: string, f?: Filters): Promise<Snapshot> {
  const [sales, quotes, ops, fin] = await Promise.all([loadSales(s, from, to), loadQuotes(s, from, to, f?.shipper, f?.freightType), loadOps(s, from, to, f), loadFinancial(s, from, to, f)]);
  return { sales, quotes, ops, fin };
}

/** Raw KPI values from a snapshot. Money is returned in cents. null means unavailable. */
export function kpiValues(x: Snapshot): Partial<Record<MetricKey, number | null>> {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const s = x.sales, q = x.quotes, o = x.ops, f = x.fin;
  const funnel = (s?.funnel ?? []) as { stage: string; reached: number }[];
  const reached = (stage: string) => funnel.find((r) => r.stage === stage)?.reached ?? 0;
  const decided = q ? Number(q.accepted) + Number(q.declined) + Number(q.expired) : 0;
  const onTime = (k: "pickup" | "delivery") => (o ? pct(o[k].on_time, o[k].on_time + o[k].late) : null);
  return {
    prospects_total: n(s?.prospects_total), new_prospects: n(s?.new_prospects), shippers_contacted: n(s?.shippers_contacted),
    active_conversations: n(s?.active_conversations), follow_ups_due: n(s?.follow_ups_due), potential_customers: n(s?.potential_customers),
    carrier_inquiries: n(s?.carrier_inquiries), website_inquiries: n(s?.website_inquiries),
    response_rate: s ? pct(s.outreach.answered, s.outreach.eligible) : null,
    lead_conversion: s ? pct(reached("active_customer"), s.new_prospects) : null,
    freight_inquiries: n(q?.freight_inquiries), quotes_created: n(q?.created), quotes_accepted: n(q?.accepted),
    quote_win_rate: q ? pct(Number(q.accepted), decided) : null,
    shipments_booked: n(o?.booked), shipments_completed: n(o?.completed), active_shipments: n(o?.active),
    on_time_pickup: onTime("pickup"), on_time_delivery: onTime("delivery"),
    booked_revenue: f ? toCents(f.booked_revenue) : null, completed_revenue: f ? toCents(f.completed_revenue) : null,
    gross_margin: f ? toCents(f.gross_margin) : null,
    gross_margin_pct: f ? pct(toCents(f.gross_margin), toCents(f.eligible_revenue)) : null,
    avg_margin_per_load: f && Number(f.eligible_loads) > 0 ? Math.round((toCents(f.gross_margin) ?? 0) / Number(f.eligible_loads)) : null,
    receivables_open: f ? toCents(f.receivables_open) : null, overdue_invoices: n(f?.overdue_invoices),
    payables_due: f ? toCents(f.payables_due_7_days) : null, cash_collected: f ? toCents(f.cash_collected) : null,
    operating_profit: f ? (toCents(f.gross_margin) ?? 0) - (toCents(f.operating_expenses) ?? 0) : null,
  };
}

export function periodArgs(p: Period) {
  return [p.from, p.to] as const;
}
