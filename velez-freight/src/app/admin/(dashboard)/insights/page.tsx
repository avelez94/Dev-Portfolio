import Link from "next/link";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { METRICS, REVENUE_RECOGNITION, type MetricKey } from "@/lib/metrics/definitions";
import { grainFor, periodQuery, resolvePeriod } from "@/lib/metrics/period";
import { kpiValues, loadCarriers, loadContactToCustomer, loadCustomers, loadSnapshot, loadTrends, type Filters } from "@/lib/metrics/queries";
import { buildInsights } from "@/lib/insights/rules";
import { fmtMoney, pct, toCents } from "@/lib/money";
import { industryCategories, label, leadSources, prospectStatuses, freightTypes } from "@/config/admin";
import { PageHeader, GatedModule } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { PeriodFilter } from "@/components/admin/period-filter";
import { Chart } from "@/components/admin/charts/chart";
import { C } from "@/components/admin/charts/types";
import { EmptyState, filterSelect } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import { SeoTab } from "./seo-tab";

export const metadata = { title: "Insights" };

const TABS = [
  { value: "executive", label: "Executive Overview" },
  { value: "sales", label: "Sales & CRM" },
  { value: "operations", label: "Freight Operations" },
  { value: "financial", label: "Financial Performance", adminOnly: true },
  { value: "carriers", label: "Carrier Performance" },
  { value: "customers", label: "Customer Performance" },
  { value: "seo", label: "Search & SEO" },
] as const;

type SP = { tab?: string; period?: string; from?: string; to?: string; grain?: string; shipper?: string; carrier?: string; freight?: string; origin?: string; dest?: string };
const isId = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : undefined);
const isState = (v?: string) => (v && /^[A-Z]{2}$/.test(v) ? v : undefined);

function bucketLabel(b: string, grain: string) {
  const d = new Date(`${b}T12:00:00Z`);
  if (grain === "month") return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const s = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return grain === "week" ? `Wk of ${s}` : s;
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const admin = isAdminRole(s.role);
  const settings = await getSettings();
  const tab = TABS.find((t) => t.value === sp.tab && (!("adminOnly" in t) || admin))?.value ?? "executive";
  const period = resolvePeriod(sp);
  const grain = ["day", "week", "month"].includes(sp.grain ?? "") ? sp.grain! : grainFor(period.days);
  const f: Filters = { shipper: isId(sp.shipper), carrier: isId(sp.carrier), freightType: freightTypes.some((x) => x.value === sp.freight) ? sp.freight : undefined, originState: isState(sp.origin), destState: isState(sp.dest) };
  const filtered = Object.values(f).some(Boolean);

  const [cur, prev, trends, shipperOpts, carrierOpts, stateRows] = await Promise.all([
    loadSnapshot(s, period.from, period.to, f),
    loadSnapshot(s, period.prevFrom, period.prevTo, f),
    loadTrends(s, period.from, period.to, grain, f),
    s.db.from("shipper_prospects").select("id, company").in("status", ["active_customer", "potential_customer", "qualified"]).order("company").limit(300),
    s.db.from("carrier_leads").select("id, company_name").eq("verification_status", "verified").order("company_name").limit(300),
    s.db.from("shipments").select("origin_state, dest_state").limit(2000),
  ]);
  const v = kpiValues(cur);
  const pv = kpiValues(prev);
  const points: Record<string, string | number | null>[] = ((trends?.points ?? []) as Record<string, string | number | null>[]).map((p) => ({ ...p, label: bucketLabel(String(p.bucket), grain) }));
  const states = [...new Set((stateRows.data ?? []).flatMap((r) => [r.origin_state as string, r.dest_state as string]))].sort();
  const base = new URLSearchParams(Object.entries(sp).filter(([k, val]) => val && k !== "tab") as [string, string][]);
  const tabHref = (t: string) => { const q = new URLSearchParams(base); q.set("tab", t); return `/admin/insights?${q}`; };
  const opsGate = !settings.operational;

  const kpi = (k: MetricKey, snapshot = false) => (!(METRICS[k] as { adminOnly?: boolean }).adminOnly || admin) ? <KpiCard key={k} def={METRICS[k]} value={v[k]} previous={pv[k]} snapshot={snapshot} /> : null;
  const money = (x: unknown) => (x === null || x === undefined ? null : Number(x));

  return (
    <>
      <PageHeader title="Insights" crumbs={[{ label: "Insights" }]} description={`Analysis of stored records only. ${period.label}, ${period.compareLabel}. Change the period or filters and every figure on the page updates together.`}
        actions={<Link href={`/admin/reports?${periodQuery(period)}`} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory">Reports and exports</Link>} />

      <nav aria-label="Insight areas" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.filter((t) => !("adminOnly" in t) || admin).map((t) => (
          <Link key={t.value} href={tabHref(t.value)} aria-current={tab === t.value ? "page" : undefined} className={cn("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold", tab === t.value ? "border-brand-red text-navy" : "border-transparent text-slate-muted hover:text-navy")}>{t.label}</Link>
        ))}
      </nav>

      <div className="mb-6 space-y-3 rounded-xl border border-line bg-white p-4">
        <PeriodFilter from={period.from} to={period.to} preset={period.preset} compareLabel={period.compareLabel} />
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value={tab} />
          {sp.period && <input type="hidden" name="period" value={sp.period} />}
          {sp.from && <input type="hidden" name="from" value={sp.from} />}
          {sp.to && <input type="hidden" name="to" value={sp.to} />}
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">Chart grain<select name="grain" defaultValue={grain} className={`mt-1 block ${filterSelect}`}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">Customer<select name="shipper" defaultValue={f.shipper ?? ""} className={`mt-1 block max-w-52 ${filterSelect}`}><option value="">All customers</option>{shipperOpts.data?.map((o) => <option key={o.id} value={o.id}>{o.company}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">Carrier<select name="carrier" defaultValue={f.carrier ?? ""} className={`mt-1 block max-w-52 ${filterSelect}`}><option value="">All carriers</option>{carrierOpts.data?.map((o) => <option key={o.id} value={o.id}>{o.company_name}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">Freight type<select name="freight" defaultValue={f.freightType ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All</option>{freightTypes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">Origin<select name="origin" defaultValue={f.originState ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">Any</option>{states.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">Destination<select name="dest" defaultValue={f.destState ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">Any</option>{states.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <button className="h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white">Apply</button>
          {(filtered || sp.grain) && <Link href={`/admin/insights?tab=${tab}&${periodQuery(period)}`} className="h-10 rounded-md px-3 py-2.5 text-sm font-semibold text-navy hover:bg-ivory-200">Clear filters</Link>}
        </form>
        {filtered && <p className="text-xs text-slate-muted">Customer, carrier, freight type and region filters apply to shipment based figures. Prospecting figures are not filtered.</p>}
      </div>

      {tab === "executive" && <Executive />}
      {tab === "sales" && <Sales />}
      {tab === "operations" && (opsGate ? <GatedModule title="Freight operations analytics" reason="Operational analytics use shipment records, which exist only after brokerage operations are enabled. Nothing is estimated in the meantime." /> : <Operations />)}
      {tab === "financial" && admin && <Financial />}
      {tab === "carriers" && <CarriersTab />}
      {tab === "customers" && <CustomersTab />}
      {tab === "seo" && <SeoTab s={s} period={period} />}
    </>
  );

  // ---------------------------------------------------------------- Tabs
  function Executive() {
    const risks = buildInsights(cur, prev, period.label, { operational: settings.operational }).filter((i) => i.tone === "risk");
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {settings.operational ? (["completed_revenue", "gross_margin", "gross_margin_pct", "avg_margin_per_load", "shipments_completed", "receivables_open", "cash_collected", "operating_profit"] as MetricKey[]).map((k) => kpi(k, k === "receivables_open"))
            : (["new_prospects", "shippers_contacted", "response_rate", "potential_customers"] as MetricKey[]).map((k) => kpi(k, k === "potential_customers"))}
        </div>
        {settings.operational && admin && <p className="text-xs text-slate-muted">{REVENUE_RECOGNITION} Booked revenue and collected cash are reported separately and never combined.</p>}
        <div className="grid gap-6 xl:grid-cols-2">
          {settings.operational && admin && <Chart title="Revenue trend" description="Completed freight revenue by delivery date." kind="line" data={points} xKey="label" format="money" series={[{ key: "revenue", label: "Completed revenue", color: C.navy }]} />}
          {settings.operational && admin && <Chart title="Customer revenue vs carrier cost" description="Loads with a recorded carrier cost. The gap is gross brokerage margin." kind="bar" data={points} xKey="label" format="money" series={[{ key: "revenue", label: "Customer revenue", color: C.navy }, { key: "carrier_cost", label: "Carrier cost", color: C.slate }]} />}
          {settings.operational && <Chart title="Shipment volume" description="Completed shipments by delivery date." kind="bar" data={points} xKey="label" series={[{ key: "completed_loads", label: "Completed loads", color: C.navy }]} />}
          {settings.operational && admin && <Chart title="Average margin per load" description="Gross margin divided by eligible completed loads in each period. Gaps mean no eligible loads." kind="line" data={points.map((p) => ({ ...p, avg: Number(p.margin_loads) > 0 ? Math.round((100 * Number(p.margin)) / Number(p.margin_loads)) / 100 : null }))} xKey="label" format="money" series={[{ key: "avg", label: "Average margin per load", color: C.champagne }]} />}
          <Chart title="Business growth" description="New shipper prospects and shippers reaching Active Customer, from stage history." kind="bar" data={points} xKey="label" series={[{ key: "new_prospects", label: "New prospects", color: C.slate }, { key: "new_customers", label: "New customers", color: C.navy }]} />
          {settings.operational && admin && cur.fin && <Chart title="Outstanding receivables by age" description="Unpaid invoice balances as of the end of the period, by days past due." kind="bar" format="money" xKey="bucket"
            data={[["Current", "current"], ["1 to 30", "d1_30"], ["31 to 60", "d31_60"], ["61 to 90", "d61_90"], ["Over 90", "d90_plus"]].map(([l, k]) => ({ bucket: l, amount: money(cur.fin!.receivables_aging[k]) }))} series={[{ key: "amount", label: "Balance", color: C.navy }]} />}
        </div>
        <section className="rounded-xl border border-line bg-white p-5">
          <h3 className="font-sans text-sm font-bold text-navy">Key risks</h3>
          {risks.length ? <ul className="mt-3 space-y-2">{risks.map((r) => <li key={r.id} className="text-sm"><span className="font-medium">{r.text}</span> <span className="text-xs text-slate-muted">{r.period}. {r.how}</span> <Link href={r.href} className="text-xs font-semibold text-brand-red-dark underline">Review</Link></li>)}</ul> : <p className="mt-2 text-sm text-slate-muted">No risks detected by the current rules for this period.</p>}
        </section>
      </div>
    );
  }

  function Sales() {
    const sa = cur.sales;
    if (!sa) return <EmptyState>Sales analytics are unavailable right now.</EmptyState>;
    const funnel = (sa.funnel as { stage: string; reached: number }[]).map((r) => ({ stage: label(prospectStatuses, r.stage), reached: r.reached }));
    const fu = sa.follow_up_performance;
    const toRows = (obj: Record<string, number>, list: readonly { value: string; label: string }[]) => Object.entries(obj ?? {}).map(([k, n]) => ({ name: label(list, k), count: n })).sort((a, b) => b.count - a.count);
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["new_prospects", "shippers_contacted", "response_rate", "lead_conversion", "active_conversations", "follow_ups_due", "potential_customers"] as MetricKey[]).map((k) => kpi(k, k === "follow_ups_due" || k === "potential_customers"))}
          <CttCard />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Chart title="Sales funnel" description={`Of the ${sa.new_prospects} prospects created in the period, how many reached each stage by the end of the period (from stage history). ${sa.funnel_lost} later marked lost.`} kind="hbar" data={funnel} xKey="stage" series={[{ key: "reached", label: "Prospects reaching stage", color: C.navy }]} />
          <Chart title="Outreach activity" description="Outbound calls, emails, meetings and other outreach recorded by the team." kind="stacked" data={points} xKey="label" series={[{ key: "calls", label: "Calls", color: C.navy }, { key: "emails", label: "Emails", color: C.sky }, { key: "meetings", label: "Meetings", color: C.champagne }, { key: "other_outreach", label: "Other", color: C.muted }]} />
          <Chart title="Follow up performance" description="Follow up tasks due in the period." kind="bar" xKey="name" data={[{ name: "On time", n: fu.on_time }, { name: "Completed late", n: fu.late }, { name: "Overdue", n: fu.overdue }, { name: "Not yet due", n: fu.open_not_due }, { name: "Closed or cancelled", n: fu.cancelled_or_auto }]} series={[{ key: "n", label: "Tasks", color: C.navy }]} />
          <Chart title="Lead sources" description="Where prospects created in the period came from." kind="hbar" data={toRows(sa.by_source, leadSources)} xKey="name" series={[{ key: "count", label: "Prospects", color: C.slate }]} />
          <Chart title="Industry breakdown" description="Industry category of prospects created in the period." kind="hbar" data={toRows(sa.by_industry, industryCategories)} xKey="name" series={[{ key: "count", label: "Prospects", color: C.slate }]} />
          <Chart title="Active customers by source" description="Current active customers by their original lead source." kind="hbar" data={toRows(sa.customers_by_source, leadSources)} xKey="name" series={[{ key: "count", label: "Customers", color: C.navy }]} />
        </div>
        <Definitions keys={["shippers_contacted", "response_rate", "lead_conversion", "active_conversations", "contact_to_customer_days"]} />
      </div>
    );
  }

  async function CttCard() {
    const ctt = admin ? await loadContactToCustomer(s, period.from, period.to) : null;
    return <KpiCard def={METRICS.contact_to_customer_days} value={ctt?.available && Number(ctt.customers) > 0 ? Number(ctt.avg_days) : null} snapshot />;
  }

  function Operations() {
    const o = cur.ops;
    if (!o) return <EmptyState>Operational analytics are unavailable right now.</EmptyState>;
    const perfRows = [{ name: "Pickup", ...o.pickup }, { name: "Delivery", ...o.delivery }];
    const toRows = (obj: Record<string, number>) => Object.entries(obj ?? {}).map(([k, n]) => ({ name: k.replace(/_/g, " "), count: n })).sort((a, b) => b.count - a.count);
    const lanes = (o.lanes ?? []) as Record<string, string | number | null>[];
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["shipments_booked", "shipments_completed", "active_shipments", "on_time_pickup", "on_time_delivery"] as MetricKey[]).map((k) => kpi(k, k === "active_shipments"))}
          <Stat label="Cancelled shipments" value={String(o.cancelled)} />
          <Stat label="Average transit time" value={o.avg_transit_hours === null ? "Not available" : `${o.avg_transit_hours} hours`} note="Verified pickup to verified delivery" />
          <Stat label="Missing PODs" value={String(o.missing_pods)} note={`POD turnaround ${o.avg_pod_hours === null ? "not available" : `${o.avg_pod_hours} hours on average`}`} href="/admin/shipments?view=missing_pod" />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Chart title="Pickup and delivery performance" description="Completed loads. Unknown means no verified timestamp or no appointment window; unknown is never counted as on time." kind="stacked" data={perfRows} xKey="name" series={[{ key: "on_time", label: "On time", color: C.success }, { key: "late", label: "Late", color: C.danger }, { key: "unknown", label: "Unknown", color: C.muted }]} />
          <Chart title="Booked and completed shipments" kind="bar" data={points} xKey="label" series={[{ key: "booked_loads", label: "Booked", color: C.slate }, { key: "completed_loads", label: "Completed", color: C.navy }]} />
          <Chart title="Exceptions by type" description={`${o.exceptions_total} exceptions opened in the period; ${o.open_exceptions} open now.`} kind="hbar" data={toRows(o.exceptions_by_type)} xKey="name" series={[{ key: "count", label: "Exceptions", color: C.warning }]} />
          <Chart title="Freight by type" description="Completed loads: expedited, dedicated and general." kind="hbar" data={toRows(o.by_freight_type)} xKey="name" series={[{ key: "count", label: "Loads", color: C.navy }]} />
          <Chart title="Freight by equipment" kind="hbar" data={toRows(o.by_equipment)} xKey="name" series={[{ key: "count", label: "Loads", color: C.slate }]} />
          <Chart title="Origins and destinations" description="Completed loads by origin state and destination state." kind="bar" xKey="name"
            data={[...new Set([...Object.keys(o.by_origin_state ?? {}), ...Object.keys(o.by_dest_state ?? {})])].sort().map((st) => ({ name: st, origin: o.by_origin_state?.[st] ?? 0, dest: o.by_dest_state?.[st] ?? 0 }))}
            series={[{ key: "origin", label: "Origin", color: C.navy }, { key: "dest", label: "Destination", color: C.champagne }]} />
        </div>
        <LaneTable lanes={lanes} repeat={o.repeat_lanes} />
      </div>
    );
  }

  function Financial() {
    const fi = cur.fin;
    if (!settings.operational) return <GatedModule title="Financial performance" reason="Freight revenue, margin, receivables and payables come from shipments, invoices and carrier bills, which exist only after operations are enabled. Operating expenses can already be recorded." />;
    if (!fi) return <EmptyState>Financial analytics are unavailable right now.</EmptyState>;
    const stages: [string, unknown, string][] = [
      ["Quoted revenue", fi.quoted_revenue, "Customer rates of quotes marked sent in the period."],
      ["Booked revenue", fi.booked_revenue, "Shipments booked in the period, excluding cancelled. Not yet earned."],
      ["Completed (billable) revenue", fi.completed_revenue, "Shipments delivered or completed in the period."],
      ["Invoiced revenue", fi.invoiced, "Invoices issued in the period."],
      ["Cash collected", fi.cash_collected, "Customer payments received in the period."],
      ["Carrier freight cost", fi.carrier_cost, "Carrier cost of completed loads with a recorded cost."],
      ["Gross brokerage margin", fi.gross_margin, "Customer freight revenue minus carrier freight cost, same loads."],
      ["Carrier payments made", fi.carrier_payments_made, "Payments to carriers dated in the period."],
      ["Carrier payables open", fi.payables_open, "Unpaid carrier bill balances as of period end."],
      ["Customer receivables open", fi.receivables_open, "Unpaid invoice balances as of period end."],
      ["Brokerage operating expenses", fi.operating_expenses, "Operating expenses recorded for the period."],
      ["Operating profit estimate", (toCents(fi.gross_margin)! - toCents(fi.operating_expenses)!) / 100, "Gross margin minus operating expenses. Excludes taxes and owner distributions."],
    ];
    const byCustomer = ((fi.by_customer ?? []) as { company: string; revenue: string; margin: string | null }[]).slice(0, 10).map((r) => ({ name: r.company.replace("[Synthetic] ", ""), revenue: Number(r.revenue), margin: r.margin === null ? null : Number(r.margin) }));
    const byType = Object.entries((fi.by_freight_type ?? {}) as Record<string, { revenue: string; margin: string; loads: number }>).map(([k, x]) => ({ name: label(freightTypes, k), margin: Number(x.margin), revenue: Number(x.revenue) }));
    const lanes = ((cur.ops?.lanes ?? []) as { origin_city: string; origin_state: string; dest_city: string; dest_state: string; avg_margin: string | null; loads: number }[])
      .filter((l) => l.avg_margin !== null).slice(0, 10).map((l) => ({ name: `${l.origin_city}, ${l.origin_state} to ${l.dest_city}, ${l.dest_state}`, margin: Math.round(Number(l.avg_margin) * l.loads * 100) / 100 }));
    const gmPct = points.map((p) => ({ label: p.label, pct: Number(p.revenue) > 0 && Number(p.margin_loads) > 0 ? pct(toCents(p.margin as string), toCents(p.revenue as string)) : null }));
    return (
      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-white p-5">
          <h3 className="font-sans text-sm font-bold text-navy">Revenue, margin and cash: kept separate</h3>
          <p className="mt-1 text-xs text-slate-muted">{REVENUE_RECOGNITION}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Financial summary for the period</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-muted"><tr><th scope="col" className="py-2">Measure</th><th scope="col" className="py-2 text-right">{period.label}</th><th scope="col" className="py-2 pl-4">How it is calculated</th></tr></thead>
              <tbody className="divide-y divide-line">{stages.map(([l, val, how]) => <tr key={l}><th scope="row" className="py-2 font-medium text-navy">{l}</th><td className="py-2 text-right tabular-nums">{fmtMoney(val as string)}</td><td className="py-2 pl-4 text-xs text-slate-muted">{how}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-muted">{fi.completed_loads} completed loads; {fi.eligible_loads} with a recorded carrier cost are used for margin{Number(fi.loads_missing_cost) > 0 ? `; ${fi.loads_missing_cost} missing carrier cost are excluded from margin` : ""}.</p>
        </section>
        <div className="grid gap-6 xl:grid-cols-2">
          <Chart title="Gross margin trend" kind="line" data={points} xKey="label" format="money" series={[{ key: "margin", label: "Gross margin", color: C.navy }]} />
          <Chart title="Gross margin percentage" description="Margin divided by revenue of the same loads, per period." kind="line" data={gmPct} xKey="label" format="percent" series={[{ key: "pct", label: "Gross margin %", color: C.champagne }]} />
          <Chart title="Revenue and margin by customer" description={`Top customers by completed revenue. Three largest customers: ${fi.top3_share_pct === null ? "not available" : `${fi.top3_share_pct}% of revenue`}.`} kind="hbar" data={byCustomer} xKey="name" format="money" series={[{ key: "revenue", label: "Revenue", color: C.navy }, { key: "margin", label: "Margin", color: C.champagne }]} />
          <Chart title="Margin by freight type" kind="hbar" data={byType} xKey="name" format="money" series={[{ key: "margin", label: "Gross margin", color: C.navy }]} />
          <Chart title="Margin by lane" description="Brokerage gross margin by lane; this is not a measure of profitability for the carrier." kind="hbar" data={lanes} xKey="name" format="money" series={[{ key: "margin", label: "Gross margin", color: C.slate }]} />
          <Chart title="Carrier payables by age" kind="bar" format="money" xKey="bucket" data={[["Current", "current"], ["1 to 30", "d1_30"], ["31 to 60", "d31_60"], ["61 to 90", "d61_90"], ["Over 90", "d90_plus"]].map(([l, k]) => ({ bucket: l, amount: money(fi.payables_aging[k]) }))} series={[{ key: "amount", label: "Balance", color: C.slate }]} />
          <Chart title="Operating expenses by category" kind="hbar" format="money" xKey="name" data={Object.entries((fi.expenses_by_category ?? {}) as Record<string, string>).map(([k, x]) => ({ name: k.replace("_", " "), amount: Number(x) }))} series={[{ key: "amount", label: "Expenses", color: C.slate }]} empty="No operating expenses recorded for this period." />
        </div>
        <Definitions keys={["completed_revenue", "gross_margin", "gross_margin_pct", "avg_margin_per_load", "operating_profit", "receivables_open"]} />
      </div>
    );
  }

  async function CarriersTab() {
    const rows = (await loadCarriers(s, period.from, period.to)) ?? [];
    if (opsGate && !rows.length) return <GatedModule title="Carrier performance" reason="Carrier performance comes from completed shipments. Until operations begin, use carrier profiles to track verification and onboarding." />;
    const r = (on: number, late: number) => (on + late ? `${pct(on, on + late)}%` : "Not available");
    return (
      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="p-4 text-left text-xs text-slate-muted">Completed shipments delivered in the period. On time rates exclude unknown timestamps, which are shown separately.</caption>
          <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Carrier</th><th scope="col" className="px-4 py-3 text-right">Completed</th><th scope="col" className="px-4 py-3 text-right">On time pickup</th><th scope="col" className="px-4 py-3 text-right">On time delivery</th><th scope="col" className="px-4 py-3 text-right">Unknown</th><th scope="col" className="px-4 py-3 text-right">Exceptions</th><th scope="col" className="px-4 py-3 text-right">POD turnaround</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.carrier_id}><th scope="row" className="px-4 py-2.5 font-medium"><Link href={`/admin/carriers/${c.carrier_id}`} className="text-navy hover:underline">{c.company_name}</Link></th>
                <td className="px-4 py-2.5 text-right">{c.completed}</td><td className="px-4 py-2.5 text-right">{r(c.pickup_on_time, c.pickup_late)}</td><td className="px-4 py-2.5 text-right">{r(c.delivery_on_time, c.delivery_late)}</td>
                <td className="px-4 py-2.5 text-right">{c.pickup_unknown + c.delivery_unknown}</td><td className="px-4 py-2.5 text-right">{c.exceptions}</td><td className="px-4 py-2.5 text-right">{c.avg_pod_hours === null ? "Not available" : `${c.avg_pod_hours} h`}</td></tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-muted">No completed shipments in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  async function CustomersTab() {
    const rows = (await loadCustomers(s, period.from, period.to)) ?? [];
    if (opsGate && !rows.length) return <GatedModule title="Customer performance" reason="Customer revenue and margin come from completed shipments. Until operations begin, the Sales and CRM tab shows prospect progress." />;
    return (
      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="p-4 text-left text-xs text-slate-muted">Customers with completed shipments in the period.{admin ? "" : " Revenue and margin are visible to owners and admins."}</caption>
          <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Customer</th><th scope="col" className="px-4 py-3">Industry</th><th scope="col" className="px-4 py-3 text-right">Loads</th>{admin && <><th scope="col" className="px-4 py-3 text-right">Revenue</th><th scope="col" className="px-4 py-3 text-right">Margin</th><th scope="col" className="px-4 py-3 text-right">Avg margin per load</th></>}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.shipper_id}><th scope="row" className="px-4 py-2.5 font-medium"><Link href={`/admin/shippers/${c.shipper_id}`} className="text-navy hover:underline">{c.company}</Link></th><td className="px-4 py-2.5">{label(industryCategories, c.industry_category)}</td><td className="px-4 py-2.5 text-right">{c.loads}</td>
                {admin && <><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(c.revenue)}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(c.margin)}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(c.avg_margin)}</td></>}</tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-muted">No completed shipments in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }
}

function Stat({ label: l, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-[0.8rem] font-semibold text-slate-muted">{l}</p>
      <p className="mt-2 font-serif text-[1.9rem] font-bold leading-none text-navy">{value}</p>
      {note && <p className="mt-2 text-xs text-slate-muted">{note}</p>}
      {href && <Link href={href} className="mt-2 inline-block text-xs font-semibold text-brand-red-dark hover:underline">View records</Link>}
    </div>
  );
}

function LaneTable({ lanes, repeat }: { lanes: Record<string, string | number | null>[]; repeat: number }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[860px] text-left text-sm">
        <caption className="p-4 text-left"><span className="font-sans text-sm font-bold text-navy">Lane performance</span><span className="block text-xs text-slate-muted">{repeat} repeat lanes (two or more loads). Margin shown is brokerage gross margin; it says nothing about whether a lane is profitable for the carrier.</span></caption>
        <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Origin</th><th scope="col" className="px-4 py-3">Destination</th><th scope="col" className="px-4 py-3 text-right">Loads</th><th scope="col" className="px-4 py-3 text-right">Avg customer charge</th><th scope="col" className="px-4 py-3 text-right">Avg carrier cost</th><th scope="col" className="px-4 py-3 text-right">Avg gross margin</th><th scope="col" className="px-4 py-3 text-right">Margin %</th><th scope="col" className="px-4 py-3 text-right">Exceptions</th></tr></thead>
        <tbody className="divide-y divide-line">
          {lanes.map((l, i) => (
            <tr key={i}><td className="px-4 py-2.5">{l.origin_city}, {l.origin_state}</td><td className="px-4 py-2.5">{l.dest_city}, {l.dest_state}</td><td className="px-4 py-2.5 text-right">{l.loads}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(l.avg_customer_rate)}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(l.avg_carrier_cost)}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(l.avg_margin)}</td><td className="px-4 py-2.5 text-right">{l.margin_pct === null ? "Not available" : `${l.margin_pct}%`}</td><td className="px-4 py-2.5 text-right">{l.exceptions}</td></tr>
          ))}
          {!lanes.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-muted">No completed shipments in this period.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function Definitions({ keys }: { keys: MetricKey[] }) {
  return (
    <details className="rounded-xl border border-line bg-white p-5">
      <summary className="cursor-pointer font-sans text-sm font-bold text-navy">Metric definitions</summary>
      <dl className="mt-3 space-y-3 text-sm">{keys.map((k) => <div key={k}><dt className="font-semibold text-navy">{METRICS[k].label}</dt><dd className="text-charcoal">{METRICS[k].definition}</dd></div>)}</dl>
    </details>
  );
}
