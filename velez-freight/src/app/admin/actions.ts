"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireOwner, requireStaff } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { allowRequest } from "@/lib/security/rate-limit";
import { audit } from "@/lib/data/audit";
import { contactStatuses, entityTypes, prospectStatuses, quoteStatuses, verificationStatuses } from "@/config/admin";
import { equipmentOptions } from "@/lib/validation";
import { site } from "@/config/site";

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

const values = <T extends readonly { value: string }[]>(l: T) => l.map((x) => x.value) as [string, ...string[]];
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const optDate = z.string().trim().optional().transform((v) => v || null).pipe(z.union([z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]));
const email = z.string().trim().toLowerCase().transform((v) => v || null).pipe(z.union([z.null(), z.email()]));
const digits = z.string().trim().transform((v) => v.replace(/\D/g, "") || null).pipe(z.union([z.null(), z.string().max(8)]));
const uuid = z.uuid();
const form = (fd: FormData) => Object.fromEntries(fd.entries()) as Record<string, string>;
const fail = (e: unknown): ActionState => ({ error: e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Something went wrong. Please try again." });

// ---------------------------------------------------------------------------
// Authentication (invite only; there is no public sign up anywhere in this app)
// ---------------------------------------------------------------------------
export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.email(), password: z.string().min(1).max(200) }).safeParse(form(fd));
  if (!parsed.success) return { error: "Enter your email and password." };
  const svc = serviceClient();
  const db = await sessionClient();
  if (!svc || !db) return { error: "The dashboard is not connected to its database yet. See the setup guide." };
  if (!(await allowRequest(svc, "login"))) return { error: "Too many sign in attempts. Please wait 15 minutes and try again." };

  const { data, error } = await db.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    await audit({ actorType: "public", action: "auth.sign_in_failed", metadata: { email_domain: parsed.data.email.split("@")[1] } });
    return { error: "Email or password is incorrect." };
  }
  const { data: profile } = await db.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await db.auth.signOut();
    await audit({ actorType: "public", actorId: data.user.id, action: "auth.sign_in_denied_inactive" });
    return { error: "This account does not have dashboard access. Contact the owner if you believe this is a mistake." };
  }
  await audit({ actorType: "admin", actorId: data.user.id, action: "auth.signed_in" });
  redirect("/admin");
}

export async function signOut() {
  const db = await sessionClient();
  const { data } = (await db?.auth.getUser()) ?? { data: { user: null } };
  await db?.auth.signOut();
  if (data.user) await audit({ actorType: "admin", actorId: data.user.id, action: "auth.signed_out" });
  redirect("/admin/login");
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.email() }).safeParse(form(fd));
  const svc = serviceClient();
  const db = await sessionClient();
  if (parsed.success && svc && db && (await allowRequest(svc, "login"))) {
    await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${site.url}/admin/auth/callback?next=/admin/auth/set-password` });
  }
  // Same response either way so the form cannot be used to discover accounts.
  return { ok: true, message: "If that email belongs to a dashboard account, a reset link is on its way." };
}

export async function setPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password: z.string().min(12, "Use at least 12 characters.").max(200), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] })
    .safeParse(form(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await sessionClient();
  const { data } = (await db?.auth.getUser()) ?? { data: { user: null } };
  if (!db || !data.user) return { error: "Your link has expired. Request a new one from the sign in page." };
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  await audit({ actorType: "admin", actorId: data.user.id, action: "auth.password_set" });
  redirect("/admin");
}

// ---------------------------------------------------------------------------
// Website inquiries
// ---------------------------------------------------------------------------
export async function updateInquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const kind = z.enum(["contact", "quote"]).parse(fd.get("kind"));
    const statusList = kind === "contact" ? contactStatuses : quoteStatuses;
    const v = z.object({ id: uuid, status: z.enum(values(statusList)), follow_up_date: optDate }).parse(form(fd));
    const table = kind === "contact" ? "contact_inquiries" : "quote_inquiries";
    const { data: before } = await s.db.from(table).select("status").eq("id", v.id).single();
    const { error } = await s.db
      .from(table)
      .update({ status: v.status, follow_up_date: v.follow_up_date, resolved_at: v.status === "resolved" ? new Date().toISOString() : null })
      .eq("id", v.id);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: `${table}.updated`, entityType: kind === "contact" ? "contact_inquiry" : "quote_inquiry", entityId: v.id, metadata: { from: before?.status, to: v.status, follow_up_date: v.follow_up_date } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function convertToProspect(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Invalid inquiry." };
  const { data: inq } = await s.db.from("contact_inquiries").select("*").eq("id", id.data).single();
  if (!inq) return { error: "Inquiry not found." };
  const { data, error } = await s.db
    .from("shipper_prospects")
    .insert({ company: inq.company || inq.name, contact_name: inq.name, email: inq.email, phone: inq.phone, freight_needs: inq.message, status: "responded", source: "website", source_inquiry_id: inq.id, owner_id: s.userId })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the prospect." };
  await audit({ actorType: "admin", actorId: s.userId, action: "shipper_prospect.created_from_inquiry", entityType: "shipper_prospect", entityId: data.id, metadata: { inquiry: inq.id } });
  redirect(`/admin/shippers/${data.id}`);
}

// ---------------------------------------------------------------------------
// Notes and follow up tasks
// ---------------------------------------------------------------------------
export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const v = z.object({ entity_type: z.enum(entityTypes), entity_id: uuid, body: z.string().trim().min(1, "Write a note first.").max(4000) }).parse(form(fd));
    const { error } = await s.db.from("crm_notes").insert({ ...v, author_id: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "crm_note.created", entityType: v.entity_type, entityId: v.entity_id });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Note added." };
  } catch (e) {
    return fail(e);
  }
}

export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const raw = form(fd);
    const v = z
      .object({
        title: z.string().trim().min(1, "Add a title.").max(200),
        details: z.string().trim().max(2000).optional().transform((v) => v || null),
        due_date: optDate,
        priority: z.enum(["low", "normal", "high"]).default("normal"),
        entity_type: z.union([z.literal("").transform(() => null), z.enum(entityTypes)]).optional().transform((x) => x ?? null),
        entity_id: z.union([z.literal("").transform(() => null), uuid]).optional().transform((x) => x ?? null),
      })
      .parse(raw);
    const { data, error } = await s.db.from("follow_up_tasks").insert({ ...v, created_by: s.userId, assigned_to: s.userId }).select("id").single();
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "follow_up_task.created", entityType: "follow_up_task", entityId: data.id });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Task added." };
  } catch (e) {
    return fail(e);
  }
}

export async function setTaskStatus(fd: FormData) {
  const s = await requireStaff();
  const v = z.object({ id: uuid, status: z.enum(["open", "done", "cancelled"]) }).safeParse(form(fd));
  if (!v.success) return;
  await s.db.from("follow_up_tasks").update({ status: v.data.status, completed_at: v.data.status === "done" ? new Date().toISOString() : null }).eq("id", v.data.id);
  await audit({ actorType: "admin", actorId: s.userId, action: `follow_up_task.${v.data.status}`, entityType: "follow_up_task", entityId: v.data.id });
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Shipper CRM
// ---------------------------------------------------------------------------
const prospectSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(160),
  contact_name: text(120),
  email,
  phone: text(32),
  industry: text(120),
  location: text(160),
  freight_needs: text(2000),
  status: z.enum(values(prospectStatuses)),
  notes: text(4000),
  next_follow_up: optDate,
});

export async function saveProspect(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  let id: string | null = null;
  try {
    const raw = form(fd);
    const v = prospectSchema.parse(raw);
    if (raw.id) {
      id = uuid.parse(raw.id);
      const { error } = await s.db.from("shipper_prospects").update(v).eq("id", id);
      if (error) throw error;
      await audit({ actorType: "admin", actorId: s.userId, action: "shipper_prospect.updated", entityType: "shipper_prospect", entityId: id, metadata: { status: v.status } });
      revalidatePath("/admin", "layout");
      return { ok: true, message: "Saved." };
    }
    const { data, error } = await s.db.from("shipper_prospects").insert({ ...v, owner_id: s.userId, source: "manual" }).select("id").single();
    if (error) throw error;
    id = data.id;
    await audit({ actorType: "admin", actorId: s.userId, action: "shipper_prospect.created", entityType: "shipper_prospect", entityId: data.id });
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/shippers/${id}`);
}

export async function deleteRecord(fd: FormData) {
  const s = await requireAdmin();
  const v = z.object({ id: uuid, table: z.enum(["shipper_prospects", "carrier_leads"]) }).safeParse(form(fd));
  if (!v.success) return;
  await s.db.from(v.data.table).delete().eq("id", v.data.id);
  await audit({ actorType: "admin", actorId: s.userId, action: `${v.data.table}.deleted`, entityId: v.data.id });
  redirect(v.data.table === "shipper_prospects" ? "/admin/shippers" : "/admin/carriers");
}

// ---------------------------------------------------------------------------
// Carrier leads. Verification status is a manual, human decision.
// ---------------------------------------------------------------------------
const carrierSchema = z.object({
  company_name: z.string().trim().min(1, "Company is required.").max(160),
  contact_name: text(120),
  email,
  phone: text(32),
  mc_number: digits,
  usdot_number: digits,
  operating_region: text(300),
  fleet_size: z.string().trim().transform((v) => (v ? Number(v) : null)).pipe(z.union([z.null(), z.number().int().min(1).max(100000)])),
  verification_status: z.enum(values(verificationStatuses)),
  verified_on: optDate,
  notes: text(4000),
  next_follow_up: optDate,
});

export async function saveCarrier(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  let id: string | null = null;
  try {
    const raw = form(fd);
    const v = carrierSchema.parse(raw);
    const equipment = fd.getAll("equipment").map(String).filter((e) => equipmentOptions.some((o) => o.value === e));
    if (v.verification_status === "verified" && !v.verified_on) return { error: "Record the date you verified authority and insurance before marking a carrier verified." };
    const row = { ...v, equipment };
    if (raw.id) {
      id = uuid.parse(raw.id);
      const { data: before } = await s.db.from("carrier_leads").select("verification_status").eq("id", id).single();
      const { error } = await s.db.from("carrier_leads").update(row).eq("id", id);
      if (error) throw error;
      await audit({ actorType: "admin", actorId: s.userId, action: "carrier_lead.updated", entityType: "carrier_lead", entityId: id, metadata: { verification_from: before?.verification_status, verification_to: v.verification_status } });
      revalidatePath("/admin", "layout");
      return { ok: true, message: "Saved." };
    }
    const { data, error } = await s.db.from("carrier_leads").insert({ ...row, source: "manual" }).select("id").single();
    if (error) throw error;
    id = data.id;
    await audit({ actorType: "admin", actorId: s.userId, action: "carrier_lead.created", entityType: "carrier_lead", entityId: data.id });
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/carriers/${id}`);
}

// ---------------------------------------------------------------------------
// Business settings (owners and admins). Enabling operations is a high impact action.
// ---------------------------------------------------------------------------
export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const bool = (k: string) => raw[k] === "on";
    const v = z
      .object({
        public_email: email,
        public_phone: text(32),
        mc_number: digits,
        usdot_number: digits,
        status_message: text(500),
        service_area: z.string().trim().min(2).max(120),
        authority_verified_on: optDate,
        authority_verification_note: text(2000),
      })
      .parse(raw);
    const next = {
      ...v,
      legal_name_confirmed: bool("legal_name_confirmed"),
      operations_enabled: bool("operations_enabled"),
      service_expedited: bool("service_expedited"),
      service_dedicated: bool("service_dedicated"),
      service_general: bool("service_general"),
      notify_on_contact: bool("notify_on_contact"),
      notify_on_quote: bool("notify_on_quote"),
      notify_on_carrier: bool("notify_on_carrier"),
      updated_by: s.userId,
    };
    const { data: before } = await s.db.from("business_settings").select("operations_enabled").eq("id", 1).single();
    if (next.operations_enabled && !before?.operations_enabled) {
      if (raw.confirm_operations !== "ENABLE OPERATIONS") return { error: "To enable operations, type ENABLE OPERATIONS in the confirmation box." };
      if (!next.authority_verified_on || !next.mc_number) return { error: "Record the MC number and the date broker authority was verified active before enabling operations." };
    }
    const { error } = await s.db.from("business_settings").update(next).eq("id", 1);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "business_settings.updated", entityType: "business_settings", entityId: "1", metadata: { operations_enabled: next.operations_enabled, operations_changed: before?.operations_enabled !== next.operations_enabled } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved. Public pages refresh within a minute." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Team access (owner only). Invitations are the only way to create an account.
// ---------------------------------------------------------------------------
export async function inviteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireOwner();
  const v = z.object({ email: z.email(), full_name: z.string().trim().max(120), role: z.enum(["admin", "staff"]) }).safeParse(form(fd));
  if (!v.success) return { error: "Enter a valid email and role." };
  const svc = serviceClient();
  if (!svc) return { error: "Database not configured." };
  const { data, error } = await svc.auth.admin.inviteUserByEmail(v.data.email, { redirectTo: `${site.url}/admin/auth/callback?next=/admin/auth/set-password` });
  if (error || !data.user) return { error: error?.message ?? "Invitation failed." };
  await svc.from("profiles").upsert({ id: data.user.id, email: v.data.email, full_name: v.data.full_name || null, role: v.data.role, is_active: true, invited_by: s.userId });
  await audit({ actorType: "admin", actorId: s.userId, action: "team.invited", entityType: "profile", entityId: data.user.id, metadata: { role: v.data.role } });
  revalidatePath("/admin/settings");
  return { ok: true, message: `Invitation sent to ${v.data.email}.` };
}

export async function setAccess(fd: FormData) {
  const s = await requireOwner();
  const v = z.object({ id: uuid, is_active: z.enum(["true", "false"]), role: z.enum(["owner", "admin", "staff"]) }).safeParse(form(fd));
  if (!v.success || v.data.id === s.userId) return; // owners cannot lock themselves out
  const svc = serviceClient();
  if (!svc) return;
  await svc.from("profiles").update({ is_active: v.data.is_active === "true", role: v.data.role }).eq("id", v.data.id);
  await audit({ actorType: "admin", actorId: s.userId, action: "team.access_changed", entityType: "profile", entityId: v.data.id, metadata: { is_active: v.data.is_active, role: v.data.role } });
  revalidatePath("/admin/settings");
}
