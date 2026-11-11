import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/config/admin";
import { fmtMoney } from "@/lib/money";
import { moveQuote } from "@/app/admin/ops-actions";
import { ActionForm } from "@/components/admin/action-form";
import { Panel, StatusBadge } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { DetailList } from "@/components/admin/inquiry-status-form";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";
import { Confirm, MarginLine, lane } from "@/components/admin/ops-ui";

export const metadata = { title: "Quote" };

function Move({ id, to, label, variant = "navy", children }: { id: string; to: string; label: string; variant?: "navy" | "primary" | "outline"; children?: React.ReactNode }) {
  return <ActionForm action={moveQuote} submitLabel={label} variant={variant} className="space-y-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />{children}</ActionForm>;
}

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: q } = await s.db.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!q) notFound();
  const [{ data: shipper }, { data: shipments }] = await Promise.all([
    s.db.from("shipper_prospects").select("id, company").eq("id", q.shipper_id).single(),
    s.db.from("shipments").select("id, reference").eq("quote_id", id),
  ]);
  const admin = isAdminRole(s.role);
  return (
    <>
      <PageHeader title={`Quote ${q.reference}`} crumbs={[{ label: "Quotes", href: "/admin/quotes" }, { label: q.reference }]} description={`${shipper?.company ?? ""} · ${lane(q)}`} actions={<StatusBadge value={q.status} label={q.status.replace("_", " ")} />} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Quote details">
            <DetailList rows={[["Customer", <Link key="c" href={`/admin/shippers/${q.shipper_id}`} className="underline">{shipper?.company}</Link>], ["Lane", lane(q)], ["Freight type", q.freight_type], ["Equipment", q.equipment], ["Pickup date", fmtDate(q.pickup_date)], ["Valid until", fmtDate(q.valid_until)],
              ["Customer rate", fmtMoney(q.customer_rate)], ["Estimated carrier cost", fmtMoney(q.estimated_carrier_cost)], ["Estimated margin", <MarginLine key="m" rate={q.customer_rate} cost={q.estimated_carrier_cost} />],
              ["Approved", q.approved_at ? fmtDateTime(q.approved_at) : null], ["Recorded as sent", q.sent_at ? fmtDateTime(q.sent_at) : null], ["Decision recorded", q.decided_at ? fmtDateTime(q.decided_at) : null], ["Notes", q.notes]]} />
            {q.quote_inquiry_id && <Link href={`/admin/inquiries/quote/${q.quote_inquiry_id}`} className="mt-4 inline-block text-sm font-semibold text-brand-red-dark underline">Open the original freight inquiry</Link>}
          </Panel>
          <NotesPanel s={s} entityType="quote" entityId={id} />
        </div>
        <div className="space-y-6">
          <Panel title="Next step">
            <div className="space-y-4">
              {q.status === "draft" && <Move id={id} to="pending_approval" label="Submit for approval" variant="primary" />}
              {q.status === "pending_approval" && (admin ? <Move id={id} to="approved" label="Approve quote" variant="primary" /> : <p className="text-sm">Waiting for an owner or admin to approve.</p>)}
              {["pending_approval", "approved"].includes(q.status) && <Move id={id} to="draft" label="Return to draft" variant="outline" />}
              {q.status === "approved" && <Move id={id} to="sent" label="Record as sent" variant="primary"><Confirm>I sent this quote to the customer myself, outside this system.</Confirm></Move>}
              {q.status === "sent" && <div className="flex flex-wrap gap-2"><Move id={id} to="accepted" label="Customer accepted" variant="primary" /><Move id={id} to="declined" label="Customer declined" variant="outline" /><Move id={id} to="expired" label="Expired" variant="outline" /></div>}
              {q.status === "accepted" && (shipments?.length ? <p className="text-sm">Shipment {shipments.map((x) => <Link key={x.id} href={`/admin/shipments/${x.id}`} className="font-semibold underline">{x.reference}</Link>)} was booked from this quote.</p> : <Link href={`/admin/shipments/new?quote=${id}`} className="inline-block rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white">Book shipment from this quote</Link>)}
              {["draft", "pending_approval", "approved", "sent"].includes(q.status) && <details><summary className="cursor-pointer text-sm font-semibold text-danger">Cancel quote</summary><div className="mt-2"><Move id={id} to="cancelled" label="Yes, cancel this quote" variant="outline" /></div></details>}
            </div>
          </Panel>
          <TasksPanel s={s} entityType="quote" entityId={id} />
        </div>
      </div>
    </>
  );
}
