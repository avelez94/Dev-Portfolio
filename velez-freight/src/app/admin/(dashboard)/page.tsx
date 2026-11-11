import Link from "next/link";
import { ArrowRight, Building2, CircleCheck, Lightbulb, ListChecks, Plus, TriangleAlert } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { ACTIVE_KPIS, METRICS, PRELAUNCH_KPIS, type MetricKey } from "@/lib/metrics/definitions";
import { businessToday, periodQuery, resolvePeriod } from "@/lib/metrics/period";
import { kpiValues, loadSnapshot } from "@/lib/metrics/queries";
import { buildInsights } from "@/lib/insights/rules";
import { loadPriorities, loadTeam } from "@/lib/priorities";
import { PriorityList } from "@/components/admin/priority-list";
import { prospectStatuses } from "@/config/admin";
import { KpiCard } from "@/components/admin/kpi-card";
import { PeriodFilter } from "@/components/admin/period-filter";
import { buttonVariants } from "@/components/ui/button";

import { LAUNCH_ITEMS } from "@/config/launch";

export const metadata = { title: "Business Command Center" };

const SNAPSHOT: MetricKey[] = ["follow_ups_due", "potential_customers", "active_shipments", "receivables_open", "overdue_invoices", "payables_due"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; denied?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const settings = await getSettings();
  const [priorities, team, cur, prev, pipeline] = await Promise.all([
    loadPriorities(s, 100),
    loadTeam(s),
    loadSnapshot(s, period.from, period.to),
    loadSnapshot(s, period.prevFrom, period.prevTo),
    s.db.from("shipper_prospects").select("status"),
  ]);
  const values = kpiValues(cur);
  const prevValues = kpiValues(prev);
  const insights = buildInsights(cur, prev, period.label, { operational: settings.operational }).slice(0, 6);
  const admin = isAdminRole(s.role);
  const kpis = [...(settings.operational ? ACTIVE_KPIS : []), ...PRELAUNCH_KPIS].filter((k) => !(METRICS[k] as { adminOnly?: boolean }).adminOnly || admin);
  const today = businessToday();
  const dateText = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const critical = priorities.filter((p) => p.priority_tier <= 2).length;
  const overdue = priorities.filter((p) => p.overdue).length;

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-muted"><span className="font-semibold text-navy">Business Command Center</span> <span aria-hidden="true">·</span> {dateText}</p>
          <h1 className="mt-1 text-[2rem] font-bold leading-tight">{greeting}{s.name ? `, ${s.name.split(" ")[0]}` : ""}.</h1>
          <p className="mt-1 text-sm text-charcoal">
            {priorities.length === 0
              ? "Here’s what needs your attention today: nothing right now."
              : `Here’s what needs your attention today: ${priorities.length} item${priorities.length === 1 ? "" : "s"}${overdue ? `, ${overdue} overdue` : ""}${critical ? `, ${critical} critical or risk` : ""}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/shippers/new" className={buttonVariants({ size: "sm" })}><Plus aria-hidden="true" /> Add shipper</Link>
          <Link href="/admin/tasks?new=1" className={buttonVariants({ size: "sm", variant: "outline" })}><ListChecks aria-hidden="true" /> Add task</Link>
        </div>
      </header>
      {sp.denied && <p role="alert" className="mb-6 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">That page requires owner or admin access.</p>}
      {!settings.operational && (
        <p className="mb-6 rounded-lg border border-line bg-white p-4 text-sm">
          <strong className="text-navy">Prelaunch mode.</strong> Quotes, shipments, invoicing and payables stay off until broker authority is verified and operations are enabled.
          Focus areas now: shipper prospecting, follow ups, carrier relationships and business setup.{" "}
          <Link href="/admin/settings?tab=compliance#launch" className="font-semibold text-brand-red-dark underline">Launch checklist</Link> ({LAUNCH_ITEMS.filter((i) => settings.launchChecklist[i.key]?.status === "done").length} of {LAUNCH_ITEMS.length} done){" "}
          <span aria-hidden="true">·</span> <Link href="/admin/settings?tab=compliance#operating-status" className="font-semibold text-brand-red-dark underline">Activation checklist</Link>{" "}
          <span aria-hidden="true">·</span> <Link href="/admin/preview" className="font-semibold text-brand-red-dark underline">Launch preview</Link>
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.35fr_1fr]">
        <section aria-labelledby="priorities-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="priorities-title" className="text-xl font-bold">Today&apos;s priorities</h2>
            <Link href="/admin/tasks?view=today" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark hover:underline">All tasks <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
          <p className="mb-4 text-xs text-slate-muted">Ordered by critical exceptions, financial and compliance risk, time sensitive work, sales opportunities, then routine work. Generated by explicit workflow rules from your records.</p>
          {priorities.length ? (
            <PriorityList items={priorities} team={team} />
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
              <CircleCheck aria-hidden="true" className="mx-auto size-8 text-success" />
              <p className="mt-3 font-semibold text-navy">You are all caught up.</p>
              <p className="mt-1 text-sm text-slate-muted">Good next steps: research a new shipper, schedule follow ups, or review carrier interest.</p>
              <div className="mt-4 flex justify-center gap-2 text-sm">
                <Link href="/admin/shippers/new" className="rounded-md bg-navy px-3 py-2 font-semibold text-white">Add a shipper prospect</Link>
                <Link href="/admin/carriers" className="rounded-md border border-line px-3 py-2 font-semibold text-navy">Review carriers</Link>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="insights-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="insights-title" className="text-xl font-bold">What the numbers say</h2>
            <Link href={`/admin/insights?${periodQuery(period)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark hover:underline">Insights <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
          {insights.length ? (
            <ul className="space-y-3">
              {insights.map((i) => (
                <li key={i.id} className="rounded-lg border border-line bg-white p-4">
                  <p className="flex gap-2 text-sm font-medium text-charcoal">
                    {i.tone === "risk" ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" /> : <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />}
                    <span>{i.text}</span>
                  </p>
                  <p className="mt-1.5 pl-6 text-xs text-slate-muted">{i.period}. {i.how} <Link href={i.href} className="font-semibold text-brand-red-dark hover:underline">See records</Link></p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-white p-6 text-sm text-slate-muted">Insights appear here once there is enough recorded activity to say something meaningful. Nothing is estimated or invented.</p>
          )}
          <div className="mt-6 rounded-xl border border-line bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-navy"><Building2 aria-hidden="true" className="size-4 text-brand-red" /> Pipeline today</h3>
              <Link href="/admin/shippers" className="text-xs font-semibold text-brand-red-dark hover:underline">Shippers</Link>
            </div>
            <ul className="grid grid-cols-2 gap-1.5 text-sm">
              {prospectStatuses.map((p) => (
                <li key={p.value}><Link href={`/admin/shippers?status=${p.value}`} className="flex justify-between rounded-md bg-ivory px-3 py-1.5 hover:bg-ivory-200"><span>{p.label}</span><span className="font-bold text-navy">{pipeline.data?.filter((r) => r.status === p.value).length ?? 0}</span></Link></li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section aria-labelledby="kpi-title" className="mt-10">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="kpi-title" className="text-xl font-bold">Key metrics</h2>
            <p className="text-xs text-slate-muted">{period.label}. Calculated from stored records only; select the information icon on any card for its definition.</p>
          </div>
          <PeriodFilter from={period.from} to={period.to} preset={period.preset} compareLabel={period.compareLabel} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k} def={METRICS[k]} value={values[k]} previous={prevValues[k]} snapshot={SNAPSHOT.includes(k)} />
          ))}
        </div>
      </section>
    </>
  );
}
