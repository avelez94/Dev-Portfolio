import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { contactStatuses, fmtDate, fmtDateTime, inquiryTypeLabels, label } from "@/config/admin";
import { shipmentTypes } from "@/config/site";
import { PageTitle, Panel, StatusBadge } from "@/components/admin/admin-ui";
import { DetailList, InquiryStatusForm } from "@/components/admin/inquiry-status-form";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";
import { ActionForm } from "@/components/admin/action-form";
import { convertToProspect } from "@/app/admin/actions";

export const metadata = { title: "Inquiry" };

export default async function ContactInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await s.db.from("contact_inquiries").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: prospect } = await s.db.from("shipper_prospects").select("id").eq("source_inquiry_id", id).maybeSingle();
  return (
    <>
      <Link href="/admin/inquiries" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark"><ArrowLeft aria-hidden="true" className="size-4" /> All inquiries</Link>
      <PageTitle title={r.company || r.name} description={`${inquiryTypeLabels[r.inquiry_type]} inquiry ${r.reference} received ${fmtDateTime(r.created_at)}`} actions={<StatusBadge value={r.status} label={label(contactStatuses, r.status)} />} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Submission">
            <DetailList rows={[
              ["Name", r.name], ["Company", r.company], ["Email", <a key="e" className="text-brand-red-dark underline" href={`mailto:${r.email}`}>{r.email}</a>], ["Phone", r.phone],
              ["Typical freight", shipmentTypes.find((x) => x.value === r.shipment_type)?.label], ["Source page", r.source_page], ["Resolved", fmtDate(r.resolved_at)],
              ["Message", r.message],
            ]} />
            {r.carrier_lead_id && <Link href={`/admin/carriers/${r.carrier_lead_id}`} className="mt-4 inline-block text-sm font-semibold text-brand-red-dark underline">Open carrier lead</Link>}
          </Panel>
          <NotesPanel s={s} entityType="contact_inquiry" entityId={r.id} />
        </div>
        <div className="space-y-6">
          <InquiryStatusForm kind="contact" id={r.id} status={r.status} followUp={r.follow_up_date} />
          {(r.inquiry_type === "shipper" || r.inquiry_type === "general" || r.inquiry_type === "launch_notification") && (
            <Panel title="Shipper CRM">
              {prospect ? (
                <Link href={`/admin/shippers/${prospect.id}`} className="text-sm font-semibold text-brand-red-dark underline">Open linked shipper prospect</Link>
              ) : (
                <ActionForm action={convertToProspect} submitLabel="Create shipper prospect" variant="navy">
                  <input type="hidden" name="id" value={r.id} />
                  <p className="text-sm text-charcoal">Adds this contact to the Shipper CRM with status Responded and a link back to this inquiry.</p>
                </ActionForm>
              )}
            </Panel>
          )}
          <TasksPanel s={s} entityType="contact_inquiry" entityId={r.id} />
        </div>
      </div>
    </>
  );
}
