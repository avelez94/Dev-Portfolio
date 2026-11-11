import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { fmtDateTime } from "@/config/admin";
import { EmptyState, FilterLinks, Pager, StatusBadge } from "@/components/admin/admin-ui";
import { GatedModule, PageHeader } from "@/components/admin/page-header";
import { lane } from "@/components/admin/ops-ui";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Shipments" };
const VIEWS = [{ value: "active", label: "Active" }, { value: "delivered", label: "Delivered" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }, { value: "exceptions", label: "Open exceptions" }, { value: "missing_pod", label: "Missing POD" }];

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string; page?: string }> }) {
  const s = await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  const view = sp.view ?? sp.status;
  const header = <PageHeader title="Shipments" crumbs={[{ label: "Shipments" }]} description="Booked loads from pickup to delivery. Pickup and delivery times come only from recorded events, marked verified or not."
    actions={settings.operational ? <Link href="/admin/shipments/new" className={buttonVariants({ size: "sm" })}><Plus aria-hidden="true" /> Book shipment</Link> : null} />;
  if (!settings.operational) return <>{header}<GatedModule title="Shipments are not available yet" reason="No freight can be booked in prelaunch mode. Shipment tracking opens after broker authority is verified and operations are enabled." /></>;
  const page = Math.max(1, Number(sp.page) || 1);
  let q = s.db.from("shipments").select("id, reference, status, shipper_id, carrier_id, origin_city, origin_state, dest_city, dest_state, pickup_window_start, actual_delivery_at", { count: "exact" }).order("booked_at", { ascending: false });
  if (view === "active") q = q.in("status", ["booked", "dispatched", "in_transit"]);
  else if (["delivered", "completed", "cancelled"].includes(view ?? "")) q = q.eq("status", view!);
  else if (view === "exceptions") {
    const { data: ex } = await s.db.from("shipment_exceptions").select("shipment_id").is("resolved_at", null);
    q = q.in("id", [...new Set((ex ?? []).map((e) => e.shipment_id as string)), "00000000-0000-0000-0000-000000000000"]);
  } else if (view === "missing_pod") {
    const { data: pods } = await s.db.from("documents").select("entity_id").eq("entity_type", "shipment").eq("doc_type", "pod");
    const have = new Set((pods ?? []).map((d) => d.entity_id as string));
    const { data: delivered } = await s.db.from("shipments").select("id").in("status", ["delivered", "completed"]).limit(5000);
    q = q.in("id", [...(delivered ?? []).map((d) => d.id as string).filter((id) => !have.has(id)), "00000000-0000-0000-0000-000000000000"]);
  }
  const { data, count } = await q.range((page - 1) * 25, page * 25 - 1);
  const sIds = [...new Set((data ?? []).map((r) => r.shipper_id as string))];
  const cIds = [...new Set((data ?? []).map((r) => r.carrier_id as string).filter(Boolean))];
  const [{ data: sn }, { data: cn }] = await Promise.all([
    sIds.length ? s.db.from("shipper_prospects").select("id, company").in("id", sIds) : Promise.resolve({ data: [] }),
    cIds.length ? s.db.from("carrier_leads").select("id, company_name").in("id", cIds) : Promise.resolve({ data: [] }),
  ]);
  const sName = new Map((sn ?? []).map((r) => [r.id as string, r.company as string]));
  const cName = new Map((cn ?? []).map((r) => [r.id as string, r.company_name as string]));
  return (
    <>
      {header}
      <div className="mb-5"><FilterLinks base="/admin/shipments" param="view" current={view} options={VIEWS} /></div>
      {data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">Shipments</caption>
            <thead className="bg-ivory text-xs uppercase tracking-wide text-navy"><tr><th scope="col" className="px-4 py-3">Shipment</th><th scope="col" className="px-4 py-3">Customer</th><th scope="col" className="px-4 py-3">Carrier</th><th scope="col" className="px-4 py-3">Lane</th><th scope="col" className="px-4 py-3">Pickup window</th><th scope="col" className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((x) => (
                <tr key={x.id}><td className="px-4 py-2.5"><Link href={`/admin/shipments/${x.id}`} className="font-mono text-xs font-semibold text-brand-red-dark underline">{x.reference}</Link></td><td className="px-4 py-2.5">{sName.get(x.shipper_id as string)}</td><td className="px-4 py-2.5">{x.carrier_id ? cName.get(x.carrier_id as string) : <span className="font-semibold text-warning">Not assigned</span>}</td><td className="px-4 py-2.5 text-xs">{lane(x)}</td><td className="px-4 py-2.5 text-xs">{fmtDateTime(x.pickup_window_start) || "Not set"}</td><td className="px-4 py-2.5"><StatusBadge value={x.status} label={x.status.replace("_", " ")} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState>No shipments in this view.</EmptyState>}
      <Pager base="/admin/shipments" params={{ view }} page={page} pageSize={25} total={count ?? 0} />
    </>
  );
}
