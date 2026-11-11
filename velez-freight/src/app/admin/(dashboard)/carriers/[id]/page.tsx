import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { contactStatuses, fmtDateTime, label, verificationStatuses } from "@/config/admin";
import { EmptyState, PageTitle, Panel, StatusBadge } from "@/components/admin/admin-ui";
import { CarrierLeadForm } from "@/components/admin/record-forms";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";
import { deleteRecord } from "@/app/admin/actions";

export const metadata = { title: "Carrier lead" };

export default async function CarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: c } = await s.db.from("carrier_leads").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const { data: history } = await s.db.from("contact_inquiries").select("id, reference, status, created_at, message").eq("carrier_lead_id", id).order("created_at", { ascending: false });
  return (
    <>
      <Link href="/admin/carriers" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark"><ArrowLeft aria-hidden="true" className="size-4" /> Carrier Leads</Link>
      <PageTitle title={c.company_name} description={`Source: ${c.source}. Added ${fmtDateTime(c.created_at)}`} actions={<StatusBadge value={c.verification_status} label={label(verificationStatuses, c.verification_status)} />} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Details"><CarrierLeadForm c={c} /></Panel>
          {c.usdot_number && (
            <a href={`https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.usdot_number}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red-dark underline">
              Look up USDOT {c.usdot_number} on FMCSA SAFER <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          )}
          {isAdminRole(s.role) && (
            <form action={deleteRecord}>
              <input type="hidden" name="id" value={c.id} /><input type="hidden" name="table" value="carrier_leads" />
              <button className="text-sm font-semibold text-brand-red-dark hover:underline">Delete this carrier lead</button>
            </form>
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Inquiry history">
            {history?.length ? (
              <ul className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="rounded-lg bg-ivory p-3 text-sm">
                    <div className="flex items-center justify-between gap-2"><Link href={`/admin/inquiries/contact/${h.id}`} className="font-mono text-xs font-semibold text-brand-red-dark underline">{h.reference}</Link><StatusBadge value={h.status} label={label(contactStatuses, h.status)} /></div>
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-charcoal">{h.message}</p>
                    <p className="mt-1 text-xs text-slate-muted">{fmtDateTime(h.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No website inquiries linked to this carrier.</EmptyState>
            )}
          </Panel>
          <TasksPanel s={s} entityType="carrier_lead" entityId={c.id} />
          <NotesPanel s={s} entityType="carrier_lead" entityId={c.id} />
        </div>
      </div>
    </>
  );
}
