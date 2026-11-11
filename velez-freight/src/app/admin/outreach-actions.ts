"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff, type StaffSession } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { serviceClient } from "@/lib/supabase/service";
import { site } from "@/config/site";
import { domainOf, gatesPass } from "@/lib/email/readiness";
import { prepareMessage, type MessageRow } from "@/lib/email/prepare";
import { makeUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { getDomainStatus, sendEmail } from "@/lib/email/provider";
import { type ActionState, fail, form, text } from "./form-helpers";

const longText = (min: number, max: number, msg?: string) => z.string().transform((x) => x.replace(/\r\n/g, "\n").trim()).pipe(z.string().min(min, msg).max(max));

const CATEGORIES = ["introduction", "follow_up", "relationship", "carrier", "launch", "quote", "shipment", "other"] as const;

// ---------------------------------------------------------------------------
// Templates (owners and admins). Each change to subject or body is a new version.
// ---------------------------------------------------------------------------
export async function saveTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  let id: string | null = null;
  try {
    const raw = form(fd);
    const v = z.object({
      name: z.string().trim().min(2).max(120),
      category: z.enum(CATEGORIES),
      description: text(300),
      subject: z.string().trim().min(1).max(200),
      body: longText(1, 20000),
    }).parse(raw);
    const requires_operational = raw.requires_operational === "on" || ["launch", "quote", "shipment"].includes(v.category);
    id = raw.id ? z.uuid().parse(raw.id) : null;
    if (id) {
      const { data: cur } = await s.db.from("email_templates").select("subject, body, version").eq("id", id).single();
      if (!cur) return { error: "Template not found." };
      const changed = cur.subject !== v.subject || cur.body !== v.body;
      const { error } = await s.db.from("email_templates").update({ ...v, requires_operational, version: changed ? cur.version + 1 : cur.version, updated_by: s.userId }).eq("id", id);
      if (error) throw error;
      await audit({ actorType: "admin", actorId: s.userId, action: "email_template.updated", entityType: "email_template", entityId: id, metadata: { new_version: changed } });
    } else {
      const { data, error } = await s.db.from("email_templates").insert({ ...v, requires_operational, created_by: s.userId, updated_by: s.userId }).select("id").single();
      if (error) throw error;
      id = data.id;
      await audit({ actorType: "admin", actorId: s.userId, action: "email_template.created", entityType: "email_template", entityId: id! });
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/outreach", "layout");
  if (!fd.get("id")) redirect(`/admin/outreach/templates/${id}?saved=1`);
  return { ok: true, message: "Template saved." };
}

export async function duplicateTemplate(fd: FormData) {
  const s = await requireAdmin();
  const id = z.uuid().parse(fd.get("id"));
  const { data: t } = await s.db.from("email_templates").select("name, category, description, subject, body, requires_operational").eq("id", id).single();
  if (!t) return;
  const { data } = await s.db.from("email_templates").insert({ ...t, name: `${t.name} (copy)`.slice(0, 120), created_by: s.userId, updated_by: s.userId }).select("id").single();
  await audit({ actorType: "admin", actorId: s.userId, action: "email_template.duplicated", entityType: "email_template", entityId: data?.id, metadata: { from: id } });
  revalidatePath("/admin/outreach", "layout");
  if (data) redirect(`/admin/outreach/templates/${data.id}`);
}

export async function setTemplateArchived(fd: FormData) {
  const s = await requireAdmin();
  const id = z.uuid().parse(fd.get("id"));
  const archived = fd.get("archived") === "true";
  await s.db.from("email_templates").update({ status: archived ? "archived" : "active", updated_by: s.userId }).eq("id", id);
  await audit({ actorType: "admin", actorId: s.userId, action: archived ? "email_template.archived" : "email_template.restored", entityType: "email_template", entityId: id });
  revalidatePath("/admin/outreach", "layout");
}

// ---------------------------------------------------------------------------
// Sender identities and sending controls (owners and admins)
// ---------------------------------------------------------------------------
export async function saveSender(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const v = z.object({
      display_name: z.string().trim().min(1).max(80),
      email: z.email().transform((x) => x.toLowerCase()),
      reply_to: z.string().trim().toLowerCase().optional().transform((x) => x || null).pipe(z.union([z.null(), z.email()])),
      title: text(120),
      signature: z.string().optional().transform((x) => x?.replace(/\r\n/g, "\n").trim() || null).pipe(z.union([z.null(), z.string().max(1000)])),
    }).parse(raw);
    const is_default = raw.is_default === "on";
    if (is_default) await s.db.from("sender_identities").update({ is_default: false }).eq("is_default", true);
    const id = raw.id ? z.uuid().parse(raw.id) : null;
    const row = { ...v, is_default, active: raw.active !== "off" };
    const { error } = id ? await s.db.from("sender_identities").update(row).eq("id", id) : await s.db.from("sender_identities").insert(row);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: id ? "sender.updated" : "sender.created", entityType: "sender_identity", entityId: id ?? undefined, metadata: { domain: domainOf(v.email) } });
    revalidatePath("/admin/outreach", "layout");
    return { ok: true, message: "Sender saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSendingControls(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const v = z.object({
      sender_domain: z.string().trim().toLowerCase().transform((x) => x.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null)
        .pipe(z.union([z.null(), z.string().regex(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Enter a domain such as example.com")])),
      outreach_daily_limit: z.coerce.number().int().min(1).max(200),
    }).parse(raw);
    const { data: before } = await s.db.from("business_settings").select("sender_domain, outreach_sending_approved").eq("id", 1).single();
    const approve = raw.outreach_sending_approved === "on";
    const next: Record<string, unknown> = { ...v, updated_by: s.userId };
    if (v.sender_domain !== before?.sender_domain) Object.assign(next, { sender_domain_status: "unknown", sender_domain_checked_at: null });
    if (approve && !before?.outreach_sending_approved) {
      if (raw.confirm_sending !== "APPROVE SENDING") return { error: "To approve sending, type APPROVE SENDING in the confirmation box." };
      Object.assign(next, { outreach_sending_approved: true, outreach_approved_at: new Date().toISOString(), outreach_approved_by: s.userId });
    } else if (!approve && before?.outreach_sending_approved) {
      Object.assign(next, { outreach_sending_approved: false });
    }
    const { error } = await s.db.from("business_settings").update(next).eq("id", 1);
    if (error) throw error;
    if (approve !== Boolean(before?.outreach_sending_approved)) {
      await audit({ actorType: "admin", actorId: s.userId, action: "outreach.sending_changed", entityType: "business_settings", entityId: "1", metadata: { approved: approve } });
    }
    revalidatePath("/admin/outreach", "layout");
    return { ok: true, message: approve ? "Saved. Sending is approved; every message still needs individual approval." : "Saved. Sending is off." };
  } catch (e) {
    return fail(e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function checkSenderDomain(_: ActionState): Promise<ActionState> {
  const s = await requireAdmin();
  const { data: b } = await s.db.from("business_settings").select("sender_domain").eq("id", 1).single();
  if (!b?.sender_domain) return { error: "Enter the sending domain first." };
  const r = await getDomainStatus(b.sender_domain);
  await s.db.from("business_settings").update({ sender_domain_status: r.status, sender_domain_checked_at: new Date().toISOString() }).eq("id", 1);
  await audit({ actorType: "admin", actorId: s.userId, action: "outreach.domain_checked", entityType: "business_settings", entityId: "1", metadata: { domain: b.sender_domain, status: r.status } });
  revalidatePath("/admin/outreach", "layout");
  if (r.error) return { error: `Could not check the domain: ${r.error}` };
  return { ok: true, message: `Domain status: ${r.status.replace(/_/g, " ")}.` };
}

// ---------------------------------------------------------------------------
// Suppression list. Unsubscribes, bounces and complaints are permanent from the dashboard.
// ---------------------------------------------------------------------------
export async function addSuppression(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const v = z.object({ email: z.email().transform((x) => x.toLowerCase()), note: text(300) }).parse(form(fd));
    const { data: existing } = await s.db.from("email_suppressions").select("reason").eq("email", v.email).maybeSingle();
    if (existing) return { ok: true, message: `Already on the list (${existing.reason}).` };
    const { error } = await s.db.from("email_suppressions").insert({ email: v.email, reason: "manual", source: "dashboard", note: v.note, created_by: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "suppression.added", entityType: "email_suppression", metadata: { domain: domainOf(v.email) } });
    revalidatePath("/admin/outreach", "layout");
    return { ok: true, message: "Address added to the do not email list." };
  } catch (e) {
    return fail(e);
  }
}

export async function removeSuppression(fd: FormData) {
  const s = await requireAdmin();
  const email = z.email().parse(fd.get("email"));
  // Only manual blocks can be lifted. People who unsubscribed or complained stay suppressed.
  await s.db.from("email_suppressions").delete().eq("email", email).eq("reason", "manual");
  await audit({ actorType: "admin", actorId: s.userId, action: "suppression.removed", entityType: "email_suppression", metadata: { domain: domainOf(email) } });
  revalidatePath("/admin/outreach", "layout");
}

// ---------------------------------------------------------------------------
// Messages: compose, approve, send, cancel
// ---------------------------------------------------------------------------
type Recipient = { to_email: string; to_name: string | null; company: string | null; shipper_id: string | null; shipper_contact_id: string | null; carrier_id: string | null };

async function resolveRecipient(s: StaffSession, raw: Record<string, string>): Promise<Recipient | { error: string }> {
  const target = raw.target ?? "";
  if (target.startsWith("contact:")) {
    const { data: c } = await s.db.from("shipper_contacts").select("id, name, email, shipper_id").eq("id", z.uuid().parse(target.slice(8))).single();
    if (!c?.email) return { error: "That contact has no email address." };
    const company = (await s.db.from("shipper_prospects").select("company").eq("id", c.shipper_id).maybeSingle()).data?.company ?? null;
    return { to_email: c.email, to_name: c.name, company, shipper_id: c.shipper_id, shipper_contact_id: c.id, carrier_id: null };
  }
  if (target.startsWith("shipper:")) {
    const { data: p } = await s.db.from("shipper_prospects").select("id, company, contact_name, email").eq("id", z.uuid().parse(target.slice(8))).single();
    if (!p?.email) return { error: "That shipper has no email address. Add a contact with an email first." };
    return { to_email: p.email, to_name: p.contact_name, company: p.company, shipper_id: p.id, shipper_contact_id: null, carrier_id: null };
  }
  if (target.startsWith("carrier:")) {
    const { data: c } = await s.db.from("carrier_leads").select("id, company_name, contact_name, email").eq("id", z.uuid().parse(target.slice(8))).single();
    if (!c?.email) return { error: "That carrier has no email address." };
    return { to_email: c.email, to_name: c.contact_name, company: c.company_name, shipper_id: null, shipper_contact_id: null, carrier_id: c.id };
  }
  return { error: "Choose who this email is for." };
}

export async function saveDraft(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  let id: string | null = null;
  let submitted = false;
  try {
    const raw = form(fd);
    const v = z.object({
      subject: z.string().trim().min(1, "Add a subject.").max(200),
      body: longText(1, 20000, "Write the message."),
      sender_id: z.uuid("Choose a sender."),
      template_id: z.string().optional().transform((x) => x || null).pipe(z.union([z.null(), z.uuid()])),
    }).parse(raw);
    submitted = raw.intent === "submit";
    id = raw.id ? z.uuid().parse(raw.id) : null;
    const status = submitted ? "pending_approval" : "draft";
    let template_version: number | null = null;
    if (v.template_id) {
      const { data: t } = await s.db.from("email_templates").select("version").eq("id", v.template_id).single();
      template_version = t?.version ?? null;
    }
    if (id) {
      const { error } = await s.db.from("outreach_messages").update({ ...v, template_version, status, approved_by: null, approved_at: null, error: null }).eq("id", id).in("status", ["draft", "pending_approval", "approved", "failed"]);
      if (error) throw error;
    } else {
      const r = await resolveRecipient(s, raw);
      if ("error" in r) return { error: r.error };
      const recipient = { to_email: r.to_email, to_name: r.to_name, shipper_id: r.shipper_id, shipper_contact_id: r.shipper_contact_id, carrier_id: r.carrier_id };
      const { data, error } = await s.db.from("outreach_messages").insert({ ...recipient, ...v, template_version, status, created_by: s.userId }).select("id").single();
      if (error) throw error;
      id = data.id;
    }
    await audit({ actorType: "admin", actorId: s.userId, action: submitted ? "outreach.submitted" : "outreach.draft_saved", entityType: "outreach_message", entityId: id! });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/outreach", "layout");
  if (!fd.get("id")) redirect(`/admin/outreach/${id}`);
  return { ok: true, message: submitted ? "Submitted for approval." : "Draft saved." };
}

export async function approveMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const id = z.uuid().parse(fd.get("id"));
    const { data: m } = await s.db.from("outreach_messages").select("*").eq("id", id).single();
    if (!m) return { error: "Message not found." };
    if (!["draft", "pending_approval"].includes(m.status)) return { error: "Only drafts or messages awaiting approval can be approved." };
    const { problems } = await prepareMessage(s, m as MessageRow);
    if (problems.length) return { error: problems.join(" ") };
    const { error } = await s.db.from("outreach_messages").update({ status: "approved", approved_by: s.userId, approved_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "outreach.approved", entityType: "outreach_message", entityId: id });
    revalidatePath("/admin/outreach", "layout");
    return { ok: true, message: "Approved. It has not been sent yet." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelMessage(fd: FormData) {
  const s = await requireStaff();
  const id = z.uuid().parse(fd.get("id"));
  await s.db.from("outreach_messages").update({ status: "cancelled" }).eq("id", id).in("status", ["draft", "pending_approval", "approved", "failed"]);
  await audit({ actorType: "admin", actorId: s.userId, action: "outreach.cancelled", entityType: "outreach_message", entityId: id });
  revalidatePath("/admin/outreach", "layout");
}

/**
 * Sends one approved message. Every gate is checked again here. The message is claimed
 * atomically (approved to sending) so a double click cannot send twice, and the provider
 * receives the message id as an idempotency key. It is recorded as sent only when the provider
 * returns its own message id.
 */
export async function sendMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const svc = serviceClient();
  if (!svc) return { error: "The database is not connected." };
  try {
    const id = z.uuid().parse(fd.get("id"));
    if (fd.get("confirm") !== "on") return { error: "Tick the box to confirm you want to send this email now." };
    const { data: m } = await s.db.from("outreach_messages").select("*").eq("id", id).single();
    if (!m) return { error: "Message not found." };
    if (m.status !== "approved") return { error: "Only approved messages can be sent." };
    const { built, problems, gates, sender, settingsRow } = await prepareMessage(s, m as MessageRow);
    if (!gatesPass(gates)) return { error: `Sending is not ready: ${gates.filter((g) => !g.ok).map((g) => g.label.toLowerCase()).join("; ")}.` };
    if (problems.length) return { error: problems.join(" ") };

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { count: sentToday } = await svc.from("outreach_messages").select("id", { count: "exact", head: true }).gte("sent_at", since.toISOString());
    if ((sentToday ?? 0) >= (settingsRow?.outreach_daily_limit ?? 25)) return { error: `Today's sending limit (${settingsRow?.outreach_daily_limit}) has been reached. Try again tomorrow or raise the limit.` };

    const { data: claimed } = await svc.from("outreach_messages").update({ status: "sending", error: null }).eq("id", id).eq("status", "approved").select("id").maybeSingle();
    if (!claimed) return { error: "This message is already being sent or has changed. Refresh the page." };

    const from = `${sender!.display_name} <${sender!.email}>`;
    const token = makeUnsubscribeToken(m.to_email)!;
    const result = await sendEmail({
      from, to: m.to_name ? `${m.to_name} <${m.to_email}>` : m.to_email, replyTo: sender!.reply_to,
      subject: built.subject, html: built.html, text: built.text, idempotencyKey: `outreach-${id}`,
      headers: { "List-Unsubscribe": `<${site.url}/api/unsubscribe?t=${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "message", value: m.reference.replace(/[^A-Za-z0-9_-]/g, "_") }],
    });

    if (!result.ok) {
      await svc.from("outreach_messages").update({ status: "failed", error: result.error }).eq("id", id);
      await audit({ actorType: "admin", actorId: s.userId, action: "outreach.send_failed", entityType: "outreach_message", entityId: id, metadata: { retryable: result.retryable } });
      revalidatePath("/admin/outreach", "layout");
      return { error: `Not sent. The provider reported: ${result.error}` };
    }
    const sentAt = new Date().toISOString();
    await svc.from("outreach_messages").update({ status: "sent", provider_message_id: result.id, sent_at: sentAt, subject: built.subject }).eq("id", id);
    await svc.from("email_events").insert({ message_id: id, provider_message_id: result.id, event_type: "sent", detail: "Accepted by the email provider" });
    // The CRM record shows the email in its activity history.
    if (m.shipper_id || m.carrier_id) {
      await svc.from("crm_activities").insert({
        shipper_id: m.shipper_id, carrier_id: m.shipper_id ? null : m.carrier_id, activity_type: "email", direction: "outbound", outcome: "completed",
        occurred_at: sentAt, summary: `Email sent: ${built.subject} (${m.reference})`.slice(0, 2000), created_by: s.userId,
      });
    }
    await audit({ actorType: "admin", actorId: s.userId, action: "outreach.sent", entityType: "outreach_message", entityId: id, metadata: { domain: domainOf(m.to_email) } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Sent. The email provider accepted the message." };
  } catch (e) {
    return fail(e);
  }
}
