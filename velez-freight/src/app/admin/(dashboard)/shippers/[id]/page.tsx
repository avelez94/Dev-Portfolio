import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { fmtDateTime, label, prospectStatuses } from "@/config/admin";
import { PageTitle, Panel, StatusBadge } from "@/components/admin/admin-ui";
import { ProspectForm } from "@/components/admin/record-forms";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";
import { deleteRecord } from "@/app/admin/actions";

export const metadata = { title: "Shipper prospect" };

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: p } = await s.db.from("shipper_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  return (
    <>
      <Link href="/admin/shippers" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark"><ArrowLeft aria-hidden="true" className="size-4" /> Shipper CRM</Link>
      <PageTitle title={p.company} description={`Source: ${p.source}. Updated ${fmtDateTime(p.updated_at)}`} actions={<StatusBadge value={p.status} label={label(prospectStatuses, p.status)} />} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Details"><ProspectForm p={p} /></Panel>
          {p.source_inquiry_id && <Link href={`/admin/inquiries/contact/${p.source_inquiry_id}`} className="text-sm font-semibold text-brand-red-dark underline">Open original website inquiry</Link>}
          {isAdminRole(s.role) && (
            <form action={deleteRecord}>
              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="table" value="shipper_prospects" />
              <button className="text-sm font-semibold text-brand-red-dark hover:underline">Delete this prospect</button>
            </form>
          )}
        </div>
        <div className="space-y-6">
          <TasksPanel s={s} entityType="shipper_prospect" entityId={p.id} />
          <NotesPanel s={s} entityType="shipper_prospect" entityId={p.id} />
        </div>
      </div>
    </>
  );
}
