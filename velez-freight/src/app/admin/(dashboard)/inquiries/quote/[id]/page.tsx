import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmtDate, fmtDateTime, label, quoteStatuses } from "@/config/admin";
import { shipmentTypes } from "@/config/site";
import { Panel, StatusBadge } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { DetailList, InquiryStatusForm } from "@/components/admin/inquiry-status-form";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";

export const metadata = { title: "Freight inquiry" };

export default async function QuoteInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await s.db.from("quote_inquiries").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const stops = Array.isArray(r.stops) ? (r.stops as string[]) : [];
  return (
    <>
      <PageHeader crumbs={[{ label: "Freight Inquiries", href: "/admin/inquiries" }, { label: r.company_name }]} title={r.company_name} description={`Freight inquiry ${r.reference} received ${fmtDateTime(r.created_at)}`} actions={<StatusBadge value={r.status} label={label(quoteStatuses, r.status)} />} />
      <p className="mb-6 rounded-md border border-line bg-white p-3 text-sm">Pricing is prepared manually. This system does not generate quotes, book loads, or contact carriers automatically.</p>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Route">
            <DetailList rows={[["Pickup", r.pickup_address], ["Requested pickup date", fmtDate(r.pickup_date)], ["Delivery", r.delivery_address], ["Required delivery date", fmtDate(r.delivery_deadline)], ["Additional stops", stops.join("\n")]]} />
          </Panel>
          <Panel title="Freight">
            <DetailList rows={[["Description", r.freight_description], ["Commodity", r.commodity], ["Weight", `${r.weight_lbs.toLocaleString()} lbs`], ["Units", r.piece_count ? `${r.piece_count} ${r.piece_type}` : null], ["Dimensions", r.dimensions], ["Equipment", shipmentTypes.find((x) => x.value === r.equipment)?.label ?? r.equipment], ["Special instructions", r.special_handling], ["Loading and unloading", r.loading_requirements]]} />
          </Panel>
          <Panel title="Contact">
            <DetailList rows={[["Company", r.company_name], ["Contact", r.contact_name], ["Email", <a key="e" className="text-brand-red-dark underline" href={`mailto:${r.email}`}>{r.email}</a>], ["Phone", r.phone], ["Notes", r.notes]]} />
          </Panel>
          <NotesPanel s={s} entityType="quote_inquiry" entityId={r.id} />
        </div>
        <div className="space-y-6">
          <InquiryStatusForm kind="quote" id={r.id} status={r.status} followUp={r.follow_up_date} />
          <TasksPanel s={s} entityType="quote_inquiry" entityId={r.id} />
        </div>
      </div>
    </>
  );
}
