import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/config/admin";
import { fmtMoney, toCents } from "@/lib/money";
import { addDays, businessToday } from "@/lib/metrics/period";
import { issueInvoice, markInvoiceSent, recordInvoicePayment, voidInvoice } from "@/app/admin/ops-actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, StatusBadge, adminInput } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { DetailList } from "@/components/admin/inquiry-status-form";
import { NotesPanel } from "@/components/admin/panels";
import { Confirm } from "@/components/admin/ops-ui";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: i } = await s.db.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!i) notFound();
  const [{ data: shipper }, { data: pays }, { data: sh }] = await Promise.all([
    s.db.from("shipper_prospects").select("id, company").eq("id", i.shipper_id).single(),
    s.db.from("invoice_payments").select("*").eq("invoice_id", id).order("received_on"),
    i.shipment_id ? s.db.from("shipments").select("id, reference").eq("id", i.shipment_id).single() : Promise.resolve({ data: null }),
  ]);
  const paid = (pays ?? []).reduce((a, p) => a + (toCents(p.amount) ?? 0), 0);
  const bal = (toCents(i.amount) ?? 0) - paid;
  const today = businessToday();
  return (
    <>
      <PageHeader title={`Invoice ${i.number}`} crumbs={[{ label: "Invoices", href: "/admin/invoices" }, { label: i.number }]} description={shipper?.company} actions={<StatusBadge value={bal <= 0 && i.status === "issued" ? "paid" : i.status} label={bal <= 0 && i.status === "issued" ? "Paid" : i.status} />} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Invoice">
            <DetailList rows={[["Customer", <Link key="c" href={`/admin/shippers/${i.shipper_id}`} className="underline">{shipper?.company}</Link>], ["Shipment", sh ? <Link key="s" href={`/admin/shipments/${sh.id}`} className="underline">{sh.reference}</Link> : null], ["Amount", fmtMoney(i.amount)], ["Paid", fmtMoney(paid / 100)], ["Balance", fmtMoney(bal / 100)], ["Issued", fmtDate(i.issued_on)], ["Due", fmtDate(i.due_on)], ["Recorded as sent", i.sent_at ? fmtDateTime(i.sent_at) : "Not recorded"]]} />
          </Panel>
          <Panel title="Payments">
            {pays?.length ? <ul className="space-y-1 text-sm">{pays.map((p) => <li key={p.id} className="flex justify-between"><span>{fmtDate(p.received_on)} · {p.method.toUpperCase()}{p.reference ? ` · ${p.reference}` : ""}</span><span className="tabular-nums">{fmtMoney(p.amount)}</span></li>)}</ul> : <p className="text-sm text-slate-muted">No payments recorded.</p>}
          </Panel>
          <NotesPanel s={s} entityType="invoice" entityId={id} />
        </div>
        <div className="space-y-6">
          {i.status === "draft" && (
            <Panel title="Issue invoice">
              <ActionForm action={issueInvoice} submitLabel="Issue invoice" variant="primary">
                <input type="hidden" name="id" value={id} />
                <div className="grid grid-cols-2 gap-3">
                  <AdminField label="Issue date" htmlFor="ii-on"><input id="ii-on" name="issued_on" type="date" defaultValue={today} className={adminInput} /></AdminField>
                  <AdminField label="Due date" htmlFor="ii-due"><input id="ii-due" name="due_on" type="date" defaultValue={addDays(today, 30)} className={adminInput} /></AdminField>
                </div>
              </ActionForm>
            </Panel>
          )}
          {i.status === "issued" && !i.sent_at && (
            <Panel title="Record that it was sent"><ActionForm action={markInvoiceSent} submitLabel="Record as sent" variant="navy"><input type="hidden" name="id" value={id} /><Confirm>I sent this invoice to the customer myself.</Confirm></ActionForm></Panel>
          )}
          {i.status === "issued" && bal > 0 && (
            <Panel title="Record a payment">
              <ActionForm action={recordInvoicePayment} submitLabel="Record payment" variant="primary" resetOnSuccess>
                <input type="hidden" name="invoice_id" value={id} />
                <div className="grid grid-cols-2 gap-3">
                  <AdminField label="Amount" htmlFor="ip-amt"><input id="ip-amt" name="amount" required inputMode="decimal" defaultValue={(bal / 100).toFixed(2)} className={adminInput} /></AdminField>
                  <AdminField label="Received on" htmlFor="ip-on"><input id="ip-on" name="received_on" type="date" defaultValue={today} className={adminInput} /></AdminField>
                  <AdminField label="Method" htmlFor="ip-m"><select id="ip-m" name="method" className={adminInput}><option value="ach">ACH</option><option value="check">Check</option><option value="wire">Wire</option><option value="card">Card</option><option value="other">Other</option></select></AdminField>
                  <AdminField label="Reference" htmlFor="ip-ref"><input id="ip-ref" name="reference" maxLength={120} placeholder="Check or remittance number" className={adminInput} /></AdminField>
                </div>
              </ActionForm>
            </Panel>
          )}
          {i.status !== "void" && paid === 0 && (
            <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-danger">Void invoice</summary>
              <ActionForm action={voidInvoice} submitLabel="Void invoice" variant="outline" className="mt-3"><input type="hidden" name="id" value={id} /><Confirm>Void this invoice. It will no longer count toward receivables.</Confirm></ActionForm>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
