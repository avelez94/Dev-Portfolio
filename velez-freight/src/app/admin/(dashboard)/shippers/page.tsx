import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { fmtDate, label, prospectStatuses } from "@/config/admin";
import { EmptyState, FilterLinks, PageTitle, StatusBadge } from "@/components/admin/admin-ui";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Shipper CRM" };

export default async function ShippersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await requireStaff();
  const { status: raw } = await searchParams;
  const status = prospectStatuses.some((p) => p.value === raw) ? raw : undefined;
  let q = s.db.from("shipper_prospects").select("id, company, contact_name, industry, location, status, next_follow_up, updated_at").order("next_follow_up", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageTitle title="Shipper CRM" description="Prospects and customers through the pipeline." actions={<Link href="/admin/shippers/new" className={buttonVariants({ size: "sm" })}><Plus aria-hidden="true" /> New prospect</Link>} />
      <div className="mb-6"><FilterLinks base="/admin/shippers" param="status" current={status} options={[...prospectStatuses]} /></div>
      {data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Shipper prospects</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Company</th><th scope="col" className="px-4 py-3">Industry</th><th scope="col" className="px-4 py-3">Location</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Next follow up</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-ivory/60">
                  <td className="px-4 py-3"><Link href={`/admin/shippers/${p.id}`} className="font-semibold text-navy hover:text-brand-red-dark hover:underline">{p.company}</Link>{p.contact_name && <span className="block text-xs text-slate-muted">{p.contact_name}</span>}</td>
                  <td className="px-4 py-3">{p.industry}</td>
                  <td className="px-4 py-3">{p.location}</td>
                  <td className="px-4 py-3"><StatusBadge value={p.status} label={label(prospectStatuses, p.status)} /></td>
                  <td className={`px-4 py-3 text-xs ${p.next_follow_up && p.next_follow_up < today ? "font-semibold text-brand-red-dark" : ""}`}>{fmtDate(p.next_follow_up)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No prospects{status ? " with this status" : " yet"}. Add companies you are researching to start building the pipeline.</EmptyState>
      )}
    </>
  );
}
