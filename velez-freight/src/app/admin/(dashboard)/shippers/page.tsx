import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { fmtDate, fmtDateTime, industryCategories, label, leadSources, prospectStatuses } from "@/config/admin";
import { EmptyState, FilterBar, Pager, StatusBadge, filterSelect } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { SaveViewButton } from "@/components/admin/save-view";
import { buttonVariants } from "@/components/ui/button";
import { loadView } from "@/app/admin/view-actions";
import { addDays, businessToday } from "@/lib/metrics/period";

export const metadata = { title: "Shippers" };
const PAGE = 25;
type SP = { status?: string; source?: string; industry?: string; q?: string; sort?: string; view?: string; page?: string; clear?: string };

export default async function ShippersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const hasFilters = ["status", "source", "industry", "q", "sort", "view"].some((k) => sp[k as keyof SP]);
  if (!hasFilters && !sp.clear && !sp.page) {
    const saved = await loadView("view:shippers");
    if (saved && Object.keys(saved).length) redirect(`/admin/shippers?${new URLSearchParams(saved)}`);
  }
  const status = prospectStatuses.some((p) => p.value === sp.status) ? sp.status : undefined;
  const source = leadSources.some((p) => p.value === sp.source) ? sp.source : undefined;
  const industry = industryCategories.some((p) => p.value === sp.industry) ? sp.industry : undefined;
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N}@\s._+-]/gu, "").trim().slice(0, 60);
  const sort = ["follow_up", "newest", "name", "updated"].includes(sp.sort ?? "") ? sp.sort! : "follow_up";
  const page = Math.max(1, Number(sp.page) || 1);
  const today = businessToday();

  let contactedIds: string[] | null = null;
  if (sp.view === "contacted") {
    const { data } = await s.db.from("crm_activities").select("shipper_id").eq("direction", "outbound").in("outcome", ["completed", "left_message", "no_answer"]).gte("occurred_at", `${addDays(today, -30)}T00:00:00Z`).limit(2000);
    contactedIds = [...new Set((data ?? []).map((r) => r.shipper_id as string).filter(Boolean))];
  }

  let query = s.db.from("shipper_prospects").select("id, company, contact_name, industry_category, source, location, status, next_follow_up, updated_at, created_at", { count: "exact" });
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (industry) query = query.eq("industry_category", industry);
  if (q) query = query.or(`company.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,location.ilike.%${q}%`);
  if (contactedIds) query = query.in("id", contactedIds.length ? contactedIds : ["00000000-0000-0000-0000-000000000000"]);
  query = sort === "newest" ? query.order("created_at", { ascending: false }) : sort === "name" ? query.order("company") : sort === "updated" ? query.order("updated_at", { ascending: false })
    : query.order("next_follow_up", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: false });
  const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  const ids = (data ?? []).map((r) => r.id as string);
  const { data: acts } = ids.length ? await s.db.from("crm_activities").select("shipper_id, occurred_at").in("shipper_id", ids).order("occurred_at", { ascending: false }).limit(500) : { data: [] };
  const last = new Map<string, string>();
  (acts ?? []).forEach((a) => !last.has(a.shipper_id as string) && last.set(a.shipper_id as string, a.occurred_at as string));
  const filters = Object.fromEntries(Object.entries({ status, source, industry, q: q || undefined, sort: sort !== "follow_up" ? sort : undefined, view: sp.view }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <>
      <PageHeader title="Shippers" crumbs={[{ label: "Shippers" }]} description="Every prospect and customer in one place. Open a shipper to see its history, contacts, follow ups and performance."
        actions={<><SaveViewButton viewKey="view:shippers" filters={filters} /><Link href="/admin/shippers/new" className={buttonVariants({ size: "sm" })}><Plus aria-hidden="true" /> Add shipper</Link></>} />
      <FilterBar base="/admin/shippers" active={Object.keys(filters).length > 0}>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Search<input name="q" defaultValue={q} placeholder="Company, contact, email, city" className={`mt-1 block w-56 ${filterSelect}`} /></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Stage<select name="status" defaultValue={status ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All stages</option>{prospectStatuses.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Source<select name="source" defaultValue={source ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All sources</option>{leadSources.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Industry<select name="industry" defaultValue={industry ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All industries</option>{industryCategories.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Sort<select name="sort" defaultValue={sort} className={`mt-1 block ${filterSelect}`}><option value="follow_up">Next follow up</option><option value="updated">Recently updated</option><option value="newest">Newest</option><option value="name">Name</option></select></label>
        {sp.view && <input type="hidden" name="view" value={sp.view} />}
      </FilterBar>
      {sp.view === "contacted" && <p className="mb-4 text-sm text-slate-muted">Showing shippers with completed outbound outreach in the last 30 days.</p>}
      {data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Shippers</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Company</th><th scope="col" className="px-4 py-3">Stage</th><th scope="col" className="px-4 py-3">Industry</th><th scope="col" className="px-4 py-3">Source</th><th scope="col" className="px-4 py-3">Last activity</th><th scope="col" className="px-4 py-3">Next follow up</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-ivory/60">
                  <td className="px-4 py-3"><Link href={`/admin/shippers/${p.id}`} className="font-semibold text-navy hover:text-brand-red-dark hover:underline">{p.company}</Link><span className="block text-xs text-slate-muted">{[p.contact_name, p.location].filter(Boolean).join(" · ")}</span></td>
                  <td className="px-4 py-3"><StatusBadge value={p.status} label={label(prospectStatuses, p.status)} /></td>
                  <td className="px-4 py-3">{label(industryCategories, p.industry_category)}</td>
                  <td className="px-4 py-3">{label(leadSources, p.source)}</td>
                  <td className="px-4 py-3 text-xs text-slate-muted">{last.get(p.id) ? fmtDateTime(last.get(p.id)) : "None logged"}</td>
                  <td className={`px-4 py-3 text-xs ${p.next_follow_up && p.next_follow_up < today ? "font-semibold text-danger" : ""}`}>{p.next_follow_up ? `${fmtDate(p.next_follow_up)}${p.next_follow_up < today ? " (overdue)" : ""}` : "Not scheduled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{Object.keys(filters).length ? "No shippers match these filters. " : "No shippers yet. Add the companies you are researching to start building the pipeline. "}<Link href="/admin/shippers/new" className="font-semibold text-brand-red-dark underline">Add a shipper</Link></EmptyState>
      )}
      <Pager base="/admin/shippers" params={filters} page={page} pageSize={PAGE} total={count ?? 0} />
    </>
  );
}
