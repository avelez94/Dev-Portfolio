import Link from "next/link";
import { saveIdentity } from "@/app/admin/actions";
import { brand } from "@/config/brand";
import { AUTHORITY_STATUSES, TRADEMARK_STATUSES } from "@/config/launch";
import { env } from "@/lib/env";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { ReadOnlyNote, Toggle, val, type TabProps } from "./ui";

const ENTITY_TYPES = [
  { value: "llc", label: "Limited liability company (LLC)" },
  { value: "corporation", label: "Corporation" },
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "other", label: "Other" },
];

export function ProfileTab({ b, canEdit }: TabProps) {
  return (
    <Panel title="Company profile">
      <div id="identity" className="scroll-mt-24" />
      <ReadOnlyNote canEdit={canEdit} />
      <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-slate-muted">Public brand name</dt><dd className="font-semibold text-navy">{brand.name}</dd></div>
        <div><dt className="text-xs text-slate-muted">Previous brand name</dt><dd>{brand.previousName} <span className="text-xs text-slate-muted">(older records only)</span></dd></div>
        <div><dt className="text-xs text-slate-muted">Operational launch status</dt><dd className="font-semibold">{env.brokerAuthorityActive && b.operations_enabled ? "Active brokerage" : "Prelaunch"}</dd></div>
      </dl>
      <ActionForm action={saveIdentity} submitLabel="Save business identity">
        <fieldset disabled={!canEdit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Legal entity name" htmlFor="id-legal"><input id="id-legal" name="legal_entity_name" maxLength={160} defaultValue={val(b.legal_entity_name)} placeholder={brand.intendedLegalName} className={adminInput} /></AdminField>
            <AdminField label="Entity type" htmlFor="id-entity"><select id="id-entity" name="entity_type" defaultValue={val(b.entity_type)} className={adminInput}><option value="">Not recorded</option>{ENTITY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></AdminField>
            <AdminField label="State of formation" htmlFor="id-state"><input id="id-state" name="formation_state" maxLength={60} defaultValue={val(b.formation_state)} placeholder="Maryland" className={adminInput} /></AdminField>
            <AdminField label="Website domain (once chosen)" htmlFor="id-domain"><input id="id-domain" name="website_domain" maxLength={253} defaultValue={val(b.website_domain)} placeholder="Not chosen yet" className={adminInput} /></AdminField>
            <AdminField label="Trademark clearance" htmlFor="id-tm"><select id="id-tm" name="trademark_clearance_status" defaultValue={b.trademark_clearance_status} className={adminInput}>{TRADEMARK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></AdminField>
            <AdminField label="Broker authority status" htmlFor="id-auth"><select id="id-auth" name="broker_authority_status" defaultValue={b.broker_authority_status} className={adminInput}>{AUTHORITY_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></AdminField>
            <AdminField label="Business address (private, not shown on the website)" htmlFor="id-addr"><textarea id="id-addr" name="business_address" maxLength={300} defaultValue={val(b.business_address)} className={adminTextarea} /></AdminField>
            <AdminField label="Mailing address for email footers (required before marketing email)" htmlFor="id-mail"><textarea id="id-mail" name="mailing_address" maxLength={300} defaultValue={val(b.mailing_address)} className={adminTextarea} placeholder="Street or PO box, city, state, ZIP" /></AdminField>
          </div>
          <Toggle name="legal_name_confirmed" label="The legal entity name above is registered and confirmed (shows it in the footer, privacy policy and terms)" checked={b.legal_name_confirmed} />
        </fieldset>
      </ActionForm>
      <p className="mt-3 text-xs leading-relaxed text-slate-muted">
        Recording a status here does not file, register or verify anything. Public email and phone are in{" "}
        <Link href="/admin/settings?tab=contact" className="font-semibold text-brand-red-dark underline">Contact &amp; Support</Link>; MC, USDOT and other credentials in{" "}
        <Link href="/admin/settings?tab=compliance" className="font-semibold text-brand-red-dark underline">Regulatory &amp; Compliance</Link>. A mailing address is legally required in every marketing email (CAN-SPAM).
      </p>
    </Panel>
  );
}
