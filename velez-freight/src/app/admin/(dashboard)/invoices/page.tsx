import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { fmtDate } from "@/config/admin";
import { fmtMoney, toCents } from "@/lib/money";
import { businessToday, daysBetween } from "@/lib/metrics/period";
import { EmptyState, FilterLinks, StatusBadge } from "@/components/admin/admin-ui";
import { GatedModule, PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const s = await requireAdmin();
  const settings = await getSettings();
  const { view: v } = await searchParams;
  const view = ["open", "overdue", "draft", "paid", "all"].includes(v ?? "") ? v! : "open";
  const header = <PageHeader title="Invoices" crumbs={[{ label: "Invoices" }]} description="Customer invoices and payments. Invoices are created from delivered shipments; sending and payment are recorded by you, never automatically."
    actions={<Link href="/admin/expenses" className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory">Operating expenses</Link>} />;
  if (!settings.operational) return <>{header}<GatedModule title="Invoicing is not available yet" reason="Invoices are created from delivered shipments, which exist only after brokerage activation. You can already record business setup costs under Operating expenses." /></>;
  const today = businessToday();
  let q = s.db.from("invoices").select("id, number, status, shipper_id, shipment_id, amount, issued_on, due_on, sent_at").order("due_on", { ascending: true, nullsFirst: false }).limit(500);
  if (view === "draft") q = q.eq("status", "draft"); else if (view !== "all") q = q.eq("status", "issued");
  const { data } = await q;
  const ids = (data ?? []).map((i) => i.id as string);
  const [{ data: pays }, { data: names }] = await Promise.all([
    ids.length ? s.db.from("invoice_payments").select("invoice_id, amount").in("invoice_id", ids) : Promise.resolve({ data: [] }),
    s.db.from("shipper_prospects").select("id, company").in("id", [...new Set((data ?? []).map((i) => i.shipper_id as string)), "00000000-0000-0000-0000-000000000000"]),
  ]);
  const nm = new Map((names ?? []).map((r) => [r.id as string, r.company as string]));
  const rows = (data ?? []).map((i) => {
    const paid = (pays ?? []).filter((p) => p.invoice_id === i.id).reduce((a, p) => a + (toCents(p.amount) ?? 0), 0);
    const bal = (toCents(i.amount) ?? 0) - paid;
    const late = i.due_on && i.status === "issued" ? daysBetween(i.due_on, today) : 0;
    return { ...i, bal, late };
  }).filter((r) => view === "open" ? r.bal > 0 : view === "overdue" ? r.bal > 0 && r.late > 0 : view === "paid" ? r.status === "issued" && r.bal <= 0 : true);
  const total = rows.reduce((a, r) => a + Math.max(0, r.bal), 0);
  return (
    <>
      {header}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterLinks base="/admin/invoices" param="view" current={view === "open" ? undefined : view} options={[{ value: "overdue", label: "Overdue" }, { value: "draft", label: "Draft" }, { value: "paid", label: "Paid" }, { value: "all", label: "All invoices" }]} />
        <p className="text-sm"><span className="text-slate-muted">Balance in this view:</span> <strong className="text-navy">{fmtMoney(total / 100)}</strong></p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">Invoices</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Invoice</th><th scope="col" className="px-4 py-3">Customer</th><th scope="col" className="px-4 py-3">Issued</th><th scope="col" className="px-4 py-3">Due</th><th scope="col" className="px-4 py-3 text-right">Amount</th><th scope="col" className="px-4 py-3 text-right">Balance</th><th scope="col" className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}><td className="px-4 py-2.5"><Link href={`/admin/invoices/${r.id}`} className="font-mono text-xs font-semibold text-brand-red-dark underline">{r.number}</Link></td><td className="px-4 py-2.5">{nm.get(r.shipper_id as string)}</td><td className="px-4 py-2.5 text-xs">{fmtDate(r.issued_on)}</td><td className={`px-4 py-2.5 text-xs ${r.late > 0 && r.bal > 0 ? "font-semibold text-danger" : ""}`}>{fmtDate(r.due_on)}{r.late > 0 && r.bal > 0 ? ` (${r.late} days overdue)` : ""}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(r.amount)}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(Math.max(0, r.bal) / 100)}</td><td className="px-4 py-2.5"><StatusBadge value={r.bal <= 0 && r.status === "issued" ? "paid" : r.status} label={r.bal <= 0 && r.status === "issued" ? "Paid" : r.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState>No invoices in this view. Create invoices from delivered shipments.</EmptyState>}
    </>
  );
}
