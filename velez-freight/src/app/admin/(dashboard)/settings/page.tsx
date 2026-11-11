import { CircleAlert, CircleCheck } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { env, isEmailConfigured } from "@/lib/env";
import { inviteUser, saveSettings, setAccess } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, PageTitle, Panel, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { fmtDateTime } from "@/config/admin";

export const metadata = { title: "Settings" };

function Toggle({ name, label, checked, disabled }: { name: string; label: string; checked: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} className="size-4 accent-brand-red" /> {label}
    </label>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-navy" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-red-dark" />}
      <span>{children}<span className="sr-only">{ok ? " (done)" : " (not done)"}</span></span>
    </li>
  );
}

export default async function SettingsPage() {
  const s = await requireStaff();
  const canEdit = isAdminRole(s.role);
  const { data: b } = await s.db.from("business_settings").select("*").eq("id", 1).single();
  const { data: team } = s.role === "owner" ? await s.db.from("profiles").select("id, email, full_name, role, is_active, created_at").order("created_at") : { data: null };
  if (!b) return <p>Settings unavailable.</p>;
  const v = (x: string | null) => x ?? "";

  return (
    <>
      <PageTitle title="Settings" description={canEdit ? "Public business details, operating status, notifications, and services." : "Only owners and admins can change settings."} />

      <Panel title="Operating status" className="mb-6">
        <p className="text-sm">Brokerage features (freight quote intake) are live only when <strong>both</strong> switches are on.</p>
        <ul className="mt-4 space-y-2">
          <Check ok={env.brokerAuthorityActive}>Deployment switch <code className="rounded bg-ivory px-1">BROKER_AUTHORITY_ACTIVE</code> is {env.brokerAuthorityActive ? "true" : "false"} (changed only in Vercel environment settings)</Check>
          <Check ok={b.operations_enabled}>Dashboard switch &ldquo;Operations enabled&rdquo; is {b.operations_enabled ? "on" : "off"}</Check>
          <Check ok={Boolean(b.authority_verified_on)}>Broker authority verification date recorded{b.authority_verified_on ? `: ${b.authority_verified_on}` : ""}</Check>
          <Check ok={isEmailConfigured()}>Email notifications configured (Resend API key, sender, recipient)</Check>
        </ul>
        <p className="mt-4 rounded-md bg-ivory p-3 text-xs leading-relaxed">Before enabling operations, confirm in FMCSA records that broker authority is active, the BMC 84 or BMC 85 financial security is effective, and the BOC 3 process agent filing is on file. An MC number by itself is not evidence of active authority.</p>
      </Panel>

      <Panel title="Business details and feature flags" className="mb-6">
        <ActionForm action={saveSettings} submitLabel="Save settings">
          <fieldset disabled={!canEdit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Public business email" htmlFor="st-email"><input id="st-email" name="public_email" type="email" defaultValue={v(b.public_email)} className={adminInput} /></AdminField>
              <AdminField label="Public phone" htmlFor="st-phone"><input id="st-phone" name="public_phone" maxLength={32} defaultValue={v(b.public_phone)} className={adminInput} /></AdminField>
              <AdminField label="MC number (verified)" htmlFor="st-mc"><input id="st-mc" name="mc_number" inputMode="numeric" defaultValue={v(b.mc_number)} className={adminInput} /></AdminField>
              <AdminField label="USDOT number (verified)" htmlFor="st-dot"><input id="st-dot" name="usdot_number" inputMode="numeric" defaultValue={v(b.usdot_number)} className={adminInput} /></AdminField>
              <AdminField label="Service area shown publicly" htmlFor="st-area"><input id="st-area" name="service_area" required maxLength={120} defaultValue={b.service_area} className={adminInput} /></AdminField>
              <AdminField label="Authority verified active on" htmlFor="st-verified"><input id="st-verified" name="authority_verified_on" type="date" defaultValue={v(b.authority_verified_on)} className={adminInput} /></AdminField>
              <AdminField label="Verification notes (private)" htmlFor="st-vnote" className="sm:col-span-2"><textarea id="st-vnote" name="authority_verification_note" maxLength={2000} defaultValue={v(b.authority_verification_note)} className={adminTextarea} placeholder="Where and how authority, bond, and process agent were confirmed" /></AdminField>
              <AdminField label="Custom public status message (optional)" htmlFor="st-msg" className="sm:col-span-2"><textarea id="st-msg" name="status_message" maxLength={500} defaultValue={v(b.status_message)} className={adminTextarea} /></AdminField>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">Company</p>
              <Toggle name="legal_name_confirmed" label="LLC registration confirmed (show Velez Freight Group LLC)" checked={b.legal_name_confirmed} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">Services shown on the website</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle name="service_expedited" label="Expedited Freight" checked={b.service_expedited} />
                <Toggle name="service_dedicated" label="Dedicated Transportation" checked={b.service_dedicated} />
                <Toggle name="service_general" label="General Freight Coordination" checked={b.service_general} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">Email notifications</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle name="notify_on_contact" label="Contact inquiries" checked={b.notify_on_contact} />
                <Toggle name="notify_on_quote" label="Freight inquiries" checked={b.notify_on_quote} />
                <Toggle name="notify_on_carrier" label="Carrier inquiries" checked={b.notify_on_carrier} />
              </div>
            </div>
            <div className="rounded-lg border-2 border-brand-red/40 bg-brand-red/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-red-dark">High impact</p>
              <Toggle name="operations_enabled" label="Operations enabled (accept freight quote inquiries)" checked={b.operations_enabled} />
              <AdminField label="To turn operations ON, type ENABLE OPERATIONS" htmlFor="st-confirm" className="mt-3"><input id="st-confirm" name="confirm_operations" autoComplete="off" className={adminInput} /></AdminField>
            </div>
          </fieldset>
        </ActionForm>
        <p className="mt-3 text-xs text-slate-muted">Last updated {fmtDateTime(b.updated_at)}</p>
      </Panel>

      {team && (
        <Panel title="Team access (owner only)">
          <p className="mb-4 text-sm">There is no public sign up. People can access the dashboard only through an invitation sent from here.</p>
          <ActionForm action={inviteUser} submitLabel="Send invitation" variant="navy" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_9rem]">
              <AdminField label="Email" htmlFor="inv-email"><input id="inv-email" name="email" type="email" required className={adminInput} /></AdminField>
              <AdminField label="Name" htmlFor="inv-name"><input id="inv-name" name="full_name" maxLength={120} className={adminInput} /></AdminField>
              <AdminField label="Role" htmlFor="inv-role"><select id="inv-role" name="role" defaultValue="staff" className={adminInput}><option value="staff">Staff</option><option value="admin">Admin</option></select></AdminField>
            </div>
          </ActionForm>
          <ul className="mt-6 divide-y divide-line">
            {team.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="font-medium text-navy">{m.full_name || m.email}</span>
                <span className="text-xs text-slate-muted">{m.email}</span>
                <span className="text-xs capitalize">{m.role}</span>
                <span className={`text-xs font-semibold ${m.is_active ? "text-navy" : "text-brand-red-dark"}`}>{m.is_active ? "Active" : "No access"}</span>
                {m.id !== s.userId && (
                  <form action={setAccess} className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="role" value={m.role} />
                    <input type="hidden" name="is_active" value={m.is_active ? "false" : "true"} />
                    <button className="rounded border border-line px-2.5 py-1 text-xs font-semibold hover:bg-ivory">{m.is_active ? "Remove access" : "Restore access"}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
