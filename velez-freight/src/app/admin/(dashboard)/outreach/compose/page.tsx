import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { saveDraft } from "@/app/admin/outreach-actions";
import { footerFor } from "@/lib/email/prepare";
import { variablesFor } from "@/lib/email/variables";
import type { Sender } from "@/lib/email/readiness";
import { TEMPLATE_CATEGORIES } from "@/config/outreach";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { EmailComposer } from "@/components/admin/email-composer";
import { OutreachTabs } from "../outreach-tabs";

export const metadata = { title: "Compose email" };

type Target = { key: string; label: string; email: string; name: string | null; company: string | null; carrier: boolean; profile: string };

export default async function ComposePage({ searchParams }: { searchParams: Promise<{ to?: string; template?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const [{ data: contacts }, { data: shippers }, { data: carriers }, { data: templates }, { data: senders }, { data: b }] = await Promise.all([
    s.db.from("shipper_contacts").select("id, name, email, shipper_id").not("email", "is", null).order("name").limit(500),
    s.db.from("shipper_prospects").select("id, company, contact_name, email").order("company").limit(1000),
    s.db.from("carrier_leads").select("id, company_name, contact_name, email").not("email", "is", null).order("company_name").limit(500),
    s.db.from("email_templates").select("id, name, category, subject, body, requires_operational").eq("status", "active").order("name"),
    s.db.from("sender_identities").select("*").eq("active", true).order("is_default", { ascending: false }),
    s.db.from("business_settings").select("mailing_address, website_domain").eq("id", 1).single(),
  ]);
  const settings = await getSettings();

  const targets: Target[] = [
    ...(contacts ?? []).map((c) => {
      const company = (shippers ?? []).find((p) => p.id === c.shipper_id)?.company ?? null;
      return { key: `contact:${c.id}`, label: `${c.name}, ${company ?? "shipper"} (${c.email})`, email: c.email!, name: c.name, company, carrier: false, profile: `/admin/shippers/${c.shipper_id}` };
    }),
    ...(shippers ?? []).filter((p) => p.email).map((p) => ({ key: `shipper:${p.id}`, label: `${p.company}${p.contact_name ? `, ${p.contact_name}` : ""} (${p.email})`, email: p.email!, name: p.contact_name, company: p.company, carrier: false, profile: `/admin/shippers/${p.id}` })),
    ...(carriers ?? []).map((c) => ({ key: `carrier:${c.id}`, label: `Carrier: ${c.company_name}${c.contact_name ? `, ${c.contact_name}` : ""} (${c.email})`, email: c.email!, name: c.contact_name, company: c.company_name, carrier: true, profile: `/admin/carriers/${c.id}` })),
  ];
  const target = targets.find((t) => t.key === sp.to);
  const template = (templates ?? []).find((t) => t.id === sp.template);
  const sender = ((senders ?? []) as Sender[])[0] ?? null;
  const usable = (templates ?? []).filter((t) => settings.operational || !t.requires_operational);

  return (
    <>
      <PageHeader title="Compose email" crumbs={[{ label: "Outreach", href: "/admin/outreach" }, { label: "Compose" }]} description="Choose who it is for and a template, then edit. Drafts are saved for approval; nothing is sent from this page." />
      <OutreachTabs current="/admin/outreach/compose" />

      <Panel title="1. Recipient and template" className="mb-6">
        <form method="get" className="grid gap-4 md:grid-cols-[2fr_1.4fr_auto] md:items-end">
          <AdminField label="Send to" htmlFor="cp-to">
            <select id="cp-to" name="to" defaultValue={sp.to ?? ""} className={adminInput}>
              <option value="">Choose a contact, shipper or carrier with an email address</option>
              {targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </AdminField>
          <AdminField label="Start from a template" htmlFor="cp-template">
            <select id="cp-template" name="template" defaultValue={sp.template ?? ""} className={adminInput}>
              <option value="">Blank email</option>
              {TEMPLATE_CATEGORIES.map((c) => {
                const list = usable.filter((t) => t.category === c.value);
                return list.length ? <optgroup key={c.value} label={c.label}>{list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup> : null;
              })}
            </select>
          </AdminField>
          <button className="h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white">Continue</button>
        </form>
        {!targets.length && <p className="mt-3 text-sm text-slate-muted">No records have an email address yet. Add one on a <Link href="/admin/shippers" className="font-semibold text-brand-red-dark underline">shipper</Link> or <Link href="/admin/carriers" className="font-semibold text-brand-red-dark underline">carrier</Link> profile.</p>}
        {!settings.operational && <p className="mt-3 text-xs text-slate-muted">Launch, quote and shipment templates are hidden until brokerage operations are enabled.</p>}
      </Panel>

      {target && (
        <Panel title={`2. Write to ${target.name || target.email}`}>
          {!senders?.length && <p className="mb-4 rounded-md bg-warning-soft p-3 text-sm">Add a sender identity in <Link href="/admin/outreach/setup" className="font-semibold underline">Sending Setup</Link> before saving.</p>}
          <ActionForm action={saveDraft} submitLabel="Save">
            <input type="hidden" name="target" value={target.key} />
            <input type="hidden" name="template_id" value={template?.id ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="From" htmlFor="cp-sender">
                <select id="cp-sender" name="sender_id" defaultValue={sender?.id ?? ""} className={adminInput}>
                  {(senders ?? []).map((x) => <option key={x.id} value={x.id}>{x.display_name} &lt;{x.email}&gt;</option>)}
                </select>
              </AdminField>
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-semibold uppercase tracking-wide text-navy">When saved</legend>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="intent" value="draft" defaultChecked className="accent-brand-red" /> Keep as a draft</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="intent" value="submit" className="accent-brand-red" /> Submit for approval</label>
              </fieldset>
            </div>
            <EmailComposer
              subject={template?.subject ?? ""}
              body={template?.body ?? "Hi {{contact.first_name|there}},\n\n\n\n{{sender.signature}}"}
              vars={variablesFor({ contactName: target.name, company: target.company, sender, websiteDomain: b?.website_domain })}
              footer={footerFor({ settings, mailingAddress: b?.mailing_address ?? null, unsubscribeUrl: "https://example.com/unsubscribe", carrier: target.carrier })}
            />
          </ActionForm>
          <p className="mt-3 text-xs text-slate-muted">The preview uses this record’s details and your default sender. The unsubscribe link in the preview is a placeholder; the real one is added when sending.</p>
        </Panel>
      )}
    </>
  );
}
