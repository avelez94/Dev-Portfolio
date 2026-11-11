import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/config/admin";
import { fmtMoney } from "@/lib/money";
import { qualifiedCarriers } from "@/lib/ops";
import { assignCarrier, createInvoice, openException, recordShipmentEvent, resolveException, setShipmentStatus } from "@/app/admin/ops-actions";
import { DocumentsPanel } from "@/components/admin/documents-panel";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, StatusBadge, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { DetailList } from "@/components/admin/inquiry-status-form";
import { NotesPanel, TasksPanel } from "@/components/admin/panels";
import { Timeline } from "@/components/admin/crm-panels";
import { Confirm, MarginLine, lane } from "@/components/admin/ops-ui";
import { nowLocalInput } from "@/components/admin/crm-panels";

export const metadata = { title: "Shipment" };

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: x } = await s.db.from("shipments").select("*").eq("id", id).maybeSingle();
  if (!x) notFound();
  const admin = isAdminRole(s.role);
  const [{ data: shipper }, { data: carrier }, { data: events }, { data: exc }, { data: docs }, carriers, { data: inv }] = await Promise.all([
    s.db.from("shipper_prospects").select("id, company").eq("id", x.shipper_id).single(),
    x.carrier_id ? s.db.from("carrier_leads").select("id, company_name").eq("id", x.carrier_id).single() : Promise.resolve({ data: null }),
    s.db.from("shipment_events").select("*").eq("shipment_id", id).order("occurred_at", { ascending: false }),
    s.db.from("shipment_exceptions").select("*").eq("shipment_id", id).order("opened_at", { ascending: false }),
    s.db.from("documents").select("*").eq("entity_type", "shipment").eq("entity_id", id).order("received_at", { ascending: false }),
    qualifiedCarriers(s),
    admin ? s.db.from("invoices").select("id, number, status").eq("shipment_id", id).neq("status", "void") : Promise.resolve({ data: null }),
  ]);
  const open = (exc ?? []).filter((e) => !e.resolved_at);
  const ver = (v: boolean) => (v ? " (verified)" : " (not verified)");
  return (
    <>
      <PageHeader title={`Shipment ${x.reference}`} crumbs={[{ label: "Shipments", href: "/admin/shipments" }, { label: x.reference }]} description={`${shipper?.company ?? ""} · ${lane(x)} · ${x.freight_type} · ${x.equipment}`} actions={<StatusBadge value={x.status} label={x.status.replace("_", " ")} />} />
      {open.length > 0 && <p role="alert" className="mb-6 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm font-semibold text-danger">{open.length} open exception{open.length === 1 ? "" : "s"}. Update the customer and record the resolution below.</p>}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Load facts">
            <DetailList rows={[["Customer", <Link key="s" href={`/admin/shippers/${x.shipper_id}`} className="underline">{shipper?.company}</Link>], ["Carrier", carrier ? <Link key="c" href={`/admin/carriers/${carrier.id}`} className="underline">{carrier.company_name}</Link> : "Not assigned"],
              ["Pickup window", x.pickup_window_start ? `${fmtDateTime(x.pickup_window_start)} to ${fmtDateTime(x.pickup_window_end)}` : "Not set"], ["Actual pickup", x.actual_pickup_at ? fmtDateTime(x.actual_pickup_at) + ver(x.pickup_verified) : "Not recorded"],
              ["Delivery window", x.delivery_window_start ? `${fmtDateTime(x.delivery_window_start)} to ${fmtDateTime(x.delivery_window_end)}` : "Not set"], ["Actual delivery", x.actual_delivery_at ? fmtDateTime(x.actual_delivery_at) + ver(x.delivery_verified) : "Not recorded"],
              ["Customer rate", fmtMoney(x.customer_rate)], ["Carrier cost", x.carrier_cost === null ? "Not recorded" : fmtMoney(x.carrier_cost)], ["Gross margin", <MarginLine key="m" rate={x.customer_rate} cost={x.carrier_cost} />], ["Commodity", x.commodity]]} />
          </Panel>
          {!["cancelled", "completed"].includes(x.status) && (
            <Panel title="Record an event">
              <ActionForm action={recordShipmentEvent} submitLabel="Record event" variant="navy" resetOnSuccess>
                <input type="hidden" name="shipment_id" value={id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminField label="Event" htmlFor="e-type"><select id="e-type" name="event_type" className={adminInput}><option value="dispatched">Dispatched</option><option value="arrived_pickup">Arrived at pickup</option><option value="picked_up">Picked up</option><option value="check_call">Check call</option><option value="arrived_delivery">Arrived at delivery</option><option value="delivered">Delivered</option><option value="note">Note</option></select></AdminField>
                  <AdminField label="When (Eastern)" htmlFor="e-at"><input id="e-at" name="occurred_at" type="datetime-local" defaultValue={nowLocalInput()} className={adminInput} /></AdminField>
                  <AdminField label="Source" htmlFor="e-src"><input id="e-src" name="source" required placeholder="Driver call, ELD, customer email" className={adminInput} /></AdminField>
                  <AdminField label="Notes" htmlFor="e-notes" className="sm:col-span-3"><input id="e-notes" name="notes" maxLength={1000} className={adminInput} /></AdminField>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" className="size-4 accent-brand-red" /> Verified time (confirmed by tracking, signed BOL or POD, or the facility)</label>
              </ActionForm>
            </Panel>
          )}
          <Timeline events={[
            ...(events ?? []).map((e) => ({ at: e.occurred_at, kind: "shipment" as const, title: `${e.event_type.replace("_", " ")}${e.verified ? " (verified)" : ""}`, detail: [e.source, e.notes].filter(Boolean).join(": ") })),
            ...(exc ?? []).flatMap((e) => [{ at: e.opened_at, kind: "exception" as const, title: `Exception: ${e.exception_type.replace("_", " ")}`, detail: e.description }, ...(e.resolved_at ? [{ at: e.resolved_at, kind: "exception" as const, title: "Exception resolved", detail: e.resolution }] : [])]),
            ...(docs ?? []).map((d) => ({ at: d.received_at, kind: "document" as const, title: `Document recorded: ${d.doc_type.replace("_", " ")}`, detail: d.reference })),
          ]} />
        </div>
        <div className="space-y-6">
          {!["cancelled", "completed"].includes(x.status) && (
            <Panel title="Carrier assignment">
              <ActionForm action={assignCarrier} submitLabel={x.carrier_id ? "Change carrier" : "Assign carrier"} variant="navy">
                <input type="hidden" name="id" value={id} />
                <AdminField label="Qualified carriers" htmlFor="a-car"><select id="a-car" name="carrier_id" required defaultValue={x.carrier_id ?? ""} className={adminInput}><option value="" disabled>Choose a carrier</option>{carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></AdminField>
                <AdminField label="Agreed carrier cost (USD)" htmlFor="a-cost"><input id="a-cost" name="carrier_cost" inputMode="decimal" defaultValue={x.carrier_cost ?? ""} className={adminInput} /></AdminField>
                {!carriers.length && <p className="text-xs text-warning">No carrier currently passes the qualification rules. Verify a carrier first.</p>}
              </ActionForm>
            </Panel>
          )}
          <Panel title="Exceptions">
            {open.map((e) => (
              <ActionForm key={e.id} action={resolveException} submitLabel="Resolve" variant="navy" className="mb-4 rounded-lg border border-danger/30 p-3">
                <p className="text-sm font-semibold text-danger">{e.exception_type.replace("_", " ")}: {e.description}</p>
                <input type="hidden" name="id" value={e.id} /><input type="hidden" name="shipment_id" value={id} />
                <AdminField label="Resolution" htmlFor={`r-${e.id}`}><textarea id={`r-${e.id}`} name="resolution" required className={adminTextarea} /></AdminField>
              </ActionForm>
            ))}
            {!["cancelled"].includes(x.status) && (
              <details><summary className="cursor-pointer text-sm font-semibold text-navy">Report an exception</summary>
                <ActionForm action={openException} submitLabel="Record exception" variant="primary" resetOnSuccess className="mt-3">
                  <input type="hidden" name="shipment_id" value={id} />
                  <AdminField label="Type" htmlFor="x-type"><select id="x-type" name="exception_type" className={adminInput}><option value="pickup_delay">Pickup delay</option><option value="delivery_delay">Delivery delay</option><option value="damage">Damage</option><option value="shortage">Shortage</option><option value="refused">Refused</option><option value="documentation">Documentation</option><option value="equipment">Equipment</option><option value="other">Other</option></select></AdminField>
                  <AdminField label="What happened" htmlFor="x-desc"><textarea id="x-desc" name="description" required className={adminTextarea} /></AdminField>
                </ActionForm>
              </details>
            )}
          </Panel>
          <DocumentsPanel entityType="shipment" entityId={id} docs={docs ?? []} docTypes={["pod", "bol", "rate_confirmation", "other"]} admin={admin} idPrefix="sd" />
          {admin && ["delivered", "completed"].includes(x.status) && (
            <Panel title="Billing">
              {inv?.length ? <p className="text-sm">Invoice <Link href={`/admin/invoices/${inv[0].id}`} className="font-semibold underline">{inv[0].number}</Link> ({inv[0].status}).</p> : (
                <ActionForm action={createInvoice} submitLabel="Create draft invoice" variant="navy">
                  <input type="hidden" name="shipment_id" value={id} />
                  <AdminField label="Amount (USD)" htmlFor="i-amt"><input id="i-amt" name="amount" required inputMode="decimal" defaultValue={x.customer_rate} className={adminInput} /></AdminField>
                </ActionForm>
              )}
              <Link href={`/admin/payables?shipment=${id}`} className="mt-3 inline-block text-xs font-semibold text-brand-red-dark underline">Record the carrier bill</Link>
            </Panel>
          )}
          {x.status === "delivered" && <Panel title="Complete"><ActionForm action={setShipmentStatus} submitLabel="Mark completed" variant="navy"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value="completed" /><p className="text-sm">Use after documents are in and the load is closed out.</p></ActionForm></Panel>}
          {["booked", "dispatched", "in_transit"].includes(x.status) && (
            <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-danger">Cancel shipment</summary>
              <ActionForm action={setShipmentStatus} submitLabel="Cancel shipment" variant="outline" className="mt-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value="cancelled" /><Confirm>I confirm this load is cancelled. It will be excluded from revenue.</Confirm></ActionForm>
            </details>
          )}
          <TasksPanel s={s} entityType="shipment" entityId={id} />
          <NotesPanel s={s} entityType="shipment" entityId={id} />
        </div>
      </div>
    </>
  );
}
