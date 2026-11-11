import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { fmtDate } from "@/config/admin";
import { fmtMoney, toCents } from "@/lib/money";
import { addDays, businessToday, daysBetween } from "@/lib/metrics/period";
import { approveBill, createBill, recordCarrierPayment } from "@/app/admin/ops-actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, EmptyState, Panel, StatusBadge, adminInput } from "@/components/admin/admin-ui";
import { GatedModule, PageHeader } from "@/components/admin/page-header";
import { Confirm } from "@/components/admin/ops-ui";

export const metadata = { title: "Carrier Payables" };

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ shipment?: string; carrier?: string; show?: string }> }) {
  const s = await requireAdmin();
  const settings = await getSettings();
  const sp = await searchParams;
  const header = <PageHeader title="Carrier Payables" crumbs={[{ label: "Carrier Payables" }]} description="Bills from carriers and the payments you made. Only a payment method and reference are recorded; bank account details are never stored here." />;
  if (!settings.operational) return <>{header}<GatedModule title="Carrier payables are not available yet" reason="Carrier bills come from completed shipments, which exist only after brokerage activation." /></>;
  const today = businessToday();
  const shipmentId = sp.shipment && /^[0-9a-f-]{36}$/.test(sp.shipment) ? sp.shipment : undefined;
  const pre = shipmentId ? (await s.db.from("shipments").select("id, reference, carrier_id, carrier_cost").eq("id", shipmentId).maybeSingle()).data : null;
  let q = s.db.from("carrier_bills").select("*").neq("status", "void").order("due_on").limit(500);
  if (sp.carrier && /^[0-9a-f-]{36}$/.test(sp.carrier)) q = q.eq("carrier_id", sp.carrier);
  const [{ data: bills }, { data: carriers }] = await Promise.all([q, s.db.from("carrier_leads").select("id, company_name").order("company_name").limit(500)]);
  const ids = (bills ?? []).map((b) => b.id as string);
  const { data: pays } = ids.length ? await s.db.from("carrier_payments").select("bill_id, amount").in("bill_id", ids) : { data: [] };
  const nm = new Map((carriers ?? []).map((c) => [c.id as string, c.company_name as string]));
  const rows = (bills ?? []).map((b) => ({ ...b, bal: (toCents(b.amount) ?? 0) - (pays ?? []).filter((p) => p.bill_id === b.id).reduce((a, p) => a + (toCents(p.amount) ?? 0), 0) })).filter((b) => sp.show === "all" || b.bal > 0);
  return (
    <>
      {header}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          <p className="mb-3 text-sm"><Link href={sp.show === "all" ? "/admin/payables" : "/admin/payables?show=all"} className="font-semibold text-brand-red-dark underline">{sp.show === "all" ? "Show open bills only" : "Include paid bills"}</Link></p>
          {rows.length ? (
            <ul className="space-y-3">
              {rows.map((b) => {
                const due = daysBetween(today, b.due_on);
                return (
                  <li key={b.id} className="rounded-xl border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <Link href={`/admin/carriers/${b.carrier_id}`} className="font-semibold text-navy underline">{nm.get(b.carrier_id as string)}</Link>
                      <span className="text-xs text-slate-muted">{b.carrier_invoice_reference ?? "No carrier invoice number"}</span>
                      <StatusBadge value={b.bal <= 0 ? "paid" : b.status} label={b.bal <= 0 ? "Paid" : b.status} />
                      <span className={`ml-auto text-xs ${b.bal > 0 && due < 0 ? "font-semibold text-danger" : "text-slate-muted"}`}>Due {fmtDate(b.due_on)}{b.bal > 0 && due < 0 ? ` (${-due} days past due)` : ""}</span>
                      <span className="font-semibold tabular-nums">{fmtMoney(b.amount)}{b.bal > 0 && b.bal !== toCents(b.amount) ? ` (balance ${fmtMoney(b.bal / 100)})` : ""}</span>
                    </div>
                    {b.shipment_id && <Link href={`/admin/shipments/${b.shipment_id}`} className="mt-1 inline-block text-xs text-brand-red-dark underline">Shipment</Link>}
                    {b.status === "received" && <ActionForm action={approveBill} submitLabel="Approve for payment" variant="navy" className="mt-3"><input type="hidden" name="id" value={b.id} /><p className="text-xs text-slate-muted">Approve after confirming delivery and the POD are on file.</p></ActionForm>}
                    {b.status === "approved" && b.bal > 0 && (
                      <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-navy">Record a payment</summary>
                        <ActionForm action={recordCarrierPayment} submitLabel="Record payment" variant="primary" className="mt-3">
                          <input type="hidden" name="bill_id" value={b.id} />
                          <div className="grid gap-3 sm:grid-cols-4">
                            <AdminField label="Amount" htmlFor={`cp-a-${b.id}`}><input id={`cp-a-${b.id}`} name="amount" defaultValue={(b.bal / 100).toFixed(2)} className={adminInput} /></AdminField>
                            <AdminField label="Paid on" htmlFor={`cp-d-${b.id}`}><input id={`cp-d-${b.id}`} name="paid_on" type="date" defaultValue={today} className={adminInput} /></AdminField>
                            <AdminField label="Method" htmlFor={`cp-m-${b.id}`}><select id={`cp-m-${b.id}`} name="method" className={adminInput}><option value="ach">ACH</option><option value="check">Check</option><option value="quick_pay">Quick pay</option><option value="factoring">Factoring company</option><option value="other">Other</option></select></AdminField>
                            <AdminField label="Reference" htmlFor={`cp-r-${b.id}`}><input id={`cp-r-${b.id}`} name="reference" maxLength={120} className={adminInput} /></AdminField>
                          </div>
                          <Confirm>I made this payment myself through our bank or payment provider.</Confirm>
                        </ActionForm>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState>No open carrier bills.</EmptyState>}
        </div>
        <Panel title="Record a carrier bill" className="h-fit">
          <ActionForm action={createBill} submitLabel="Record bill" resetOnSuccess>
            {pre && <input type="hidden" name="shipment_id" value={pre.id} />}
            {pre && <p className="text-sm">For shipment {pre.reference}.</p>}
            <AdminField label="Carrier" htmlFor="b-car"><select id="b-car" name="carrier_id" required defaultValue={pre?.carrier_id ?? ""} className={adminInput}><option value="" disabled>Choose a carrier</option>{carriers?.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></AdminField>
            <AdminField label="Carrier invoice number" htmlFor="b-ref"><input id="b-ref" name="carrier_invoice_reference" maxLength={120} className={adminInput} /></AdminField>
            <AdminField label="Amount (USD)" htmlFor="b-amt"><input id="b-amt" name="amount" required inputMode="decimal" defaultValue={pre?.carrier_cost ?? ""} className={adminInput} /></AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Received" htmlFor="b-rec"><input id="b-rec" name="received_on" type="date" defaultValue={today} className={adminInput} /></AdminField>
              <AdminField label="Due" htmlFor="b-due"><input id="b-due" name="due_on" type="date" defaultValue={addDays(today, 15)} className={adminInput} /></AdminField>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
