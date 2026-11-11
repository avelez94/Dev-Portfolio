/**
 * Deterministic smart insights. Each rule reads stored data already aggregated by the analytics
 * functions, states the period and the calculation, links to supporting records, and avoids
 * causal language. No AI is involved; nothing here takes an action.
 */
import type { Snapshot } from "@/lib/metrics/queries";
import { kpiValues } from "@/lib/metrics/queries";
import { fmtMoney } from "@/lib/money";

export type Insight = { id: string; tone: "risk" | "positive" | "neutral"; text: string; period: string; how: string; href: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildInsights(cur: Snapshot, prev: Snapshot, periodLabel: string, opts: { operational: boolean }): Insight[] {
  const out: Insight[] = [];
  const k = kpiValues(cur);
  const kp = kpiValues(prev);
  const s = cur.sales;

  if (s && Number(s.follow_ups_due) > 0)
    out.push({ id: "followups_overdue", tone: "risk", text: `${plural(Number(s.follow_ups_due), "shipper follow up")} ${Number(s.follow_ups_due) === 1 ? "is" : "are"} due or overdue.`,
      period: "As of today", how: "Open follow up tasks due today or earlier that are not snoozed.", href: "/admin/tasks?view=overdue&category=follow_up" });

  const fu = s?.follow_up_performance;
  if (fu && Number(fu.on_time) + Number(fu.late) >= 3)
    out.push({ id: "followup_timeliness", tone: Number(fu.late) > Number(fu.on_time) ? "risk" : "neutral",
      text: `${Number(fu.on_time)} of ${Number(fu.on_time) + Number(fu.late)} completed follow ups were finished on or before their due date.`,
      period: periodLabel, how: "Follow up tasks due in the period, comparing completion date with due date.", href: "/admin/insights?tab=sales" });

  if (s && Number(s.outreach.eligible) >= 5 && k.response_rate !== null)
    out.push({ id: "response_rate", tone: "neutral", text: `${k.response_rate?.toFixed(1)}% of eligible outreach received a response (${s.outreach.answered} of ${s.outreach.eligible}).`,
      period: periodLabel, how: "Answered eligible outbound activities divided by eligible outbound activities.", href: "/admin/insights?tab=sales" });

  if (k.website_inquiries !== null && kp.website_inquiries !== null && (k.website_inquiries ?? 0) + (kp.website_inquiries ?? 0) > 0)
    out.push({ id: "inquiries_change", tone: "neutral", text: `${plural(k.website_inquiries ?? 0, "website inquiry", "website inquiries")} were received, compared with ${kp.website_inquiries} in the previous period.`,
      period: periodLabel, how: "Count of inquiries submitted through the website by submission date.", href: "/admin/inquiries" });

  if (!opts.operational) return out;

  const f = cur.fin;
  const fp = prev.fin;
  if (f) {
    const top = Number(f.top3_share_pct);
    if (f.top3_share_pct !== null && (f.by_customer?.length ?? 0) > 3 && top >= 50)
      out.push({ id: "concentration", tone: "risk", text: `Three customers account for ${top.toFixed(0)}% of completed freight revenue.`, period: periodLabel,
        how: "Revenue of the three largest customers divided by total completed freight revenue.", href: "/admin/reports/customer-performance" });
    if (k.gross_margin_pct !== null && kp.gross_margin_pct !== null && fp && Math.abs((k.gross_margin_pct ?? 0) - (kp.gross_margin_pct ?? 0)) >= 0.5) {
      const down = (k.gross_margin_pct ?? 0) < (kp.gross_margin_pct ?? 0);
      out.push({ id: "margin_trend", tone: down ? "risk" : "positive",
        text: `Gross margin ${down ? "declined" : "increased"} to ${k.gross_margin_pct?.toFixed(1)}% from ${kp.gross_margin_pct?.toFixed(1)}% in the previous period.`, period: periodLabel,
        how: "Gross brokerage margin divided by revenue of the same completed loads, compared with the preceding period of equal length.", href: "/admin/reports/profitability" });
    }
    const aging = f.receivables_aging ?? {};
    const over30 = Number(aging.d31_60 ?? 0) + Number(aging.d61_90 ?? 0) + Number(aging.d90_plus ?? 0);
    if (over30 > 0)
      out.push({ id: "receivables_30", tone: "risk", text: `${fmtMoney(over30)} of receivables is more than 30 days past due.`, period: "As of the end of the period",
        how: "Unpaid balances of issued invoices whose due date is more than 30 days before the end of the period.", href: "/admin/invoices?view=overdue" });
    const types = Object.entries((f.by_freight_type ?? {}) as Record<string, { loads: number; avg_margin: string }>).filter(([, v]) => Number(v.loads) >= 3);
    if (types.length >= 2) {
      const [best, v] = types.sort((a, b) => Number(b[1].avg_margin) - Number(a[1].avg_margin))[0];
      out.push({ id: "best_freight_type", tone: "positive", text: `${best[0].toUpperCase() + best.slice(1)} freight had the highest average margin per load (${fmtMoney(v.avg_margin)} over ${v.loads} loads).`,
        period: periodLabel, how: "Average of customer rate minus carrier cost per completed load, by freight type, for types with at least three loads.", href: "/admin/insights?tab=financial" });
    }
  }
  const o = cur.ops;
  if (o) {
    if (Number(o.open_exceptions) > 0) out.push({ id: "exceptions", tone: "risk", text: `${plural(Number(o.open_exceptions), "shipment exception")} ${Number(o.open_exceptions) === 1 ? "is" : "are"} open.`,
      period: "As of today", how: "Recorded exceptions without a resolution.", href: "/admin/shipments?view=exceptions" });
    if (Number(o.missing_pods) > 0) out.push({ id: "pods", tone: "risk", text: `${plural(Number(o.missing_pods), "delivered shipment")} ${Number(o.missing_pods) === 1 ? "has" : "have"} no proof of delivery on file.`,
      period: "As of today", how: "Delivered or completed shipments without a POD document record.", href: "/admin/shipments?view=missing_pod" });
    const unknown = Number(o.pickup?.unknown ?? 0);
    if (unknown > 0) out.push({ id: "unknown_pickups", tone: "neutral", text: `${plural(unknown, "completed load")} ${unknown === 1 ? "has" : "have"} no verified pickup time, so on time performance is unknown for ${unknown === 1 ? "it" : "them"}.`,
      period: periodLabel, how: "Completed loads without a verified pickup event or appointment window are reported as unknown, not on time.", href: "/admin/insights?tab=operations" });
  }
  return out;
}
