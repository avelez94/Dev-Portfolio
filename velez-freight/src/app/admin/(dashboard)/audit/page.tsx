import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/config/admin";
import { EmptyState } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { linkFor } from "@/components/admin/panels";

export const metadata = { title: "Audit Log" };

export default async function ActivityPage() {
  const s = await requireAdmin();
  const { data } = await s.db.from("audit_events").select("*").order("created_at", { ascending: false }).limit(300);
  const { data: people } = await s.db.from("profiles").select("id, full_name, email");
  const who = (id: string | null) => (id ? people?.find((p) => p.id === id)?.full_name || people?.find((p) => p.id === id)?.email || "Unknown user" : "");
  return (
    <>
      <PageHeader title="Audit Log" crumbs={[{ label: "Audit Log" }]} description="Append only record of sign ins, submissions, exports and changes. Entries cannot be edited or deleted, even by owners." />
      {data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit events</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">When</th><th scope="col" className="px-4 py-3">Action</th><th scope="col" className="px-4 py-3">Actor</th><th scope="col" className="px-4 py-3">Record</th><th scope="col" className="px-4 py-3">Details</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-muted">{fmtDateTime(a.created_at)}</td>
                  <td className="px-4 py-2.5 font-medium text-navy">{a.action}</td>
                  <td className="px-4 py-2.5 text-xs">{a.actor_type}{a.actor_id ? `: ${who(a.actor_id)}` : ""}</td>
                  <td className="px-4 py-2.5 text-xs">{a.entity_type && a.entity_id && ["shipper_prospect", "carrier_lead", "contact_inquiry", "quote_inquiry"].includes(a.entity_type) ? <a className="text-brand-red-dark underline" href={linkFor(a.entity_type, a.entity_id)}>{a.entity_type}</a> : a.entity_type}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-slate-muted">{Object.keys(a.metadata ?? {}).length ? JSON.stringify(a.metadata) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No activity recorded yet.</EmptyState>
      )}
    </>
  );
}
