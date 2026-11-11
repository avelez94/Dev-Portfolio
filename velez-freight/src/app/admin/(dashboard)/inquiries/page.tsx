import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { contactStatuses, fmtDate, fmtDateTime, inquiryTypeLabels, label, quoteStatuses } from "@/config/admin";
import { EmptyState, FilterLinks, PageTitle, Panel, StatusBadge } from "@/components/admin/admin-ui";

export const metadata = { title: "Website Inquiries" };

const types = [
  { value: "general", label: "General" },
  { value: "shipper", label: "Shipper" },
  { value: "carrier", label: "Carrier" },
  { value: "launch_notification", label: "Launch notification" },
  { value: "quote", label: "Freight quote" },
];

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string; q?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const type = types.some((t) => t.value === sp.type) ? sp.type : undefined;
  const statusOptions = type === "quote" ? quoteStatuses : contactStatuses;
  const status = statusOptions.some((x) => x.value === sp.status) ? sp.status : undefined;
  const search = (sp.q ?? "").trim().slice(0, 80).replace(/[^\p{L}\p{N}@\s._+-]/gu, "");

  type Row = { id: string; reference: string; kind: string; typeKey: string; who: string; email: string; status: string; follow_up_date: string | null; created_at: string; href: string };
  const rows: Row[] = [];
  if (type !== "quote") {
    let q = s.db.from("contact_inquiries").select("id, reference, inquiry_type, name, company, email, status, follow_up_date, created_at").order("created_at", { ascending: false }).limit(300);
    if (type) q = q.eq("inquiry_type", type);
    if (status) q = q.eq("status", status);
    if (search) q = q.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,reference.ilike.%${search}%`);
    const { data } = await q;
    data?.forEach((r) => rows.push({ id: r.id, reference: r.reference, kind: inquiryTypeLabels[r.inquiry_type], typeKey: r.inquiry_type, who: r.company ? `${r.company} (${r.name})` : r.name, email: r.email, status: r.status, follow_up_date: r.follow_up_date, created_at: r.created_at, href: `/admin/inquiries/contact/${r.id}` }));
  }
  if (!type || type === "quote") {
    let q = s.db.from("quote_inquiries").select("id, reference, company_name, contact_name, email, status, follow_up_date, created_at").order("created_at", { ascending: false }).limit(300);
    if (status && type === "quote") q = q.eq("status", status);
    if (status && !type) q = q.eq("status", status === "new" ? "pending_review" : status);
    if (search) q = q.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,reference.ilike.%${search}%`);
    const { data } = await q;
    data?.forEach((r) => rows.push({ id: r.id, reference: r.reference, kind: "Freight quote", typeKey: "quote", who: `${r.company_name} (${r.contact_name})`, email: r.email, status: r.status, follow_up_date: r.follow_up_date, created_at: r.created_at, href: `/admin/inquiries/quote/${r.id}` }));
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const qs = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    Object.entries({ type, status, ...extra }).forEach(([k, v]) => v && u.set(k, v));
    return u.toString();
  };

  return (
    <>
      <PageTitle title="Website Inquiries" description="Every submission from the public website. Filter by type and status, set follow up dates, and resolve." />
      <Panel className="mb-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-bold uppercase tracking-wide text-navy">Type</span><FilterLinks base="/admin/inquiries" param="type" current={type} options={types} /></div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-navy">Status</span>
            <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
              {[{ value: "", label: "All" }, ...statusOptions].map((o) => (
                <Link key={o.value || "all"} href={`/admin/inquiries?${qs({ status: o.value || undefined })}`} aria-current={(status ?? "") === o.value ? "true" : undefined} className={`rounded-full border px-3 py-1 text-xs font-semibold ${(status ?? "") === o.value ? "border-navy bg-navy text-white" : "border-line bg-white text-navy"}`}>{o.label}</Link>
              ))}
            </nav>
          </div>
          <form className="flex gap-2" role="search">
            {type && <input type="hidden" name="type" value={type} />}
            {status && <input type="hidden" name="status" value={status} />}
            <label htmlFor="inq-search" className="sr-only">Search inquiries</label>
            <input id="inq-search" name="q" defaultValue={search} placeholder="Search name, company, email or reference" className="h-10 w-full max-w-md rounded-md border border-input bg-white px-3 text-sm" />
            <button className="rounded-md bg-navy px-4 text-sm font-semibold text-white">Search</button>
          </form>
        </div>
      </Panel>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Website inquiries</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy">
              <tr><th scope="col" className="px-4 py-3">Reference</th><th scope="col" className="px-4 py-3">From</th><th scope="col" className="px-4 py-3">Type</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Follow up</th><th scope="col" className="px-4 py-3">Received</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ivory/60">
                  <td className="px-4 py-3 font-mono text-xs"><Link href={r.href} className="font-semibold text-brand-red-dark underline-offset-2 hover:underline">{r.reference}</Link></td>
                  <td className="px-4 py-3"><span className="font-medium text-navy">{r.who}</span><span className="block text-xs text-slate-muted">{r.email}</span></td>
                  <td className="px-4 py-3">{r.kind}</td>
                  <td className="px-4 py-3"><StatusBadge value={r.status} label={label(r.typeKey === "quote" ? quoteStatuses : contactStatuses, r.status)} /></td>
                  <td className="px-4 py-3 text-xs">{fmtDate(r.follow_up_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-muted">{fmtDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No inquiries match these filters.</EmptyState>
      )}
    </>
  );
}
