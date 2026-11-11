import { saveCarrier, saveProspect } from "@/app/admin/actions";
import { industryCategories, leadSources, prospectStatuses, verificationStatuses } from "@/config/admin";
import { equipmentOptions } from "@/lib/validation";
import { ActionForm } from "./action-form";
import { AdminField, adminInput, adminTextarea } from "./admin-ui";

type Prospect = { id?: string; company?: string; contact_name?: string | null; email?: string | null; phone?: string | null; industry?: string | null; location?: string | null; freight_needs?: string | null; status?: string; notes?: string | null; next_follow_up?: string | null; source?: string; industry_category?: string; website?: string | null };

export function ProspectForm({ p = {} }: { p?: Prospect }) {
  const f = (k: keyof Prospect) => (p[k] as string | null | undefined) ?? "";
  return (
    <ActionForm action={saveProspect} submitLabel={p.id ? "Save changes" : "Create prospect"}>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Company *" htmlFor="sp-company"><input id="sp-company" name="company" required maxLength={160} defaultValue={f("company")} className={adminInput} /></AdminField>
        <AdminField label="Contact name" htmlFor="sp-contact"><input id="sp-contact" name="contact_name" maxLength={120} defaultValue={f("contact_name")} className={adminInput} /></AdminField>
        <AdminField label="Email" htmlFor="sp-email"><input id="sp-email" name="email" type="email" defaultValue={f("email")} className={adminInput} /></AdminField>
        <AdminField label="Phone" htmlFor="sp-phone"><input id="sp-phone" name="phone" maxLength={32} defaultValue={f("phone")} className={adminInput} /></AdminField>
        <AdminField label="Industry category" htmlFor="sp-industry-cat">
          <select id="sp-industry-cat" name="industry_category" defaultValue={p.industry_category ?? "other"} className={adminInput}>{industryCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </AdminField>
        <AdminField label="Industry detail" htmlFor="sp-industry"><input id="sp-industry" name="industry" maxLength={120} defaultValue={f("industry")} placeholder="e.g. Corrugated packaging" className={adminInput} /></AdminField>
        <AdminField label="Lead source" htmlFor="sp-source">
          <select id="sp-source" name="source" defaultValue={p.source ?? "research"} className={adminInput}>{leadSources.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </AdminField>
        <AdminField label="Location" htmlFor="sp-location"><input id="sp-location" name="location" maxLength={160} defaultValue={f("location")} className={adminInput} /></AdminField>
        <AdminField label="Website" htmlFor="sp-website"><input id="sp-website" name="website" maxLength={200} defaultValue={f("website")} className={adminInput} /></AdminField>
        {!p.id && (
          <>
            <AdminField label="Pipeline stage" htmlFor="sp-status">
              <select id="sp-status" name="status" defaultValue="researching" className={adminInput}>{prospectStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            </AdminField>
            <AdminField label="First follow up" htmlFor="sp-next"><input id="sp-next" name="next_follow_up" type="date" className={adminInput} /></AdminField>
          </>
        )}
        <AdminField label="Potential freight needs" htmlFor="sp-needs" className="sm:col-span-2"><textarea id="sp-needs" name="freight_needs" maxLength={2000} defaultValue={f("freight_needs")} className={adminTextarea} /></AdminField>
        <AdminField label="Summary notes" htmlFor="sp-notes" className="sm:col-span-2"><textarea id="sp-notes" name="notes" maxLength={4000} defaultValue={f("notes")} className={adminTextarea} /></AdminField>
      </div>
    </ActionForm>
  );
}

type Carrier = { legal_name?: string | null; onboarding_status?: string; insurance_provider?: string | null; auto_liability_limit?: number | string | null; cargo_limit?: number | string | null; insurance_expires_on?: string | null; agreement_signed_on?: string | null; id?: string; company_name?: string; contact_name?: string | null; email?: string | null; phone?: string | null; mc_number?: string | null; usdot_number?: string | null; equipment?: string[]; operating_region?: string | null; fleet_size?: number | null; verification_status?: string; verified_on?: string | null; notes?: string | null; next_follow_up?: string | null };

export function CarrierLeadForm({ c = {} }: { c?: Carrier }) {
  const f = (k: keyof Carrier) => (c[k] as string | null | undefined) ?? "";
  return (
    <ActionForm action={saveCarrier} submitLabel={c.id ? "Save changes" : "Create carrier lead"}>
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Company name *" htmlFor="cl-company"><input id="cl-company" name="company_name" required maxLength={160} defaultValue={f("company_name")} className={adminInput} /></AdminField>
        <AdminField label="Contact name" htmlFor="cl-contact"><input id="cl-contact" name="contact_name" maxLength={120} defaultValue={f("contact_name")} className={adminInput} /></AdminField>
        <AdminField label="Email" htmlFor="cl-email"><input id="cl-email" name="email" type="email" defaultValue={f("email")} className={adminInput} /></AdminField>
        <AdminField label="Phone" htmlFor="cl-phone"><input id="cl-phone" name="phone" maxLength={32} defaultValue={f("phone")} className={adminInput} /></AdminField>
        <AdminField label="MC number" htmlFor="cl-mc"><input id="cl-mc" name="mc_number" inputMode="numeric" defaultValue={f("mc_number")} className={adminInput} /></AdminField>
        <AdminField label="USDOT number" htmlFor="cl-dot"><input id="cl-dot" name="usdot_number" inputMode="numeric" defaultValue={f("usdot_number")} className={adminInput} /></AdminField>
        <AdminField label="Operating region" htmlFor="cl-region"><input id="cl-region" name="operating_region" maxLength={300} defaultValue={f("operating_region")} className={adminInput} /></AdminField>
        <AdminField label="Power units" htmlFor="cl-fleet"><input id="cl-fleet" name="fleet_size" inputMode="numeric" defaultValue={c.fleet_size ?? ""} className={adminInput} /></AdminField>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy">Equipment</legend>
          <div className="flex flex-wrap gap-2">
            {equipmentOptions.map((e) => (
              <label key={e.value} className="flex items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm">
                <input type="checkbox" name="equipment" value={e.value} defaultChecked={c.equipment?.includes(e.value)} className="accent-brand-red" /> {e.label}
              </label>
            ))}
          </div>
        </fieldset>
        <AdminField label="Legal business name" htmlFor="cl-legal"><input id="cl-legal" name="legal_name" maxLength={160} defaultValue={f("legal_name")} className={adminInput} /></AdminField>
        <AdminField label="Onboarding" htmlFor="cl-onb">
          <select id="cl-onb" name="onboarding_status" defaultValue={c.onboarding_status ?? "not_started"} className={adminInput}>
            <option value="not_started">Not started</option><option value="packet_sent">Packet sent</option><option value="documents_received">Documents received</option><option value="complete">Complete</option><option value="declined">Declined</option>
          </select>
        </AdminField>
        <AdminField label="Insurance provider" htmlFor="cl-ins"><input id="cl-ins" name="insurance_provider" maxLength={160} defaultValue={f("insurance_provider")} className={adminInput} /></AdminField>
        <AdminField label="Insurance expires on" htmlFor="cl-insexp"><input id="cl-insexp" name="insurance_expires_on" type="date" defaultValue={f("insurance_expires_on")} className={adminInput} /></AdminField>
        <AdminField label="Auto liability limit (USD)" htmlFor="cl-auto"><input id="cl-auto" name="auto_liability_limit" inputMode="decimal" defaultValue={c.auto_liability_limit ?? ""} className={adminInput} /></AdminField>
        <AdminField label="Cargo limit (USD)" htmlFor="cl-cargo"><input id="cl-cargo" name="cargo_limit" inputMode="decimal" defaultValue={c.cargo_limit ?? ""} className={adminInput} /></AdminField>
        <AdminField label="Broker carrier agreement signed on" htmlFor="cl-agree"><input id="cl-agree" name="agreement_signed_on" type="date" defaultValue={f("agreement_signed_on")} className={adminInput} /></AdminField>
        <AdminField label="Verification status" htmlFor="cl-status">
          <select id="cl-status" name="verification_status" defaultValue={c.verification_status ?? "unverified"} className={adminInput}>
            {verificationStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Verified on" htmlFor="cl-verified"><input id="cl-verified" name="verified_on" type="date" defaultValue={f("verified_on")} className={adminInput} /></AdminField>
        <AdminField label="Next follow up" htmlFor="cl-next"><input id="cl-next" name="next_follow_up" type="date" defaultValue={f("next_follow_up")} className={adminInput} /></AdminField>
        <AdminField label="Notes" htmlFor="cl-notes" className="sm:col-span-2"><textarea id="cl-notes" name="notes" maxLength={4000} defaultValue={f("notes")} className={adminTextarea} /></AdminField>
      </div>
      <p className="text-xs text-slate-muted">Verified requires a passing authority check from the last 30 days and a passing insurance check recorded below, plus insurance and agreement dates. Supplied identifiers are not proof of active authority.</p>
    </ActionForm>
  );
}
