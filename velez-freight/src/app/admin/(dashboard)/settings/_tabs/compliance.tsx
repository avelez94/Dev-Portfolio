import Link from "next/link";
import { ExternalLink, History } from "lucide-react";
import { saveLaunchChecklist, saveSettings } from "@/app/admin/actions";
import { saveCredential } from "@/app/admin/settings-actions";
import { brand } from "@/config/brand";
import { CHECKLIST_STATUSES, LAUNCH_ITEMS } from "@/config/launch";
import { CREDENTIALS, CREDENTIAL_STATUSES, credentialStatusLabel, fmcsaLookupUrl, type CredentialKind } from "@/config/credentials";
import { fmtDate, fmtDateTime } from "@/config/admin";
import { env, isEmailConfigured } from "@/lib/env";
import { isAdminRole } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { DocumentsPanel } from "@/components/admin/documents-panel";
import { Check, Pill, ReadOnlyNote, Toggle, val, type TabProps } from "./ui";

type Credential = {
  id: string; kind: CredentialKind; value: string | null; status: string; verification_source: string | null; verification_reference: string | null;
  verified_on: string | null; effective_on: string | null; expires_on: string | null; show_publicly: boolean; notes: string | null; updated_at: string;
};
type CredEvent = { id: number; credential_id: string; action: string; from_status: string | null; to_status: string | null; value_after: string | null; created_at: string };

const tone = (status: string) => (status === "verified" ? "ok" : status === "expired" || status === "rejected" ? "danger" : status === "not_entered" ? "muted" : "warn") as "ok" | "warn" | "muted" | "danger";
/** Today and 30 days out (ISO dates), for expiry warnings. */
function dateWindow() {
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(now.getDate() + 30);
  return { today: now.toISOString().slice(0, 10), soon: soon.toISOString().slice(0, 10) };
}
const mask = (v: string | null) => (v ? `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : "");

export async function ComplianceTab({ s, b, canEdit }: TabProps) {
  const admin = isAdminRole(s.role);
  const [{ count: verifiedCarriers }, { data: creds }, { data: events }, { data: docs }] = await Promise.all([
    s.db.from("carrier_leads").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
    s.db.from("regulatory_credentials").select("*"),
    admin ? s.db.from("credential_events").select("id, credential_id, action, from_status, to_status, value_after, created_at").order("id", { ascending: false }).limit(200) : Promise.resolve({ data: [] as CredEvent[] }),
    s.db.from("documents").select("id, entity_id, doc_type, reference, received_at, expires_on, storage_path, file_name, file_size").eq("entity_type", "regulatory_credential").order("received_at", { ascending: false }),
  ]);
  const byKind = new Map(((creds ?? []) as Credential[]).map((c) => [c.kind, c]));
  const mc = byKind.get("mc_number");
  const { today, soon } = dateWindow();

  return (
    <div className="space-y-6">
      <Panel title="Operating status">
        <div id="operating-status" className="scroll-mt-24" />
        <p className="text-sm">Brokerage modules (freight quote intake, quotes, shipments, invoicing and carrier payables) work only when <strong>both</strong> switches are on. An MC number alone never enables them.</p>
        <ul className="mt-4 space-y-2">
          <Check ok={env.brokerAuthorityActive}>Deployment switch <code className="rounded bg-ivory px-1">BROKER_AUTHORITY_ACTIVE</code> is {env.brokerAuthorityActive ? "true" : "false"} (changed only in Vercel environment settings, with your approval)</Check>
          <Check ok={b.broker_authority_status === "active"}>Broker authority status recorded as active in <Link href="/admin/settings?tab=profile" className="underline">Company profile</Link></Check>
          <Check ok={Boolean(b.authority_verified_on)}>Broker authority verified active in FMCSA records{b.authority_verified_on ? ` on ${b.authority_verified_on}` : ""}</Check>
          <Check ok={mc?.status === "verified"}>MC number verified with recorded evidence{mc?.value ? `: ${mc.value} (${credentialStatusLabel(mc.status).toLowerCase()})` : ""}</Check>
          <Check ok={(verifiedCarriers ?? 0) > 0}>At least one carrier verified with recorded evidence ({verifiedCarriers ?? 0} so far)</Check>
          <Check ok={isEmailConfigured()}>Email notifications configured (Resend API key, sender, recipient)</Check>
          <Check ok={b.operations_enabled}>Dashboard switch &ldquo;Operations enabled&rdquo; is {b.operations_enabled ? "on" : "off"}</Check>
        </ul>
        <p className="mt-4 rounded-md bg-ivory p-3 text-xs leading-relaxed">Before enabling operations, confirm in FMCSA records that broker authority is active, the BMC 84 or BMC 85 financial security is effective, and the BOC 3 process agent filing is on file.</p>
        <p className="mt-3 text-sm">
          Want to see the website as it will look at launch, without changing anything? Open the{" "}
          <Link href="/admin/preview" className="font-semibold text-brand-red-dark underline">launch preview</Link>. It is visible only to signed in administrators, and its forms are simulations.
        </p>
      </Panel>

      <Panel title="Regulatory credentials">
        <div id="credentials" className="scroll-mt-24" />
        <ReadOnlyNote canEdit={canEdit} />
        <p className="mb-4 text-sm leading-relaxed">
          Entering a number does not verify it. Mark a credential <strong>Verified</strong> only after checking it in the official record, and note where and when. Only verified credentials can appear on the website, and only once operating. Every change is kept in the history.
        </p>
        <ul className="space-y-3">
          {CREDENTIALS.filter((c) => admin || !c.private).map((meta) => {
            const c = byKind.get(meta.kind);
            if (!c) return null;
            const history = ((events ?? []) as CredEvent[]).filter((e) => e.credential_id === c.id).slice(0, 8);
            const expiring = c.expires_on && c.expires_on <= soon;
            const files = (docs ?? []).filter((d) => d.entity_id === c.id);
            const shown = meta.private ? mask(c.value) : c.value;
            return (
              <li key={meta.kind} id={`cred-${meta.kind}`} className="rounded-lg border border-line bg-white">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="font-semibold text-navy">{meta.label}</span>
                    <Pill tone={tone(c.status)}>{credentialStatusLabel(c.status)}</Pill>
                    {shown && <span className="font-mono text-sm">{shown}</span>}
                    {c.show_publicly && <Pill tone="ok">Shown on website</Pill>}
                    {expiring && <Pill tone={c.expires_on! < today ? "danger" : "warn"}>{c.expires_on! < today ? "Expired" : "Expires"} {fmtDate(c.expires_on!)}</Pill>}
                    {c.verified_on && <span className="text-xs text-slate-muted">Verified {fmtDate(c.verified_on)}</span>}
                  </summary>
                  <div className="space-y-5 border-t border-line px-4 py-4">
                    <p className="text-xs text-slate-muted">{meta.help}</p>
                    <ActionForm action={saveCredential} submitLabel={`Save ${meta.label}`}>
                      <input type="hidden" name="kind" value={meta.kind} />
                      <fieldset disabled={!canEdit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <AdminField label={meta.label} htmlFor={`cr-${meta.kind}-value`}>
                            <input id={`cr-${meta.kind}-value`} name="value" maxLength={120} defaultValue={val(c.value)} inputMode={meta.numeric ? "numeric" : undefined} autoComplete="off" className={adminInput} />
                          </AdminField>
                          <AdminField label="Status" htmlFor={`cr-${meta.kind}-status`}>
                            <select id={`cr-${meta.kind}-status`} name="status" defaultValue={c.status} className={adminInput}>
                              {CREDENTIAL_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </AdminField>
                          <AdminField label="Verified on" htmlFor={`cr-${meta.kind}-von`}><input id={`cr-${meta.kind}-von`} name="verified_on" type="date" max={today} defaultValue={val(c.verified_on)} className={adminInput} /></AdminField>
                          <AdminField label="Where it was verified" htmlFor={`cr-${meta.kind}-src`} className="sm:col-span-2"><input id={`cr-${meta.kind}-src`} name="verification_source" maxLength={300} defaultValue={val(c.verification_source)} placeholder="For example: FMCSA licensing and insurance (L&I) record" className={adminInput} /></AdminField>
                          <AdminField label="Reference (record or policy number, link)" htmlFor={`cr-${meta.kind}-ref`}><input id={`cr-${meta.kind}-ref`} name="verification_reference" maxLength={300} defaultValue={val(c.verification_reference)} className={adminInput} /></AdminField>
                          <AdminField label="Effective on" htmlFor={`cr-${meta.kind}-eff`}><input id={`cr-${meta.kind}-eff`} name="effective_on" type="date" defaultValue={val(c.effective_on)} className={adminInput} /></AdminField>
                          <AdminField label="Expires on" htmlFor={`cr-${meta.kind}-exp`}><input id={`cr-${meta.kind}-exp`} name="expires_on" type="date" defaultValue={val(c.expires_on)} className={adminInput} /></AdminField>
                          <AdminField label="Private notes" htmlFor={`cr-${meta.kind}-notes`} className="sm:col-span-2 lg:col-span-3"><textarea id={`cr-${meta.kind}-notes`} name="notes" maxLength={1000} defaultValue={val(c.notes)} className={adminTextarea} /></AdminField>
                        </div>
                        {meta.canBePublic && !meta.private && (
                          <Toggle name="show_publicly" checked={c.show_publicly} label={<>Show on the website once operating <span className="text-xs text-slate-muted">(verified credentials only)</span></>} />
                        )}
                      </fieldset>
                    </ActionForm>
                    {(meta.kind === "mc_number" || meta.kind === "usdot_number" || meta.kind === "broker_authority" || meta.kind === "surety_bond" || meta.kind === "boc3") && (
                      <a href={fmcsaLookupUrl(meta.kind, c.value)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red-dark underline">
                        Check the official FMCSA record <ExternalLink aria-hidden="true" className="size-3.5" /><span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}
                    {admin && (
                      <DocumentsPanel title="Evidence files" entityType="regulatory_credential" entityId={c.id} docs={files} docTypes={["authority_record", "surety_bond", "boc3_filing", "insurance_certificate", "registration_record", "other"]} showExpiry admin={admin} idPrefix={`ev-${meta.kind}`} note="Private. Only owners and admins can upload or open these files, and each download is recorded." />
                    )}
                    {admin && (
                      <div>
                        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy"><History aria-hidden="true" className="size-3.5" /> History</h4>
                        {history.length ? (
                          <ol className="mt-2 space-y-1 text-xs">
                            {history.map((e) => (
                              <li key={e.id}>
                                <span className="text-slate-muted">{fmtDateTime(e.created_at)}</span>{" "}
                                {e.action === "created" ? "Added to the tracker" : e.from_status !== e.to_status ? `Status: ${credentialStatusLabel(e.from_status ?? "")} to ${credentialStatusLabel(e.to_status ?? "")}` : e.action === "value_changed" ? "Value changed" : e.action === "display_changed" ? "Website display changed" : "Details updated"}
                                {e.value_after && !meta.private && e.action !== "created" ? ` (${e.value_after})` : ""}
                              </li>
                            ))}
                          </ol>
                        ) : <p className="mt-2 text-xs text-slate-muted">No changes yet.</p>}
                      </div>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Launch checklist">
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

      <Panel title="Activation, verification and notifications">
        <ActionForm action={saveSettings} submitLabel="Save settings">
          <fieldset disabled={!canEdit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Authority verified active on" htmlFor="st-verified"><input id="st-verified" name="authority_verified_on" type="date" defaultValue={val(b.authority_verified_on)} className={adminInput} /></AdminField>
              <AdminField label="Verification notes (private)" htmlFor="st-vnote" className="sm:col-span-2"><textarea id="st-vnote" name="authority_verification_note" maxLength={2000} defaultValue={val(b.authority_verification_note)} className={adminTextarea} placeholder="Where and how authority, bond, and process agent were confirmed" /></AdminField>
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
    </div>
  );
}
