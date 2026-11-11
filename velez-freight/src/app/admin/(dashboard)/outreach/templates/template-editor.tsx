import { isAdminRole, type StaffSession } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { saveTemplate } from "@/app/admin/outreach-actions";
import { footerFor } from "@/lib/email/prepare";
import { variablesFor } from "@/lib/email/variables";
import type { Sender } from "@/lib/email/readiness";
import { SAMPLE_VARIABLES, TEMPLATE_CATEGORIES } from "@/config/outreach";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput } from "@/components/admin/admin-ui";
import { EmailComposer } from "@/components/admin/email-composer";

type Template = { id: string; name: string; category: string; description: string | null; subject: string; body: string; requires_operational: boolean } | null;

export async function TemplateEditor({ s, t }: { s: StaffSession; t: Template }) {
  const canEdit = isAdminRole(s.role);
  const [{ data: senders }, { data: b }, settings] = await Promise.all([
    s.db.from("sender_identities").select("*").eq("active", true).order("is_default", { ascending: false }),
    s.db.from("business_settings").select("mailing_address, website_domain").eq("id", 1).single(),
    getSettings(),
  ]);
  const sender = ((senders ?? []) as Sender[])[0] ?? null;
  const vars = { ...variablesFor({ contactName: SAMPLE_VARIABLES["contact.name"], company: SAMPLE_VARIABLES["company.name"], sender, websiteDomain: b?.website_domain }) };
  return (
    <Panel title={t ? "Edit template" : "New template"}>
      {!canEdit && <p className="mb-4 rounded-md bg-ivory p-3 text-sm">You can use templates when composing. Owners and admins can change them.</p>}
      <ActionForm action={saveTemplate} submitLabel="Save template">
        {t && <input type="hidden" name="id" value={t.id} />}
        <fieldset disabled={!canEdit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminField label="Template name" htmlFor="tp-name"><input id="tp-name" name="name" required minLength={2} maxLength={120} defaultValue={t?.name ?? ""} className={adminInput} /></AdminField>
            <AdminField label="Category" htmlFor="tp-cat"><select id="tp-cat" name="category" defaultValue={t?.category ?? "introduction"} className={adminInput}>{TEMPLATE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></AdminField>
            <AdminField label="Short description" htmlFor="tp-desc"><input id="tp-desc" name="description" maxLength={300} defaultValue={t?.description ?? ""} className={adminInput} /></AdminField>
          </div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="requires_operational" defaultChecked={t?.requires_operational ?? false} className="size-4 accent-brand-red" /> Only usable once brokerage operations are enabled (always on for launch, quote and shipment templates)</label>
          <EmailComposer idPrefix="tp" subject={t?.subject ?? ""} body={t?.body ?? "Hi {{contact.first_name|there}},\n\n\n\n{{sender.signature}}"} vars={vars}
            footer={footerFor({ settings, mailingAddress: b?.mailing_address ?? null, unsubscribeUrl: "https://example.com/unsubscribe", carrier: t?.category === "carrier" })} />
        </fieldset>
      </ActionForm>
      <p className="mt-3 text-xs text-slate-muted">The preview uses sample details (Jordan Lee at Example Supply Co). Please keep wording factual: no invented experience, results or capabilities.</p>
    </Panel>
  );
}
