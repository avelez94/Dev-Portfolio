import { saveCarrier, saveProspect } from "@/app/admin/actions";
import { prospectStatuses, verificationStatuses } from "@/config/admin";
import { equipmentOptions } from "@/lib/validation";
import { ActionForm } from "./action-form";
import { AdminField, adminInput, adminTextarea } from "./admin-ui";

type Prospect = { id?: string; company?: string; contact_name?: string | null; email?: string | null; phone?: string | null; industry?: string | null; location?: string | null; freight_needs?: string | null; status?: string; notes?: string | null; next_follow_up?: string | null };

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
        <AdminField label="Industry" htmlFor="sp-industry"><input id="sp-industry" name="industry" maxLength={120} defaultValue={f("industry")} className={adminInput} /></AdminField>
        <AdminField label="Location" htmlFor="sp-location"><input id="sp-location" name="location" maxLength={160} defaultValue={f("location")} className={adminInput} /></AdminField>
        <AdminField label="Contact status" htmlFor="sp-status">
          <select id="sp-status" name="status" defaultValue={p.status ?? "researching"} className={adminInput}>
            {prospectStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Next follow up" htmlFor="sp-next"><input id="sp-next" name="next_follow_up" type="date" defaultValue={f("next_follow_up")} className={adminInput} /></AdminField>
        <AdminField label="Potential freight needs" htmlFor="sp-needs" className="sm:col-span-2"><textarea id="sp-needs" name="freight_needs" maxLength={2000} defaultValue={f("freight_needs")} className={adminTextarea} /></AdminField>
        <AdminField label="Summary notes" htmlFor="sp-notes" className="sm:col-span-2"><textarea id="sp-notes" name="notes" maxLength={4000} defaultValue={f("notes")} className={adminTextarea} /></AdminField>
      </div>
    </ActionForm>
  );
}

type Carrier = { id?: string; company_name?: string; contact_name?: string | null; email?: string | null; phone?: string | null; mc_number?: string | null; usdot_number?: string | null; equipment?: string[]; operating_region?: string | null; fleet_size?: number | null; verification_status?: string; verified_on?: string | null; notes?: string | null; next_follow_up?: string | null };

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
        <AdminField label="Verification status" htmlFor="cl-status">
          <select id="cl-status" name="verification_status" defaultValue={c.verification_status ?? "unverified"} className={adminInput}>
            {verificationStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Verified on" htmlFor="cl-verified"><input id="cl-verified" name="verified_on" type="date" defaultValue={f("verified_on")} className={adminInput} /></AdminField>
        <AdminField label="Next follow up" htmlFor="cl-next"><input id="cl-next" name="next_follow_up" type="date" defaultValue={f("next_follow_up")} className={adminInput} /></AdminField>
        <AdminField label="Notes" htmlFor="cl-notes" className="sm:col-span-2"><textarea id="cl-notes" name="notes" maxLength={4000} defaultValue={f("notes")} className={adminTextarea} /></AdminField>
      </div>
      <p className="text-xs text-slate-muted">Mark Verified only after checking authority, insurance, and safety information yourself in official FMCSA sources. Supplied identifiers are not proof of active authority.</p>
    </ActionForm>
  );
}
