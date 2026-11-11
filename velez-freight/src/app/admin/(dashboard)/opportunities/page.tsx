import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { prospectStatuses, fmtDate } from "@/config/admin";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

export const metadata = { title: "Opportunities" };

type Prospect = { id: string; company: string; contact_name: string | null; status: string; next_follow_up: string | null; updated_at: string; industry_category: string };

/** Pipeline view of shipper relationships by stage. Stages change on each shipper profile. */
export default async function OpportunitiesPage() {
  const s = await requireStaff();
  const [{ data: prospects }, { data: acts }, { data: mail }] = await Promise.all([
    s.db.from("shipper_prospects").select("id, company, contact_name, status, next_follow_up, updated_at, industry_category").order("updated_at", { ascending: false }).limit(1000),
    s.db.from("crm_activities").select("shipper_id, occurred_at").not("shipper_id", "is", null).order("occurred_at", { ascending: false }).limit(5000),
    s.db.from("outreach_messages").select("shipper_id, status").not("shipper_id", "is", null).in("status", ["draft", "pending_approval", "approved"]),
  ]);
  const last = new Map<string, string>();
  for (const a of acts ?? []) if (a.shipper_id && !last.has(a.shipper_id)) last.set(a.shipper_id, a.occurred_at);
  const drafts = new Set((mail ?? []).map((m) => m.shipper_id));
  const today = new Date().toISOString().slice(0, 10);
  const stale = (p: Prospect) => {
    const l = last.get(p.id);
    if (!l) return p.status !== "researching";
    return Date.parse(today) - Date.parse(l) > 14 * 86_400_000;
  };
  const rows = (prospects ?? []) as Prospect[];
  const stages = prospectStatuses.filter((st) => st.value !== "lost");
  const lost = rows.filter((p) => p.status === "lost").length;

  return (
    <>
      <PageHeader title="Opportunities" crumbs={[{ label: "Opportunities" }]} description="Every shipper relationship by stage, with follow ups, recent contact and emails in progress. Open a shipper to move it to another stage."
        actions={<Link href="/admin/shippers/new" className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark">Add shipper</Link>} />
      <p className="mb-4 text-sm text-slate-muted">{rows.length - lost} open {rows.length - lost === 1 ? "relationship" : "relationships"}{lost ? `, ${lost} marked lost or not interested` : ""}. No revenue is estimated here; figures come only from real quotes and invoices.</p>
      <div className="-mx-1 overflow-x-auto pb-4">
        <ol className="flex min-w-max gap-4 px-1">
          {stages.map((st) => {
            const items = rows.filter((p) => p.status === st.value);
            return (
              <li key={st.value} className="w-72 shrink-0 rounded-lg border border-line bg-white">
                <h2 className="flex items-center justify-between border-b border-line px-3 py-2.5 font-sans text-sm font-bold text-navy">{st.label} <span className="rounded-full bg-ivory px-2 text-xs">{items.length}</span></h2>
                <ul className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                  {items.map((p) => {
                    const due = p.next_follow_up && p.next_follow_up <= today;
                    return (
                      <li key={p.id}>
                        <Link href={`/admin/shippers/${p.id}`} className="block rounded-md border border-line p-2.5 text-sm hover:border-navy">
                          <span className="block font-semibold text-navy">{p.company}</span>
                          {p.contact_name && <span className="block text-xs text-slate-muted">{p.contact_name}</span>}
                          <span className="mt-1.5 flex flex-wrap gap-1.5 text-[0.7rem]">
                            {p.next_follow_up && <span className={cn("rounded-full px-2 py-0.5", due ? "bg-danger-soft text-danger" : "bg-ivory")}>Follow up {fmtDate(p.next_follow_up)}</span>}
                            {last.get(p.id) ? <span className="rounded-full bg-ivory px-2 py-0.5">Last contact {fmtDate(last.get(p.id)!)}</span> : <span className="rounded-full bg-ivory px-2 py-0.5">No contact yet</span>}
                            {stale(p) && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">Quiet 14+ days</span>}
                            {drafts.has(p.id) && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-navy">Email in progress</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {!items.length && <li className="px-1 py-2 text-xs text-slate-muted">None</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
