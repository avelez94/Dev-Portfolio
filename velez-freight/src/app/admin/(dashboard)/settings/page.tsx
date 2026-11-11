import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { env, isEmailConfigured } from "@/lib/env";
import { inviteUser, saveIdentity, saveLaunchChecklist, saveSettings, setAccess } from "@/app/admin/actions";
import { brand } from "@/config/brand";
import { AUTHORITY_STATUSES, CHECKLIST_STATUSES, LAUNCH_ITEMS, TRADEMARK_STATUSES } from "@/config/launch";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { fmtDateTime } from "@/config/admin";

export const metadata = { title: "Settings" };

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-brand-red" /> {label}
    </label>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />}
      <span>{children}<span className="sr-only">{ok ? " (done)" : " (not done)"}</span></span>
    </li>
  );
}

export default async function SettingsPage() {
  const s = await requireStaff();
  const canEdit = isAdminRole(s.role);
  const { data: b } = await s.db.from("business_settings").select("*").eq("id", 1).single();
  const { data: team } = s.role === "owner" ? await s.db.from("profiles").select("id, email, full_name, role, is_active, created_at").order("created_at") : { data: null };
  const { count: verifiedCarriers } = await s.db.from("carrier_leads").select("id", { count: "exact", head: true }).eq("verification_status", "verified");
  if (!b) return <p>Settings unavailable.</p>;
  const v = (x: string | null) => x ?? "";

  return (
    <>
      <PageHeader title="Settings" crumbs={[{ label: "Settings" }]} description="Business identity, launch checklist, operating mode, notifications, and team access. Public contact details live in Website Content."
        actions={<Link href="/admin/content" className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory">Website Content</Link>} />

      <Panel title="Operating status" className="mb-6">
        <div id="operating-status" className="scroll-mt-24" />
        <p className="text-sm">Brokerage modules (freight quote intake, quotes, shipments, invoicing and carrier payables) work only when <strong>both</strong> switches are on. An MC number alone never enables them.</p>
        <ul className="mt-4 space-y-2">
          <Check ok={env.brokerAuthorityActive}>Deployment switch <code className="rounded bg-ivory px-1">BROKER_AUTHORITY_ACTIVE</code> is {env.brokerAuthorityActive ? "true" : "false"} (changed only in Vercel environment settings, with your approval)</Check>
          <Check ok={b.broker_authority_status === "active"}>Broker authority status recorded as active in <a href="#identity" className="underline">Business identity</a></Check>
          <Check ok={Boolean(b.authority_verified_on)}>Broker authority verified active in FMCSA records{b.authority_verified_on ? ` on ${b.authority_verified_on}` : ""}</Check>
          <Check ok={Boolean(b.mc_number)}>MC number recorded{b.mc_number ? `: ${b.mc_number}` : ""}</Check>
          <Check ok={(verifiedCarriers ?? 0) > 0}>At least one carrier verified with recorded evidence ({verifiedCarriers ?? 0} so far)</Check>
          <Check ok={isEmailConfigured()}>Email notifications configured (Resend API key, sender, recipient)</Check>
          <Check ok={b.operations_enabled}>Dashboard switch &ldquo;Operations enabled&rdquo; is {b.operations_enabled ? "on" : "off"}</Check>
        </ul>
        <p className="mt-4 rounded-md bg-ivory p-3 text-xs leading-relaxed">Before enabling operations, confirm in FMCSA records that broker authority is active, the BMC 84 or BMC 85 financial security is effective, and the BOC 3 process agent filing is on file.</p>
      </Panel>

      <Panel title="Business identity" className="mb-6">
        <div id="identity" className="scroll-mt-24" />
        <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-muted">Public brand name</dt><dd className="font-semibold text-navy">{brand.name}</dd></div>
          <div><dt className="text-xs text-slate-muted">Previous brand name</dt><dd>{brand.previousName} <span className="text-xs text-slate-muted">(older records only)</span></dd></div>
          <div><dt className="text-xs text-slate-muted">Operational launch status</dt><dd className="font-semibold">{env.brokerAuthorityActive && b.operations_enabled ? "Active brokerage" : "Prelaunch"}</dd></div>
        </dl>
        <ActionForm action={saveIdentity} submitLabel="Save business identity">
          <fieldset disabled={!canEdit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Legal entity name" htmlFor="id-legal"><input id="id-legal" name="legal_entity_name" maxLength={160} defaultValue={v(b.legal_entity_name)} placeholder={brand.intendedLegalName} className={adminInput} /></AdminField>
              <AdminField label="Website domain (once chosen)" htmlFor="id-domain"><input id="id-domain" name="website_domain" maxLength={253} defaultValue={v(b.website_domain)} placeholder="Not chosen yet" className={adminInput} /></AdminField>
              <AdminField label="Trademark clearance" htmlFor="id-tm"><select id="id-tm" name="trademark_clearance_status" defaultValue={b.trademark_clearance_status} className={adminInput}>{TRADEMARK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></AdminField>
              <AdminField label="Broker authority status" htmlFor="id-auth"><select id="id-auth" name="broker_authority_status" defaultValue={b.broker_authority_status} className={adminInput}>{AUTHORITY_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></AdminField>
              <AdminField label="Business address (private, not shown on the website)" htmlFor="id-addr" className="sm:col-span-2"><textarea id="id-addr" name="business_address" maxLength={300} defaultValue={v(b.business_address)} className={adminTextarea} /></AdminField>
            </div>
            <Toggle name="legal_name_confirmed" label="The legal entity name above is registered and confirmed (shows it in the footer, privacy policy and terms)" checked={b.legal_name_confirmed} />
          </fieldset>
        </ActionForm>
        <p className="mt-3 text-xs leading-relaxed text-slate-muted">Recording a status here does not file, register or verify anything. Business email and phone are set in <Link href="/admin/content" className="font-semibold text-brand-red-dark underline">Website Content</Link>; MC and USDOT numbers below.</p>
      </Panel>

      <Panel title="Launch checklist" className="mb-6">
        <div id="launch" className="scroll-mt-24" />
        <p className="mb-4 text-sm">Name, legal and compliance steps for {brand.name}. {LAUNCH_ITEMS.filter((i) => (b.launch_checklist?.[i.key]?.status ?? "todo") === "done").length} of {LAUNCH_ITEMS.length} done.</p>
        <ActionForm action={saveLaunchChecklist} submitLabel="Save checklist">
          <fieldset disabled={!canEdit}>
            <ul className="divide-y divide-line">
              {LAUNCH_ITEMS.map((item) => {
                const entry = b.launch_checklist?.[item.key] as { status?: string; note?: string | null; updated_at?: string } | undefined;
                return (
                  <li key={item.key} className="grid gap-3 py-3 lg:grid-cols-[1fr_11rem_16rem] lg:items-start">
                    <div>
                      <p className="text-sm font-semibold text-navy">{item.label}</p>
                      <p className="text-xs text-slate-muted">{item.help}</p>
                      {entry?.updated_at && <p className="mt-1 text-xs text-slate-muted">Updated {fmtDateTime(entry.updated_at)}</p>}
                    </div>
                    <label className="sr-only" htmlFor={`lc-${item.key}`}>{item.label} status</label>
                    <select id={`lc-${item.key}`} name={`${item.key}__status`} defaultValue={entry?.status ?? "todo"} className={adminInput}>
                      {CHECKLIST_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <label className="sr-only" htmlFor={`lcn-${item.key}`}>{item.label} note</label>
                    <input id={`lcn-${item.key}`} name={`${item.key}__note`} maxLength={300} defaultValue={entry?.note ?? ""} placeholder="Note (optional)" className={adminInput} />
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </ActionForm>
      </Panel>

      <Panel title="Activation, verification and notifications" className="mb-6">
        <ActionForm action={saveSettings} submitLabel="Save settings">
          <fieldset disabled={!canEdit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="MC number (verified)" htmlFor="st-mc"><input id="st-mc" name="mc_number" inputMode="numeric" defaultValue={v(b.mc_number)} className={adminInput} /></AdminField>
              <AdminField label="USDOT number (verified)" htmlFor="st-dot"><input id="st-dot" name="usdot_number" inputMode="numeric" defaultValue={v(b.usdot_number)} className={adminInput} /></AdminField>
              <AdminField label="Authority verified active on" htmlFor="st-verified"><input id="st-verified" name="authority_verified_on" type="date" defaultValue={v(b.authority_verified_on)} className={adminInput} /></AdminField>
              <AdminField label="Verification notes (private)" htmlFor="st-vnote" className="sm:col-span-2"><textarea id="st-vnote" name="authority_verification_note" maxLength={2000} defaultValue={v(b.authority_verification_note)} className={adminTextarea} placeholder="Where and how authority, bond, and process agent were confirmed" /></AdminField>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">Email notifications</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle name="notify_on_contact" label="Contact inquiries" checked={b.notify_on_contact} />
                <Toggle name="notify_on_quote" label="Freight inquiries" checked={b.notify_on_quote} />
                <Toggle name="notify_on_carrier" label="Carrier inquiries" checked={b.notify_on_carrier} />
              </div>
            </div>
            <div className="rounded-lg border-2 border-danger/30 bg-danger-soft/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-danger">High impact</p>
              <Toggle name="operations_enabled" label="Operations enabled (accept freight quote inquiries)" checked={b.operations_enabled} />
              <AdminField label="To turn operations ON, type ENABLE OPERATIONS" htmlFor="st-confirm" className="mt-3"><input id="st-confirm" name="confirm_operations" autoComplete="off" className={adminInput} /></AdminField>
            </div>
          </fieldset>
        </ActionForm>
        <p className="mt-3 text-xs text-slate-muted">Last updated {fmtDateTime(b.updated_at)}</p>
      </Panel>

      {team && (
        <Panel title="Team access (owner only)">
          <p className="mb-4 text-sm">There is no public sign up. People can access the dashboard only through an invitation sent from here. Staff can work prospects, carriers and operations; only owners and admins see financial records, settings and the audit log.</p>
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
                <span className={`text-xs font-semibold ${m.is_active ? "text-success" : "text-danger"}`}>{m.is_active ? "Active" : "No access"}</span>
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
