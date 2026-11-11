"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { prospectStatuses } from "@/config/admin";
import type { ActionState } from "./actions";

const form = (fd: FormData) => Object.fromEntries(fd.entries()) as Record<string, string>;
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const uuid = z.uuid();
const fail = (e: unknown): ActionState => ({ error: e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong. Please try again." });

/**
 * Records an activity a person already performed (call, email, meeting). Nothing is sent from
 * here. Optionally schedules the next follow up, which creates exactly one task for that date.
 */
export async function logActivity(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const v = z.object({
      target: z.enum(["shipper", "carrier"]),
      target_id: uuid,
      activity_type: z.enum(["call", "email", "meeting", "text", "other"]),
      direction: z.enum(["outbound", "inbound"]),
      outcome: z.enum(["completed", "no_answer", "left_message", "bounced", "scheduled"]),
      got_response: z.string().optional().transform((x) => x === "on"),
      occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose when it happened."),
      summary: z.string().trim().min(1, "Add a short summary.").max(2000),
      next_follow_up: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).transform((x) => x || null),
    }).parse(form(fd));
    // Interpreted as business local time (America/New_York); stored as UTC.
    const occurred = new Date(new Date(`${v.occurred_at}:00Z`).getTime() + offsetMinutes(v.occurred_at) * 60_000);
    if (occurred.getTime() > Date.now() + 5 * 60_000) return { error: "Only record activities that already happened. Use a follow up for future work." };
    const { error } = await s.db.from("crm_activities").insert({
      shipper_id: v.target === "shipper" ? v.target_id : null, carrier_id: v.target === "carrier" ? v.target_id : null,
      activity_type: v.activity_type, direction: v.direction, outcome: v.outcome, got_response: v.got_response,
      occurred_at: occurred.toISOString(), summary: v.summary, created_by: s.userId,
    });
    if (error) throw error;
    if (v.next_follow_up) await scheduleFollowUpInternal(s, v.target, v.target_id, v.next_follow_up);
    await audit({ actorType: "admin", actorId: s.userId, action: "crm_activity.logged", entityType: v.target === "shipper" ? "shipper_prospect" : "carrier_lead", entityId: v.target_id, metadata: { type: v.activity_type, outcome: v.outcome } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: v.next_follow_up ? "Activity recorded and follow up scheduled." : "Activity recorded." };
  } catch (e) {
    return fail(e);
  }
}

/** Minutes to add to a naive local time to reach UTC, for America/New_York on that date. */
function offsetMinutes(local: string) {
  const asUtc = new Date(`${local}:00Z`);
  const ny = new Date(asUtc.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((utc.getTime() - ny.getTime()) / 60_000);
}

type Session = Awaited<ReturnType<typeof requireStaff>>;
async function scheduleFollowUpInternal(s: Session, target: "shipper" | "carrier", id: string, date: string) {
  if (target === "shipper") {
    const { data: p } = await s.db.from("shipper_prospects").update({ next_follow_up: date }).eq("id", id).select("company, contact_name").single();
    // Same key as the workflow rule, so the rule never creates a duplicate for this date.
    await s.db.from("follow_up_tasks").insert({
      title: `Follow up with ${p?.company ?? "shipper"}`, category: "follow_up", priority_tier: 4, due_date: date, entity_type: "shipper_prospect", entity_id: id,
      recommended_action: `Contact ${p?.contact_name ?? "the shipper"} and log the outcome as an activity.`, dedupe_key: `prospect_follow_up:${id}:${date}`,
      created_by: s.userId, assigned_to: s.userId,
    });
  } else {
    await s.db.from("carrier_leads").update({ next_follow_up: date }).eq("id", id);
    await s.db.from("follow_up_tasks").insert({ title: "Follow up with carrier", category: "carrier_verification", priority_tier: 5, due_date: date, entity_type: "carrier_lead", entity_id: id, created_by: s.userId, assigned_to: s.userId });
  }
}

export async function scheduleFollowUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  const v = z.object({ target: z.enum(["shipper", "carrier"]), target_id: uuid, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.") }).safeParse(form(fd));
  if (!v.success) return { error: "Choose a follow up date." };
  await scheduleFollowUpInternal(s, v.data.target, v.data.target_id, v.data.date);
  await audit({ actorType: "admin", actorId: s.userId, action: "follow_up.scheduled", entityType: v.data.target === "shipper" ? "shipper_prospect" : "carrier_lead", entityId: v.data.target_id, metadata: { date: v.data.date } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Follow up scheduled for ${v.data.date}.` };
}

/** Moves a shipper to a pipeline stage. The database records the change in stage history. */
export async function setStage(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const v = z.object({ id: uuid, status: z.enum(prospectStatuses.map((p) => p.value) as [string, ...string[]]), lost_reason: opt(500) }).parse(form(fd));
    if (v.status === "lost" && !v.lost_reason) return { error: "Add a short reason when marking a shipper Lost / Not Interested." };
    const { data: before } = await s.db.from("shipper_prospects").select("status").eq("id", v.id).single();
    if (before?.status === v.status) return { ok: true, message: "Stage unchanged." };
    const { error } = await s.db.from("shipper_prospects").update({ status: v.status, lost_reason: v.status === "lost" ? v.lost_reason : null }).eq("id", v.id);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "shipper_prospect.stage_changed", entityType: "shipper_prospect", entityId: v.id, metadata: { from: before?.status, to: v.status } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Stage updated and recorded in history." };
  } catch (e) {
    return fail(e);
  }
}

export async function addContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const v = z.object({
      shipper_id: uuid, name: z.string().trim().min(1, "Name is required.").max(120), title: opt(120),
      email: z.string().trim().toLowerCase().optional().transform((x) => x || null).pipe(z.union([z.null(), z.email("Enter a valid email.")])),
      phone: opt(32), is_primary: z.string().optional().transform((x) => x === "on"),
    }).parse(form(fd));
    if (v.is_primary) await s.db.from("shipper_contacts").update({ is_primary: false }).eq("shipper_id", v.shipper_id);
    const { error } = await s.db.from("shipper_contacts").insert(v);
    if (error) throw error;
    if (v.is_primary) await s.db.from("shipper_prospects").update({ contact_name: v.name, email: v.email, phone: v.phone }).eq("id", v.shipper_id);
    await audit({ actorType: "admin", actorId: s.userId, action: "shipper_contact.created", entityType: "shipper_prospect", entityId: v.shipper_id });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Contact added." };
  } catch (e) {
    return fail(e);
  }
}

export async function removeContact(fd: FormData) {
  const s = await requireAdmin();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const { data } = await s.db.from("shipper_contacts").delete().eq("id", id.data).select("shipper_id").maybeSingle();
  await audit({ actorType: "admin", actorId: s.userId, action: "shipper_contact.deleted", entityType: "shipper_prospect", entityId: data?.shipper_id });
  revalidatePath("/admin", "layout");
}

/** Records a verification check with its source. Evidence rows are append only. */
export async function recordVerification(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const v = z.object({
      carrier_id: uuid, check_type: z.enum(["authority", "insurance", "safety", "identity", "agreement"]), result: z.enum(["pass", "fail", "needs_review"]),
      source: z.string().trim().min(2, "Name the source you checked (for example FMCSA SAFER).").max(200), evidence_reference: opt(300), notes: opt(1000),
      checked_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you checked."),
    }).parse(form(fd));
    const { error } = await s.db.from("carrier_verifications").insert({ ...v, checked_by: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "carrier_verification.recorded", entityType: "carrier_lead", entityId: v.carrier_id, metadata: { check: v.check_type, result: v.result } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Verification check recorded." };
  } catch (e) {
    return fail(e);
  }
}

export async function recordDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const v = z.object({
      entity_type: z.enum(["shipment", "carrier_lead", "shipper_prospect"]), entity_id: uuid,
      doc_type: z.enum(["rate_confirmation", "bol", "pod", "insurance_certificate", "carrier_agreement", "w9", "other"]),
      reference: opt(200), expires_on: z.string().optional().transform((x) => x || null), notes: opt(1000),
    }).parse(form(fd));
    const { error } = await s.db.from("documents").insert({ ...v, recorded_by: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "document.recorded", entityType: v.entity_type, entityId: v.entity_id, metadata: { type: v.doc_type } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Document recorded." };
  } catch (e) {
    return fail(e);
  }
}
