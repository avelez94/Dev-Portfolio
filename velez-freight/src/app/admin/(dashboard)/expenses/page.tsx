import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/config/admin";
import { fmtMoney, toCents } from "@/lib/money";
import { businessToday } from "@/lib/metrics/period";
import { createExpense } from "@/app/admin/ops-actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, EmptyState, Panel, adminInput } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Operating expenses" };
const CATS = [["software", "Software"], ["insurance", "Insurance"], ["licensing", "Licensing and registration"], ["marketing", "Marketing"], ["professional_services", "Professional services"], ["office", "Office"], ["payroll", "Payroll"], ["other", "Other"]];

export default async function ExpensesPage() {
  const s = await requireAdmin();
  const { data } = await s.db.from("operating_expenses").select("*").order("incurred_on", { ascending: false }).limit(300);
  const total = (data ?? []).reduce((a, e) => a + (toCents(e.amount) ?? 0), 0);
  return (
    <>
      <PageHeader title="Operating expenses" crumbs={[{ label: "Invoices", href: "/admin/invoices" }, { label: "Operating expenses" }]} description="Brokerage operating costs used in the operating profit estimate. Startup costs can be recorded in prelaunch mode. Taxes and owner distributions do not belong here." />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          {data?.length ? (
            <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
              <table className="w-full min-w-[600px] text-left text-sm">
                <caption className="p-4 text-left text-xs text-slate-muted">Most recent 300 entries. Total shown: {fmtMoney(total / 100)}</caption>
                <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Date</th><th scope="col" className="px-4 py-3">Category</th><th scope="col" className="px-4 py-3">Description</th><th scope="col" className="px-4 py-3">Vendor</th><th scope="col" className="px-4 py-3 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-line">{data.map((e) => <tr key={e.id}><td className="px-4 py-2.5 text-xs">{fmtDate(e.incurred_on)}</td><td className="px-4 py-2.5">{CATS.find((c) => c[0] === e.category)?.[1]}</td><td className="px-4 py-2.5">{e.description}</td><td className="px-4 py-2.5">{e.vendor}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(e.amount)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <EmptyState>No expenses recorded yet.</EmptyState>}
        </div>
        <Panel title="Record an expense" className="h-fit">
          <ActionForm action={createExpense} submitLabel="Record expense" resetOnSuccess>
            <AdminField label="Category" htmlFor="x-cat"><select id="x-cat" name="category" className={adminInput}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></AdminField>
            <AdminField label="Description" htmlFor="x-desc"><input id="x-desc" name="description" required maxLength={300} className={adminInput} /></AdminField>
            <AdminField label="Vendor" htmlFor="x-ven"><input id="x-ven" name="vendor" maxLength={160} className={adminInput} /></AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Amount (USD)" htmlFor="x-amt"><input id="x-amt" name="amount" required inputMode="decimal" className={adminInput} /></AdminField>
              <AdminField label="Date" htmlFor="x-on"><input id="x-on" name="incurred_on" type="date" defaultValue={businessToday()} className={adminInput} /></AdminField>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
