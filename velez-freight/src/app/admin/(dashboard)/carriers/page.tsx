import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime, label, verificationStatuses } from "@/config/admin";
import { equipmentOptions } from "@/lib/validation";
import { EmptyState, FilterLinks, PageTitle, StatusBadge } from "@/components/admin/admin-ui";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Carrier Leads" };

export default async function CarriersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await requireStaff();
  const { status: raw } = await searchParams;
  const status = verificationStatuses.some((p) => p.value === raw) ? raw : undefined;
  let q = s.db.from("carrier_leads").select("id, company_name, contact_name, mc_number, usdot_number, equipment, operating_region, verification_status, last_inquiry_at, created_at").order("created_at", { ascending: false }).limit(500);
  if (status) q = q.eq("verification_status", status);
  const { data } = await q;
  const eq = (v: string) => equipmentOptions.find((e) => e.value === v)?.label ?? v;
  return (
    <>
      <PageTitle title="Carrier Leads" description="Carriers who expressed interest or that you added. MC and USDOT numbers are as supplied until you verify them." actions={<Link href="/admin/carriers/new" className={buttonVariants({ size: "sm" })}><Plus aria-hidden="true" /> New carrier lead</Link>} />
      <div className="mb-6"><FilterLinks base="/admin/carriers" param="status" current={status} options={[...verificationStatuses]} /></div>
      {data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Carrier leads</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Company</th><th scope="col" className="px-4 py-3">MC / USDOT</th><th scope="col" className="px-4 py-3">Equipment</th><th scope="col" className="px-4 py-3">Region</th><th scope="col" className="px-4 py-3">Verification</th><th scope="col" className="px-4 py-3">Last inquiry</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-ivory/60">
                  <td className="px-4 py-3"><Link href={`/admin/carriers/${c.id}`} className="font-semibold text-navy hover:text-brand-red-dark hover:underline">{c.company_name}</Link>{c.contact_name && <span className="block text-xs text-slate-muted">{c.contact_name}</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.mc_number ? `MC ${c.mc_number}` : ""}{c.mc_number && c.usdot_number ? <br /> : null}{c.usdot_number ? `DOT ${c.usdot_number}` : ""}</td>
                  <td className="px-4 py-3 text-xs">{(c.equipment ?? []).map(eq).join(", ")}</td>
                  <td className="px-4 py-3 text-xs">{c.operating_region}</td>
                  <td className="px-4 py-3"><StatusBadge value={c.verification_status} label={label(verificationStatuses, c.verification_status)} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-muted">{fmtDateTime(c.last_inquiry_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No carrier leads{status ? " with this status" : " yet"}.</EmptyState>
      )}
    </>
  );
}
