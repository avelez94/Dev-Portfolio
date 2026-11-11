import Link from "next/link";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { addSuppression, checkSenderDomain, removeSuppression, saveSender, saveSendingControls } from "@/app/admin/outreach-actions";
import { outreachGates, type Sender } from "@/lib/email/readiness";
import { fmtDateTime } from "@/config/admin";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput, adminTextarea } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { OutreachTabs } from "../outreach-tabs";

export const metadata = { title: "Sending Setup" };

function SenderFields({ s, idp }: { s?: Sender; idp: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AdminField label="Name shown to recipients" htmlFor={`${idp}-name`}><input id={`${idp}-name`} name="display_name" required maxLength={80} defaultValue={s?.display_name ?? ""} className={adminInput} /></AdminField>
      <AdminField label="Sender email (on your verified domain)" htmlFor={`${idp}-email`}><input id={`${idp}-email`} name="email" type="email" required defaultValue={s?.email ?? ""} className={adminInput} /></AdminField>
      <AdminField label="Reply to (optional)" htmlFor={`${idp}-reply`}><input id={`${idp}-reply`} name="reply_to" type="email" defaultValue={s?.reply_to ?? ""} className={adminInput} /></AdminField>
      <AdminField label="Title (optional)" htmlFor={`${idp}-title`}><input id={`${idp}-title`} name="title" maxLength={120} defaultValue={s?.title ?? ""} placeholder="Founder & CEO" className={adminInput} /></AdminField>
      <AdminField label="Signature" htmlFor={`${idp}-sig`} className="sm:col-span-2"><textarea id={`${idp}-sig`} name="signature" maxLength={1000} defaultValue={s?.signature ?? ""} placeholder={"Leave empty to use your name, title and the business name"} className={adminTextarea} /></AdminField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_default" defaultChecked={s?.is_default ?? false} className="size-4 accent-brand-red" /> Default sender</label>
      {s && (
        <label className="flex items-center gap-2 text-sm"><input type="hidden" name="active" value="off" /><input type="checkbox" name="active" value="on" defaultChecked={s.active} className="size-4 accent-brand-red" /> Active</label>
      )}
    </div>
  );
}

export default async function SetupPage() {
  const s = await requireStaff();
  const admin = isAdminRole(s.role);
  const [{ data: b }, { data: senders }, { data: suppressions }] = await Promise.all([
    s.db.from("business_settings").select("*").eq("id", 1).single(),
    s.db.from("sender_identities").select("*").order("created_at"),
    s.db.from("email_suppressions").select("email, reason, source, note, created_at").order("created_at", { ascending: false }).limit(500),
  ]);
  const gates = outreachGates(b ?? {}, (senders ?? []) as Sender[]);
  const domainTone = b?.sender_domain_status === "verified" ? "ok" : b?.sender_domain_status === "failed" || b?.sender_domain_status === "not_found" ? "danger" : "warn";

  return (
    <>
      <PageHeader title="Sending Setup" crumbs={[{ label: "Outreach", href: "/admin/outreach" }, { label: "Sending Setup" }]} description="Domain, sender identities, approval to send, daily limit and the do not email list." />
      <OutreachTabs current="/admin/outreach/setup" />
      {!admin && <p className="mb-4 rounded-md bg-ivory p-3 text-sm">Owners and admins manage sending. You can write drafts for approval.</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Sending domain and approval">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span>Domain status:</span>
            <StatusPill tone={domainTone}>{b?.sender_domain ? `${b.sender_domain}: ${String(b.sender_domain_status).replace(/_/g, " ")}` : "No domain chosen"}</StatusPill>
            {b?.sender_domain_checked_at && <span className="text-xs text-slate-muted">checked {fmtDateTime(b.sender_domain_checked_at)}</span>}
          </div>
          {admin && b?.sender_domain && (
            <div className="mb-5"><ActionForm action={checkSenderDomain} submitLabel="Check domain status with the provider" variant="outline" trackChanges={false}><span /></ActionForm></div>
          )}
          <ActionForm action={saveSendingControls} submitLabel="Save sending controls">
            <fieldset disabled={!admin} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Sending domain" htmlFor="sd-domain"><input id="sd-domain" name="sender_domain" defaultValue={b?.sender_domain ?? b?.website_domain ?? ""} placeholder="yourbusiness.com" className={adminInput} /></AdminField>
                <AdminField label="Daily sending limit" htmlFor="sd-limit"><input id="sd-limit" name="outreach_daily_limit" type="number" min={1} max={200} defaultValue={b?.outreach_daily_limit ?? 25} className={adminInput} /></AdminField>
              </div>
              <div className="rounded-lg border-2 border-danger/30 bg-danger-soft/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-danger">High impact</p>
                <label className="mt-2 flex items-center gap-3 text-sm"><input type="checkbox" name="outreach_sending_approved" defaultChecked={Boolean(b?.outreach_sending_approved)} className="size-4 accent-brand-red" /> Sending approved (real emails can leave after each message is approved)</label>
                <AdminField label="To approve sending, type APPROVE SENDING" htmlFor="sd-confirm" className="mt-3"><input id="sd-confirm" name="confirm_sending" autoComplete="off" className={adminInput} /></AdminField>
                {b?.outreach_approved_at && b?.outreach_sending_approved && <p className="mt-2 text-xs text-slate-muted">Approved {fmtDateTime(b.outreach_approved_at)}</p>}
              </div>
            </fieldset>
          </ActionForm>
          <ul className="mt-5 space-y-1 text-sm">
            {gates.map((g) => <li key={g.key}>{g.ok ? "Done" : "Not done"}: {g.label}{g.detail ? <span className="text-xs text-slate-muted"> ({g.detail})</span> : null}</li>)}
          </ul>
          <p className="mt-3 text-xs text-slate-muted">The mailing address is set in <Link href="/admin/settings?tab=profile" className="font-semibold text-brand-red-dark underline">Company profile</Link>. Delivery updates need the webhook secret <code>RESEND_WEBHOOK_SECRET</code> in the hosting environment.</p>
        </Panel>

        <Panel title="Sender identities">
          <ul className="mb-5 space-y-3">
            {((senders ?? []) as Sender[]).map((x) => (
              <li key={x.id} className="rounded-md border border-line bg-white">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="font-semibold text-navy">{x.display_name}</span><span className="text-slate-muted">&lt;{x.email}&gt;</span>
                    {x.is_default && <StatusPill tone="ok">Default</StatusPill>}{!x.active && <StatusPill tone="muted">Inactive</StatusPill>}
                    {b?.sender_domain && !x.email.endsWith(`@${b.sender_domain}`) && <StatusPill tone="danger">Not on {b.sender_domain}</StatusPill>}
                  </summary>
                  <div className="border-t border-line p-3">
                    <ActionForm action={saveSender} submitLabel="Save sender"><input type="hidden" name="id" value={x.id} /><fieldset disabled={!admin}><SenderFields s={x} idp={`sn-${x.id.slice(0, 6)}`} /></fieldset></ActionForm>
                  </div>
                </details>
              </li>
            ))}
            {!senders?.length && <li className="text-sm text-slate-muted">No senders yet.</li>}
          </ul>
          {admin && (
            <details className="rounded-md border border-dashed border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold text-navy">Add a sender</summary>
              <div className="mt-3"><ActionForm action={saveSender} submitLabel="Add sender" resetOnSuccess><SenderFields idp="sn-new" /></ActionForm></div>
            </details>
          )}
        </Panel>
      </div>

      <Panel title="Do not email list" className="mt-6">
        <p className="mb-4 text-sm">Nobody on this list can be emailed. Unsubscribes, bounces and spam complaints are added automatically and cannot be removed here. You can add addresses yourself and lift those manual blocks later.</p>
        {admin && (
          <ActionForm action={addSuppression} submitLabel="Add to list" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <AdminField label="Email address" htmlFor="sp-email"><input id="sp-email" name="email" type="email" required className={adminInput} /></AdminField>
              <AdminField label="Note (optional)" htmlFor="sp-note"><input id="sp-note" name="note" maxLength={300} className={adminInput} /></AdminField>
            </div>
          </ActionForm>
        )}
        <ul className="mt-5 divide-y divide-line text-sm">
          {(suppressions ?? []).map((x) => (
            <li key={x.email} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-medium text-navy">{x.email}</span>
              <StatusPill tone={x.reason === "manual" ? "muted" : "danger"}>{x.reason}</StatusPill>
              <span className="text-xs text-slate-muted">{fmtDateTime(x.created_at)}{x.source ? `, ${x.source}` : ""}{x.note ? `, ${x.note}` : ""}</span>
              {admin && x.reason === "manual" && (
                <form action={removeSuppression} className="ml-auto"><input type="hidden" name="email" value={x.email} /><button className="text-xs font-semibold text-brand-red-dark underline">Remove</button></form>
              )}
            </li>
          ))}
          {!suppressions?.length && <li className="py-2 text-slate-muted">The list is empty.</li>}
        </ul>
      </Panel>
    </>
  );
}
