import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, Send } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { approveMessage, cancelMessage, saveDraft, sendMessage } from "@/app/admin/outreach-actions";
import { footerFor, prepareMessage, type MessageRow } from "@/lib/email/prepare";
import { variablesFor } from "@/lib/email/variables";
import { gatesPass, type Sender } from "@/lib/email/readiness";
import { DELIVERY_STATUS, MESSAGE_STATUS } from "@/config/outreach";
import { fmtDateTime } from "@/config/admin";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { EmailComposer, EmailPreview } from "@/components/admin/email-composer";

export const metadata = { title: "Email" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: m } = await s.db.from("outreach_messages").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();
  const admin = isAdminRole(s.role);
  const [{ built, problems, gates, sender, settingsRow }, { data: events }, { data: senders }, { data: people }, settings] = await Promise.all([
    prepareMessage(s, m as MessageRow),
    s.db.from("email_events").select("id, event_type, detail, occurred_at").eq("message_id", id).order("occurred_at", { ascending: false }),
    s.db.from("sender_identities").select("*").eq("active", true),
    s.db.from("profiles").select("id, full_name, email"),
    getSettings(),
  ]);
  const who = (uid: string | null) => people?.find((p) => p.id === uid)?.full_name || people?.find((p) => p.id === uid)?.email || "Unknown";
  const editable = ["draft", "pending_approval", "approved", "failed"].includes(m.status);
  const st = MESSAGE_STATUS[m.status] ?? { label: m.status, tone: "muted" as const };
  const profile = m.shipper_id ? `/admin/shippers/${m.shipper_id}` : m.carrier_id ? `/admin/carriers/${m.carrier_id}` : null;
  const company = m.shipper_id
    ? (await s.db.from("shipper_prospects").select("company").eq("id", m.shipper_id).maybeSingle()).data?.company ?? null
    : m.carrier_id ? (await s.db.from("carrier_leads").select("company_name").eq("id", m.carrier_id).maybeSingle()).data?.company_name ?? null : null;

  return (
    <>
      <PageHeader title={built.subject || m.subject} crumbs={[{ label: "Outreach", href: "/admin/outreach" }, { label: m.reference }]}
        description={`To ${m.to_name ? `${m.to_name} <${m.to_email}>` : m.to_email}${company ? `, ${company}` : ""}`}
        actions={profile ? <Link href={profile} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory">Open record</Link> : undefined} />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
        {m.status === "sent" && <span>{DELIVERY_STATUS[m.delivery_status]}</span>}
        <span className="text-slate-muted">Created {fmtDateTime(m.created_at)} by {who(m.created_by)}</span>
        {m.approved_at && <span className="text-slate-muted">Approved {fmtDateTime(m.approved_at)} by {who(m.approved_by)}</span>}
        {m.sent_at && <span className="text-slate-muted">Sent {fmtDateTime(m.sent_at)}</span>}
      </div>

      {m.status === "sent" && <p role="status" className="mb-6 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-navy"><strong>Sent {fmtDateTime(m.sent_at)}.</strong> The email provider accepted the message (provider reference {m.provider_message_id}).</p>}
      {m.error && m.status === "failed" && <p role="alert" className="mb-6 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm"><strong>Not sent.</strong> {m.error}</p>}

      {problems.length > 0 && editable && (
        <div role="status" className="mb-6 rounded-md border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-navy"><CircleAlert aria-hidden="true" className="size-4" /> This email cannot be approved or sent yet</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      {editable ? (
        <Panel title="Message" className="mb-6">
          <ActionForm action={saveDraft} submitLabel="Save changes">
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="template_id" value={m.template_id ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="From" htmlFor="ms-sender">
                <select id="ms-sender" name="sender_id" defaultValue={m.sender_id ?? ""} className={adminInput}>
                  {(senders ?? []).map((x) => <option key={x.id} value={x.id}>{x.display_name} &lt;{x.email}&gt;</option>)}
                </select>
              </AdminField>
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-semibold uppercase tracking-wide text-navy">When saved</legend>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="intent" value="draft" defaultChecked={m.status === "draft"} className="accent-brand-red" /> Keep as a draft</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="intent" value="submit" defaultChecked={m.status !== "draft"} className="accent-brand-red" /> Submit for approval</label>
                {m.status === "approved" && <p className="text-xs text-slate-muted">Saving changes removes the current approval.</p>}
              </fieldset>
            </div>
            <EmailComposer subject={m.subject} body={m.body}
              vars={variablesFor({ contactName: m.to_name, company, sender: sender as Sender | null })}
              footer={footerFor({ settings, mailingAddress: settingsRow?.mailing_address ?? null, unsubscribeUrl: "https://example.com/unsubscribe", carrier: Boolean(m.carrier_id) })} />
          </ActionForm>
        </Panel>
      ) : (
        <Panel title="Message as sent" className="mb-6"><EmailPreview html={built.html} subject={built.subject} /></Panel>
      )}

      {editable && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Approval">
            {m.status === "approved" ? (
              <p className="text-sm">Approved by {who(m.approved_by)}. It has not been sent.</p>
            ) : admin ? (
              <ActionForm action={approveMessage} submitLabel="Approve this email" variant="navy" trackChanges={false}>
                <input type="hidden" name="id" value={m.id} />
                <p className="text-sm">Approving confirms the content and recipient are right. It does not send anything.</p>
              </ActionForm>
            ) : (
              <p className="text-sm">An owner or admin reviews and approves each email before it can be sent.</p>
            )}
            <form action={cancelMessage} className="mt-4">
              <input type="hidden" name="id" value={m.id} />
              <button className="text-sm font-semibold text-danger underline">Cancel this email</button>
            </form>
          </Panel>
          <Panel title="Send">
            {m.status !== "approved" ? (
              <p className="text-sm">Available after approval.</p>
            ) : !admin ? (
              <p className="text-sm">Only an owner or admin can send.</p>
            ) : !gatesPass(gates) ? (
              <div className="text-sm">
                <p>Sending is off. Complete these first:</p>
                <ul className="mt-2 list-disc pl-5">{gates.filter((g) => !g.ok).map((g) => <li key={g.key}>{g.label}</li>)}</ul>
                <p className="mt-2"><Link href="/admin/outreach/setup" className="font-semibold text-brand-red-dark underline">Sending setup</Link></p>
              </div>
            ) : (
              <ActionForm action={sendMessage} submitLabel="Send now" trackChanges={false}>
                <input type="hidden" name="id" value={m.id} />
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-brand-red" /> <span>I want to send this email to <strong>{m.to_email}</strong> now. <Send aria-hidden="true" className="inline size-3.5" /></span></label>
              </ActionForm>
            )}
          </Panel>
        </div>
      )}

      <Panel title="Delivery history">
        {events?.length ? (
          <ol className="divide-y divide-line text-sm">
            {events.map((e) => <li key={e.id} className="flex flex-wrap gap-3 py-2"><span className="w-40 text-xs text-slate-muted">{fmtDateTime(e.occurred_at)}</span><span className="font-medium text-navy">{e.event_type.replace(/^email\./, "").replace(/_/g, " ")}</span>{e.detail && <span className="text-slate-muted">{e.detail}</span>}</li>)}
          </ol>
        ) : <p className="text-sm text-slate-muted">{m.status === "sent" ? "Waiting for delivery updates from the email provider." : "Not sent yet."}</p>}
      </Panel>
    </>
  );
}
