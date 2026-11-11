import { saveContactSupport } from "@/app/admin/settings-actions";
import { AFTER_HOURS, DAYS, SOCIAL_NETWORKS } from "@/config/credentials";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput } from "@/components/admin/admin-ui";
import { ReadOnlyNote, Toggle, val, type TabProps } from "./ui";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time" }, { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" }, { value: "America/Los_Angeles", label: "Pacific Time" },
];

export function ContactTab({ b, canEdit }: TabProps) {
  const hours = (b.business_hours ?? {}) as Record<string, { open?: string; close?: string; closed?: boolean }>;
  const social = (b.social_links ?? {}) as Record<string, string>;
  return (
    <Panel title="Contact and support">
      <ReadOnlyNote canEdit={canEdit} />
      <ActionForm action={saveContactSupport} submitLabel="Save contact and support">
        <fieldset disabled={!canEdit} className="space-y-6">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">Public contact details</h3>
            <p className="mb-3 text-xs text-slate-muted">Shown on the website when filled in (you can hide them in Public Website). Leave empty to hide. Nothing is invented.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Public business email" htmlFor="cs-email"><input id="cs-email" name="public_email" type="email" defaultValue={val(b.public_email)} className={adminInput} /></AdminField>
              <AdminField label="Public phone" htmlFor="cs-phone"><input id="cs-phone" name="public_phone" maxLength={32} defaultValue={val(b.public_phone)} className={adminInput} /></AdminField>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">Team addresses (not shown on the website)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Support email" htmlFor="cs-support"><input id="cs-support" name="support_email" type="email" defaultValue={val(b.support_email)} className={adminInput} /></AdminField>
              <AdminField label="Sales email" htmlFor="cs-sales"><input id="cs-sales" name="sales_email" type="email" defaultValue={val(b.sales_email)} className={adminInput} /></AdminField>
              <AdminField label="Carrier relations email" htmlFor="cs-carrier"><input id="cs-carrier" name="carrier_email" type="email" defaultValue={val(b.carrier_email)} className={adminInput} /></AdminField>
              <AdminField label="Billing email" htmlFor="cs-billing"><input id="cs-billing" name="billing_email" type="email" defaultValue={val(b.billing_email)} className={adminInput} /></AdminField>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">Business hours</h3>
            <p className="mb-3 text-xs text-slate-muted">Leave a day empty to leave it off the list. Hours appear on the Contact page only if you turn that on in Public Website.</p>
            <div className="mb-3 max-w-xs">
              <AdminField label="Time zone" htmlFor="cs-tz"><select id="cs-tz" name="hours_timezone" defaultValue={b.hours_timezone ?? "America/New_York"} className={adminInput}>{TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></AdminField>
            </div>
            <ul className="divide-y divide-line rounded-md border border-line bg-white">
              {DAYS.map((d) => {
                const h = hours[d.key] ?? {};
                return (
                  <li key={d.key} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-3 px-3 py-2 sm:grid-cols-[8rem_9rem_9rem_auto]">
                    <span className="text-sm font-semibold text-navy">{d.label}</span>
                    <label className="sr-only" htmlFor={`cs-${d.key}-open`}>{d.label} opening time</label>
                    <input id={`cs-${d.key}-open`} name={`${d.key}__open`} type="time" defaultValue={h.open ?? ""} className={adminInput} />
                    <label className="sr-only" htmlFor={`cs-${d.key}-close`}>{d.label} closing time</label>
                    <input id={`cs-${d.key}-close`} name={`${d.key}__close`} type="time" defaultValue={h.close ?? ""} className={adminInput} />
                    <label className="col-span-3 flex items-center gap-2 text-sm sm:col-span-1"><input type="checkbox" name={`${d.key}__closed`} defaultChecked={Boolean(h.closed)} className="size-4 accent-brand-red" /> Closed</label>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">After hours</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="After hours availability" htmlFor="cs-after"><select id="cs-after" name="after_hours_support" defaultValue={b.after_hours_support ?? "none"} className={adminInput}>{AFTER_HOURS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></AdminField>
            </div>
            <div className="mt-3">
              <Toggle name="after_hours_verified" checked={Boolean(b.after_hours_verified)} label="I confirm around the clock support is actually staffed (required before “24/7” appears anywhere on the website)" />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">Social media links</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {SOCIAL_NETWORKS.map((n) => (
                <AdminField key={n.key} label={n.label} htmlFor={`cs-social-${n.key}`}><input id={`cs-social-${n.key}`} name={`social_${n.key}`} type="url" placeholder="https://" defaultValue={social[n.key] ?? ""} className={adminInput} /></AdminField>
              ))}
            </div>
          </div>
        </fieldset>
      </ActionForm>
    </Panel>
  );
}
