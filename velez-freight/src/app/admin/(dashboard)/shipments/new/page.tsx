import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { createShipment } from "@/app/admin/ops-actions";
import { qualifiedCarriers } from "@/lib/ops";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput } from "@/components/admin/admin-ui";
import { GatedModule, PageHeader } from "@/components/admin/page-header";
import { shipmentTypes } from "@/config/site";

export const metadata = { title: "Book shipment" };

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ quote?: string }> }) {
  const s = await requireStaff();
  const settings = await getSettings();
  const head = <PageHeader title="Book a shipment" crumbs={[{ label: "Shipments", href: "/admin/shipments" }, { label: "Book" }]} description="Record a load the customer has confirmed. A carrier can be assigned now or later; only carriers that pass the qualification rules are listed." />;
  if (!settings.operational) return <>{head}<GatedModule title="Shipments are not available yet" reason="Booking opens after brokerage activation." /></>;
  const { quote: qid } = await searchParams;
  const quote = qid && /^[0-9a-f-]{36}$/.test(qid) ? (await s.db.from("quotes").select("*").eq("id", qid).eq("status", "accepted").maybeSingle()).data : null;
  const [{ data: shippers }, carriers] = await Promise.all([s.db.from("shipper_prospects").select("id, company").neq("status", "lost").order("company").limit(500), qualifiedCarriers(s)]);
  const dt = "datetime-local";
  return (
    <>
      {head}
      <Panel className="max-w-3xl">
        {quote && <p className="mb-4 rounded-md bg-ivory p-3 text-sm">Booking from accepted quote {quote.reference}.</p>}
        <ActionForm action={createShipment} submitLabel="Book shipment">
          {quote && <input type="hidden" name="quote_id" value={quote.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Customer" htmlFor="s-shipper" className="sm:col-span-2"><select id="s-shipper" name="shipper_id" required defaultValue={quote?.shipper_id ?? ""} className={adminInput}><option value="" disabled>Choose a shipper</option>{shippers?.map((x) => <option key={x.id} value={x.id}>{x.company}</option>)}</select></AdminField>
            <AdminField label="Origin city" htmlFor="s-oc"><input id="s-oc" name="origin_city" required defaultValue={quote?.origin_city ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Origin state" htmlFor="s-os"><input id="s-os" name="origin_state" required maxLength={2} defaultValue={quote?.origin_state ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Destination city" htmlFor="s-dc"><input id="s-dc" name="dest_city" required defaultValue={quote?.dest_city ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Destination state" htmlFor="s-ds"><input id="s-ds" name="dest_state" required maxLength={2} defaultValue={quote?.dest_state ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Freight type" htmlFor="s-ft"><select id="s-ft" name="freight_type" defaultValue={quote?.freight_type ?? "general"} className={adminInput}><option value="general">General</option><option value="expedited">Expedited</option><option value="dedicated">Dedicated</option></select></AdminField>
            <AdminField label="Equipment" htmlFor="s-eq"><select id="s-eq" name="equipment" defaultValue={quote?.equipment ?? "dry_van"} className={adminInput}>{shipmentTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></AdminField>
            <AdminField label="Commodity" htmlFor="s-com" className="sm:col-span-2"><input id="s-com" name="commodity" maxLength={200} className={adminInput} /></AdminField>
            <AdminField label="Pickup window start" htmlFor="s-pws"><input id="s-pws" name="pickup_window_start" type={dt} className={adminInput} /></AdminField>
            <AdminField label="Pickup window end" htmlFor="s-pwe"><input id="s-pwe" name="pickup_window_end" type={dt} className={adminInput} /></AdminField>
            <AdminField label="Delivery window start" htmlFor="s-dws"><input id="s-dws" name="delivery_window_start" type={dt} className={adminInput} /></AdminField>
            <AdminField label="Delivery window end" htmlFor="s-dwe"><input id="s-dwe" name="delivery_window_end" type={dt} className={adminInput} /></AdminField>
            <AdminField label="Customer rate (USD)" htmlFor="s-rate"><input id="s-rate" name="customer_rate" required inputMode="decimal" defaultValue={quote?.customer_rate ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Carrier cost (USD, if agreed)" htmlFor="s-cost"><input id="s-cost" name="carrier_cost" inputMode="decimal" className={adminInput} /></AdminField>
            <AdminField label="Carrier (qualified only)" htmlFor="s-car" className="sm:col-span-2"><select id="s-car" name="carrier_id" defaultValue="" className={adminInput}><option value="">Assign later</option>{carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></AdminField>
          </div>
          <p className="text-xs text-slate-muted">Appointment windows are in Eastern time. They are needed to measure on time performance; without them performance is reported as unknown.</p>
        </ActionForm>
      </Panel>
    </>
  );
}
