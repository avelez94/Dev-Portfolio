import Link from "next/link";
import { FileSpreadsheet, FileText, Lock } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { periodQuery, resolvePeriod } from "@/lib/metrics/period";
import { REPORTS, canView } from "@/lib/reports/build";
import { fmtDateTime } from "@/config/admin";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const s = await requireStaff();
  const period = resolvePeriod(await searchParams);
  const settings = await getSettings();
  const admin = isAdminRole(s.role);
  const { data: exports } = admin ? await s.db.from("audit_events").select("entity_id, created_at").eq("action", "report.exported").order("created_at", { ascending: false }).limit(500) : { data: [] };
  const last = new Map<string, string>();
  (exports ?? []).forEach((e) => !last.has(e.entity_id as string) && last.set(e.entity_id as string, e.created_at as string));
  const q = periodQuery(period);
  return (
    <>
      <PageHeader title="Reports" crumbs={[{ label: "Reports" }]} description="Standard reports built from the same metric definitions as the dashboard and Insights. Open a report to set its date range and filters, then export CSV or PDF. Exports are recorded in the audit log." />
      <ul className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => {
          const allowed = canView(r, s);
          const empty = r.operational && !settings.operational;
          return (
            <li key={r.key} className="flex flex-col rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold">{r.title}</h2>
                {r.adminOnly && <span className="inline-flex items-center gap-1 rounded bg-ivory-200 px-2 py-0.5 text-xs font-semibold text-navy"><Lock aria-hidden="true" className="size-3" /> Owners and admins</span>}
              </div>
              <p className="mt-1 flex-1 text-sm text-charcoal">{r.description}</p>
              <p className="mt-3 text-xs text-slate-muted">Data source: {r.source}. {empty ? "Shows empty results until brokerage operations begin." : ""}</p>
              <p className="mt-1 text-xs text-slate-muted">Last exported: {last.get(r.key) ? fmtDateTime(last.get(r.key)) : "Never"}. Reports are generated live when opened.</p>
              {allowed ? (
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Link href={`/admin/reports/${r.key}?${q}`} className="rounded-md bg-navy px-3 py-2 font-semibold text-white hover:bg-navy-800">View report</Link>
                  <a href={`/admin/reports-export/${r.key}?${q}&format=csv`} className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 font-semibold text-navy hover:bg-ivory"><FileSpreadsheet aria-hidden="true" className="size-4" /> CSV</a>
                  <a href={`/admin/reports-export/${r.key}?${q}&format=pdf`} className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 font-semibold text-navy hover:bg-ivory"><FileText aria-hidden="true" className="size-4" /> PDF</a>
                </div>
              ) : <p className="mt-4 text-sm text-slate-muted">Requires owner or admin access.</p>}
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-slate-muted">Scheduled email delivery of reports is designed but switched off. It can be enabled only after you approve an email provider and recipients.</p>
    </>
  );
}
