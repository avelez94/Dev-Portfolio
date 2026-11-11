import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { fmtDate, fmtDateTime, label, verificationStatuses } from "@/config/admin";
import { equipmentOptions } from "@/lib/validation";
import { businessToday, addDays } from "@/lib/metrics/period";
import { EmptyState, FilterBar, Pager, StatusBadge, filterSelect } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Carriers" };
const PAGE = 25;
const onboarding = [{ value: "not_started", label: "Not started" }, { value: "packet_sent", label: "Packet sent" }, { value: "documents_received", label: "Documents received" }, { value: "complete", label: "Complete" }, { value: "declined", label: "Declined" }];

export default async function CarriersPage({ searchParams }: { searchParams: Promise<{ status?: string; onboarding?: string; q?: string; expiring?: string; page?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const status = verificationStatuses.some((p) => p.value === sp.status) ? sp.status : undefined;
  const onb = onboarding.some((p) => p.value === sp.onboarding) ? sp.onboarding : undefined;
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N}@\s._+-]/gu, "").trim().slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const today = businessToday();
  let query = s.db.from("carrier_leads").select("id, company_name, contact_name, mc_number, usdot_number, equipment, operating_region, verification_status, onboarding_status, insurance_expires_on, last_inquiry_at, created_at", { count: "exact" });
  if (status) query = query.eq("verification_status", status);
  if (onb) query = query.eq("onboarding_status", onb);
  if (sp.expiring) query = query.lte("insurance_expires_on", addDays(today, 30));
  if (q) query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,mc_number.ilike.%${q}%,usdot_number.ilike.%${q}%,operating_region.ilike.%${q}%`);
  const { data, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const eq = (v: string) => equipmentOptions.find((e) => e.value === v)?.label ?? v;
  const filters = Object.fromEntries(Object.entries({ status, onboarding: onb, q: q || undefined, expiring: sp.expiring }).filter(([, v]) => v)) as Record<string, string>;
  return (
    <>
      <PageHeader title="Carriers" crumbs={[{ label: "Carriers" }]} description="Carrier relationships, verification evidence and onboarding. MC and USDOT numbers are as supplied until checked against official records."
        actions={<Link href="/admin/carriers/new" className={buttonVariants({ size: "sm" })}><Plus aria-hidden="true" /> Add carrier</Link>} />
      <FilterBar base="/admin/carriers" active={Object.keys(filters).length > 0}>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Search<input name="q" defaultValue={q} placeholder="Name, MC, USDOT, region" className={`mt-1 block w-56 ${filterSelect}`} /></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Verification<select name="status" defaultValue={status ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All</option>{verificationStatuses.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-navy">Onboarding<select name="onboarding" defaultValue={onb ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All</option>{onboarding.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="expiring" value="1" defaultChecked={Boolean(sp.expiring)} className="size-4 accent-brand-red" /> Insurance expiring within 30 days</label>
      </FilterBar>
      {data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Carriers</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Carrier</th><th scope="col" className="px-4 py-3">MC / USDOT</th><th scope="col" className="px-4 py-3">Equipment</th><th scope="col" className="px-4 py-3">Verification</th><th scope="col" className="px-4 py-3">Onboarding</th><th scope="col" className="px-4 py-3">Insurance expires</th><th scope="col" className="px-4 py-3">Last inquiry</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-ivory/60">
                  <td className="px-4 py-3"><Link href={`/admin/carriers/${c.id}`} className="font-semibold text-navy hover:text-brand-red-dark hover:underline">{c.company_name}</Link><span className="block text-xs text-slate-muted">{[c.contact_name, c.operating_region].filter(Boolean).join(" · ")}</span></td>
                  <td className="px-4 py-3 font-mono text-xs">{c.mc_number ? `MC ${c.mc_number}` : "No MC"}<br />{c.usdot_number ? `DOT ${c.usdot_number}` : "No DOT"}</td>
                  <td className="px-4 py-3 text-xs">{(c.equipment ?? []).map(eq).join(", ")}</td>
                  <td className="px-4 py-3"><StatusBadge value={c.verification_status} label={label(verificationStatuses, c.verification_status)} /></td>
                  <td className="px-4 py-3 text-xs">{label(onboarding, c.onboarding_status)}</td>
                  <td className={`px-4 py-3 text-xs ${c.insurance_expires_on && c.insurance_expires_on <= addDays(today, 30) ? "font-semibold text-warning" : ""}`}>{c.insurance_expires_on ? fmtDate(c.insurance_expires_on) : "Not recorded"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-muted">{fmtDateTime(c.last_inquiry_at) || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{Object.keys(filters).length ? "No carriers match these filters." : "No carriers yet. Carrier interest from the website appears here automatically."}</EmptyState>
      )}
      <Pager base="/admin/carriers" params={filters} page={page} pageSize={PAGE} total={count ?? 0} />
    </>
  );
}
