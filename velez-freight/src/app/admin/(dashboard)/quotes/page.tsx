import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { fmtDate, fmtDateTime } from "@/config/admin";
import { fmtMoney } from "@/lib/money";
import { EmptyState, FilterLinks, Pager, StatusBadge } from "@/components/admin/admin-ui";
import { GatedModule, PageHeader } from "@/components/admin/page-header";
import { MarginLine, lane } from "@/components/admin/ops-ui";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Quotes" };
const STATUSES = ["draft", "pending_approval", "approved", "sent", "accepted", "declined", "expired", "cancelled"].map((v) => ({ value: v, label: v.replace("_", " ").replace(/^./, (c) => c.toUpperCase()) }));

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const s = await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  const header = <PageHeader title="Quotes" crumbs={[{ label: "Quotes" }]} description="Prices are prepared by a person, approved by an owner or admin, and sent by you outside this system. Nothing here quotes a customer automatically."
    actions={settings.operational ? <Link href="/admin/quotes/new" className={buttonVariants({ size: "sm" })}><Plus aria-hidden="true" /> New quote</Link> : null} />;
  if (!settings.operational) return <>{header}<GatedModule title="Quotes are not available yet" reason="Mary’s Logistics Group is in prelaunch mode, so no freight can be quoted. This module opens automatically once broker authority is verified and operations are enabled." /></>;
  const status = STATUSES.some((x) => x.value === sp.status) ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  let q = s.db.from("quotes").select("id, reference, status, shipper_id, origin_city, origin_state, dest_city, dest_state, customer_rate, estimated_carrier_cost, valid_until, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, count } = await q.range((page - 1) * 25, page * 25 - 1);
  const ids = [...new Set((data ?? []).map((r) => r.shipper_id as string))];
  const { data: names } = ids.length ? await s.db.from("shipper_prospects").select("id, company").in("id", ids) : { data: [] };
  const nm = new Map((names ?? []).map((r) => [r.id as string, r.company as string]));
  return (
    <>
      {header}
      <div className="mb-5"><FilterLinks base="/admin/quotes" param="status" current={status} options={STATUSES} /></div>
      {data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">Quotes</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Quote</th><th scope="col" className="px-4 py-3">Customer</th><th scope="col" className="px-4 py-3">Lane</th><th scope="col" className="px-4 py-3 text-right">Rate</th><th scope="col" className="px-4 py-3">Estimated margin</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Created</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((x) => (
                <tr key={x.id}><td className="px-4 py-2.5"><Link href={`/admin/quotes/${x.id}`} className="font-mono text-xs font-semibold text-brand-red-dark underline">{x.reference}</Link></td><td className="px-4 py-2.5">{nm.get(x.shipper_id as string)}</td><td className="px-4 py-2.5 text-xs">{lane(x)}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(x.customer_rate)}</td><td className="px-4 py-2.5 text-xs"><MarginLine rate={x.customer_rate} cost={x.estimated_carrier_cost} /></td><td className="px-4 py-2.5"><StatusBadge value={x.status} label={x.status.replace("_", " ")} /></td><td className="px-4 py-2.5 text-xs text-slate-muted">{fmtDateTime(x.created_at)}{x.valid_until ? ` · valid to ${fmtDate(x.valid_until)}` : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState>No quotes{status ? " with this status" : " yet"}. Start from a freight inquiry or create one directly.</EmptyState>}
      <Pager base="/admin/quotes" params={{ status }} page={page} pageSize={25} total={count ?? 0} />
    </>
  );
}
