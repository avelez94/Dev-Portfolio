import { notFound, redirect } from "next/navigation";
import { FileSpreadsheet, FileText } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { periodQuery, resolvePeriod } from "@/lib/metrics/period";
import { REPORTS, buildReport, canView, cell } from "@/lib/reports/build";
import { freightTypes } from "@/config/admin";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodFilter } from "@/components/admin/period-filter";
import { SaveViewButton } from "@/components/admin/save-view";
import { filterSelect } from "@/components/admin/admin-ui";
import { loadView } from "@/app/admin/view-actions";

export const metadata = { title: "Report" };
type SP = { period?: string; from?: string; to?: string; shipper?: string; carrier?: string; freight?: string; clear?: string };
const isId = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : undefined);

export default async function ReportPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<SP> }) {
  const s = await requireStaff();
  const { key } = await params;
  const def = REPORTS.find((r) => r.key === key);
  if (!def) notFound();
  if (!canView(def, s)) redirect("/admin/reports");
  const sp = await searchParams;
  if (!Object.keys(sp).length) {
    const saved = await loadView(`report:${key}`);
    if (saved && Object.keys(saved).length) redirect(`/admin/reports/${key}?${new URLSearchParams(saved)}`);
  }
  const period = resolvePeriod(sp);
  const f = { shipper: isId(sp.shipper), carrier: isId(sp.carrier), freightType: freightTypes.some((x) => x.value === sp.freight) ? sp.freight : undefined };
  const [report, shippers, carriers] = await Promise.all([
    buildReport(def, s, period, f),
    def.filters.includes("shipper") ? s.db.from("shipper_prospects").select("id, company").order("company").limit(300) : Promise.resolve({ data: [] as { id: string; company: string }[] }),
    def.filters.includes("carrier") ? s.db.from("carrier_leads").select("id, company_name").order("company_name").limit(300) : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
  ]);
  const query = new URLSearchParams(periodQuery(period));
  if (f.shipper) query.set("shipper", f.shipper);
  if (f.carrier) query.set("carrier", f.carrier);
  if (f.freightType) query.set("freight", f.freightType);
  const saved = Object.fromEntries(query.entries());

  return (
    <>
      <PageHeader title={report.title} crumbs={[{ label: "Reports", href: "/admin/reports" }, { label: report.title }]} description={report.description}
        actions={<>
          <SaveViewButton viewKey={`report:${key}`} filters={saved} />
          <a href={`/admin/reports-export/${key}?${query}&format=csv`} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory"><FileSpreadsheet aria-hidden="true" className="size-4" /> Export CSV</a>
          <a href={`/admin/reports-export/${key}?${query}&format=pdf`} className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800"><FileText aria-hidden="true" className="size-4" /> Export PDF</a>
        </>} />
      <div className="mb-6 space-y-3 rounded-xl border border-line bg-white p-4">
        <PeriodFilter from={period.from} to={period.to} preset={period.preset} compareLabel={period.compareLabel} />
        {def.filters.length > 0 && (
          <form method="get" className="flex flex-wrap items-end gap-3">
            {sp.period && <input type="hidden" name="period" value={sp.period} />}{sp.from && <input type="hidden" name="from" value={sp.from} />}{sp.to && <input type="hidden" name="to" value={sp.to} />}
            {def.filters.includes("shipper") && <label className="text-xs font-semibold uppercase tracking-wide text-navy">Customer<select name="shipper" defaultValue={f.shipper ?? ""} className={`mt-1 block max-w-56 ${filterSelect}`}><option value="">All</option>{shippers.data?.map((o) => <option key={o.id} value={o.id}>{o.company}</option>)}</select></label>}
            {def.filters.includes("carrier") && <label className="text-xs font-semibold uppercase tracking-wide text-navy">Carrier<select name="carrier" defaultValue={f.carrier ?? ""} className={`mt-1 block max-w-56 ${filterSelect}`}><option value="">All</option>{carriers.data?.map((o) => <option key={o.id} value={o.id}>{o.company_name}</option>)}</select></label>}
            {def.filters.includes("freight") && <label className="text-xs font-semibold uppercase tracking-wide text-navy">Freight type<select name="freight" defaultValue={f.freightType ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All</option>{freightTypes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
            <button className="h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white">Apply</button>
          </form>
        )}
        <p className="text-xs text-slate-muted">Period: {report.period}. Generated {report.generatedAt}. Data source: {report.source}.</p>
      </div>
      {report.summary.length > 0 && (
        <dl className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.summary.map((x) => <div key={x.label} className="rounded-xl border border-line bg-white p-4"><dt className="text-xs text-slate-muted">{x.label}</dt><dd className="mt-1 font-serif text-2xl font-bold text-navy">{x.value}</dd></div>)}
        </dl>
      )}
      <div className="space-y-6">
        {report.sections.map((sec) => (
          <section key={sec.title} className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="p-4 text-left"><span className="font-sans text-sm font-bold text-navy">{sec.title}</span>{sec.note && <span className="block text-xs text-slate-muted">{sec.note}</span>}</caption>
              <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr>{sec.columns.map((c) => <th key={c.key} scope="col" className={`px-4 py-2.5 ${["money", "count", "percent"].includes(c.format ?? "") ? "text-right" : ""}`}>{c.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {sec.rows.map((row, i) => <tr key={i}>{sec.columns.map((c) => <td key={c.key} className={`px-4 py-2 ${["money", "count", "percent"].includes(c.format ?? "") ? "text-right tabular-nums" : ""}`}>{cell(row[c.key], c.format)}</td>)}</tr>)}
                {!sec.rows.length && <tr><td colSpan={sec.columns.length} className="px-4 py-6 text-center text-slate-muted">No records for this period.</td></tr>}
              </tbody>
            </table>
          </section>
        ))}
        {!report.sections.length && <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-slate-muted">No data is available for this report yet.</p>}
        {report.notes.map((n) => <p key={n} className="text-xs text-slate-muted">{n}</p>)}
      </div>
    </>
  );
}
