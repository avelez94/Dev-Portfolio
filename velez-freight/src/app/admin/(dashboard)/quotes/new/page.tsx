import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { createQuote } from "@/app/admin/ops-actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { GatedModule, PageHeader } from "@/components/admin/page-header";
import { shipmentTypes } from "@/config/site";

export const metadata = { title: "New quote" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ inquiry?: string; shipper?: string }> }) {
  const s = await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  const head = <PageHeader title="New quote" crumbs={[{ label: "Quotes", href: "/admin/quotes" }, { label: "New" }]} description="Draft a price for review. It goes to an owner or admin for approval before it can be recorded as sent." />;
  if (!settings.operational) return <>{head}<GatedModule title="Quotes are not available yet" reason="Quoting opens after brokerage activation." /></>;
  const inquiry = sp.inquiry && /^[0-9a-f-]{36}$/.test(sp.inquiry) ? (await s.db.from("quote_inquiries").select("*").eq("id", sp.inquiry).maybeSingle()).data : null;
  const { data: shippers } = await s.db.from("shipper_prospects").select("id, company").neq("status", "lost").order("company").limit(500);
  const split = (a?: string | null) => { const m = (a ?? "").match(/^(.*?),\s*([A-Za-z]{2})\b/); return m ? [m[1], m[2].toUpperCase()] : [a ?? "", ""]; };
  const [oc, os] = split(inquiry?.pickup_address);
  const [dc, ds] = split(inquiry?.delivery_address);
  return (
    <>
      {head}
      <Panel className="max-w-3xl">
        {inquiry && <p className="mb-4 rounded-md bg-ivory p-3 text-sm">Started from freight inquiry {inquiry.reference} ({inquiry.company_name}). Confirm the details with the customer before pricing.</p>}
        <ActionForm action={createQuote} submitLabel="Save draft quote">
          {inquiry && <input type="hidden" name="quote_inquiry_id" value={inquiry.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Customer" htmlFor="q-shipper" className="sm:col-span-2"><select id="q-shipper" name="shipper_id" required defaultValue={sp.shipper ?? ""} className={adminInput}><option value="" disabled>Choose a shipper</option>{shippers?.map((x) => <option key={x.id} value={x.id}>{x.company}</option>)}</select></AdminField>
            <AdminField label="Origin city" htmlFor="q-oc"><input id="q-oc" name="origin_city" required defaultValue={oc} className={adminInput} /></AdminField>
            <AdminField label="Origin state" htmlFor="q-os"><input id="q-os" name="origin_state" required maxLength={2} defaultValue={os} className={adminInput} /></AdminField>
            <AdminField label="Destination city" htmlFor="q-dc"><input id="q-dc" name="dest_city" required defaultValue={dc} className={adminInput} /></AdminField>
            <AdminField label="Destination state" htmlFor="q-ds"><input id="q-ds" name="dest_state" required maxLength={2} defaultValue={ds} className={adminInput} /></AdminField>
            <AdminField label="Freight type" htmlFor="q-ft"><select id="q-ft" name="freight_type" defaultValue={inquiry?.equipment === "expedited" ? "expedited" : "general"} className={adminInput}><option value="general">General</option><option value="expedited">Expedited</option><option value="dedicated">Dedicated</option></select></AdminField>
            <AdminField label="Equipment" htmlFor="q-eq"><select id="q-eq" name="equipment" defaultValue={inquiry?.equipment ?? "dry_van"} className={adminInput}>{shipmentTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></AdminField>
            <AdminField label="Pickup date" htmlFor="q-pd"><input id="q-pd" name="pickup_date" type="date" defaultValue={inquiry?.pickup_date ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Valid until" htmlFor="q-vu"><input id="q-vu" name="valid_until" type="date" className={adminInput} /></AdminField>
            <AdminField label="Customer rate (USD)" htmlFor="q-rate"><input id="q-rate" name="customer_rate" required inputMode="decimal" className={adminInput} /></AdminField>
            <AdminField label="Estimated carrier cost (USD)" htmlFor="q-cost"><input id="q-cost" name="estimated_carrier_cost" required inputMode="decimal" className={adminInput} /></AdminField>
            <AdminField label="Notes" htmlFor="q-notes" className="sm:col-span-2"><textarea id="q-notes" name="notes" maxLength={2000} className={adminTextarea} /></AdminField>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
