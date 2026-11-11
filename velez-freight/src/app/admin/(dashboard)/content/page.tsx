import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { saveWebsiteContent } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { getSettings } from "@/lib/data/settings";

export const metadata = { title: "Website Content" };

const pages = [
  ["/", "Home"], ["/services", "Services"], ["/shippers", "Shippers"], ["/carriers", "Carriers"], ["/our-story", "Our Story"],
  ["/contact", "Contact and FAQ"], ["/request-quote", "Request a Quote / Business Inquiry"], ["/privacy", "Privacy Policy"], ["/terms", "Terms of Use"],
] as const;

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-brand-red" /> {label}
    </label>
  );
}

export default async function ContentPage() {
  const s = await requireStaff();
  const canEdit = isAdminRole(s.role);
  const { data: b } = await s.db.from("business_settings").select("*").eq("id", 1).single();
  const settings = await getSettings();
  if (!b) return <p>Content settings unavailable.</p>;
  const v = (x: string | null) => x ?? "";
  return (
    <>
      <PageHeader title="Website Content" crumbs={[{ label: "Website Content" }]}
        description="Public facts shown on the website. Leave a field empty to hide it; nothing is invented. Page copy itself lives in src/config/site.ts and changes with a site update." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Public business facts">
          <ActionForm action={saveWebsiteContent} submitLabel="Save website content">
            <fieldset disabled={!canEdit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Public business email" htmlFor="wc-email"><input id="wc-email" name="public_email" type="email" defaultValue={v(b.public_email)} className={adminInput} /></AdminField>
                <AdminField label="Public phone" htmlFor="wc-phone"><input id="wc-phone" name="public_phone" maxLength={32} defaultValue={v(b.public_phone)} className={adminInput} /></AdminField>
                <AdminField label="Service area shown publicly" htmlFor="wc-area" className="sm:col-span-2"><input id="wc-area" name="service_area" required maxLength={120} defaultValue={b.service_area} className={adminInput} /></AdminField>
                <AdminField label="Custom prelaunch status message (optional)" htmlFor="wc-msg" className="sm:col-span-2"><textarea id="wc-msg" name="status_message" maxLength={500} defaultValue={v(b.status_message)} className={adminTextarea} placeholder="Leave empty to use the approved prelaunch message." /></AdminField>
              </div>
              <Toggle name="legal_name_confirmed" label="LLC registration confirmed (show Velez Freight Group LLC)" checked={b.legal_name_confirmed} />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">Services shown on the website</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Toggle name="service_expedited" label="Expedited Freight" checked={b.service_expedited} />
                  <Toggle name="service_dedicated" label="Dedicated Transportation" checked={b.service_dedicated} />
                  <Toggle name="service_general" label="General Freight Coordination" checked={b.service_general} />
                </div>
              </div>
            </fieldset>
          </ActionForm>
        </Panel>
        <Panel title="What visitors see now">
          <ul className="space-y-2 text-sm">
            <li><span className="font-semibold text-navy">Mode:</span> {settings.operational ? "Active brokerage (quote requests accepted)" : "Prelaunch (business inquiries and launch sign ups only)"}</li>
            <li><span className="font-semibold text-navy">Email:</span> {settings.publicEmail ?? "Hidden (not set)"}</li>
            <li><span className="font-semibold text-navy">Phone:</span> {settings.publicPhone ?? "Hidden (not set)"}</li>
            <li><span className="font-semibold text-navy">MC and USDOT in footer:</span> {settings.operational && settings.mcNumber ? "Shown" : "Hidden until operations are enabled"}</li>
          </ul>
          <h3 className="mt-6 font-sans text-xs font-bold uppercase tracking-wider text-navy">Pages</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {pages.map(([href, label]) => (
              <li key={href} className="flex items-center justify-between py-2"><span>{label}</span><Link href={href} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red-dark">Open <ExternalLink aria-hidden="true" className="size-3.5" /><span className="sr-only"> {label} in a new tab</span></Link></li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
