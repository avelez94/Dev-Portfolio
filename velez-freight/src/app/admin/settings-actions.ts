"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { AFTER_HOURS, CREDENTIALS, CREDENTIAL_STATUSES, DAYS, DISPLAY_PREFS, SOCIAL_NETWORKS, type BusinessHours } from "@/config/credentials";
import { CONTENT_SLOTS } from "@/config/content-slots";
import { type ActionState, email, fail, form, optDate, text, values } from "./form-helpers";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time such as 08:00");
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"] as const;

// ---------------------------------------------------------------------------
// Contact and support: public contact details, role addresses, hours, social links
// ---------------------------------------------------------------------------
export async function saveContactSupport(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const v = z.object({
      public_email: email, public_phone: text(32),
      support_email: email, sales_email: email, carrier_email: email, billing_email: email,
      hours_timezone: z.enum(TIMEZONES),
      after_hours_support: z.enum(values(AFTER_HOURS)),
    }).parse(raw);

    const business_hours: BusinessHours = {};
    for (const d of DAYS) {
      if (raw[`${d.key}__closed`] === "on") { business_hours[d.key] = { closed: true }; continue; }
      const open = raw[`${d.key}__open`]?.trim();
      const close = raw[`${d.key}__close`]?.trim();
      if (!open && !close) continue;
      if (!open || !close) return { error: `${d.label}: enter both an opening and a closing time, or mark it closed.` };
      const o = time.parse(open), c = time.parse(close);
      if (c <= o) return { error: `${d.label}: the closing time must be after the opening time.` };
      business_hours[d.key] = { open: o, close: c };
    }

    const social_links: Record<string, string> = {};
    for (const n of SOCIAL_NETWORKS) {
      const url = raw[`social_${n.key}`]?.trim();
      if (!url) continue;
      const parsed = z.url({ protocol: /^https$/ }).max(300).safeParse(url);
      if (!parsed.success) return { error: `${n.label}: enter a full link starting with https://` };
      social_links[n.key] = parsed.data;
    }

    // Around the clock support is a public promise; it needs its own explicit confirmation.
    const after_hours_verified = v.after_hours_support === "around_the_clock" && raw.after_hours_verified === "on";
    const { error } = await s.db.from("business_settings").update({ ...v, business_hours, social_links, after_hours_verified, updated_by: s.userId }).eq("id", 1);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "contact_support.updated", entityType: "business_settings", entityId: "1", metadata: { days_with_hours: Object.keys(business_hours).length, after_hours: v.after_hours_support, after_hours_verified } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Contact and support details saved." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Public website display preferences
// ---------------------------------------------------------------------------
export async function saveDisplayPrefs(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const display_prefs = Object.fromEntries(DISPLAY_PREFS.map((p) => [p.key, raw[p.key] === "on"]));
    const { error } = await s.db.from("business_settings").update({ display_prefs, updated_by: s.userId }).eq("id", 1);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "display_prefs.updated", entityType: "business_settings", entityId: "1", metadata: display_prefs });
    revalidatePath("/", "layout");
    return { ok: true, message: "Display preferences saved. Public pages refresh within a minute." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Regulatory credentials. Verified requires evidence; public display requires verified.
// ---------------------------------------------------------------------------
export async function saveCredential(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const meta = CREDENTIALS.find((c) => c.kind === raw.kind);
    if (!meta) return { error: "Unknown credential." };
    const v = z.object({
      value: text(120),
      status: z.enum(values(CREDENTIAL_STATUSES)),
      verification_source: text(300),
      verification_reference: text(300),
      verified_on: optDate, effective_on: optDate, expires_on: optDate,
      notes: text(1000),
    }).parse(raw);
    let value = v.value;
    if (meta.numeric && value) {
      value = value.replace(/^(mc|mx|ff|usdot|dot)[\s#:-]*/i, "").replace(/\s/g, "");
      if (!/^\d{1,8}$/.test(value)) return { error: `${meta.label}: use digits only (up to 8).` };
    }
    let status = v.status;
    if (!value && status !== "not_entered") return { error: `Enter the ${meta.label} before setting its status.` };
    if (value && status === "not_entered") status = "entered";
    if (status === "verified" && (!v.verified_on || !v.verification_source)) {
      return { error: "To mark this verified, record the date it was checked and where (for example FMCSA licensing and insurance records)." };
    }
    if (v.verified_on && v.verified_on > new Date().toISOString().slice(0, 10)) return { error: "The verification date cannot be in the future." };
    const show_publicly = meta.canBePublic && !meta.private && raw.show_publicly === "on";
    if (show_publicly && status !== "verified") return { error: "Only verified credentials can be shown on the website." };

    const { data: before } = await s.db.from("regulatory_credentials").select("status, value, show_publicly").eq("kind", meta.kind).single();
    const { error } = await s.db.from("regulatory_credentials").update({
      ...v, value, status, show_publicly,
      verified_by: status === "verified" ? s.userId : null,
      updated_by: s.userId,
    }).eq("kind", meta.kind);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "credential.updated", entityType: "business_settings", entityId: "1", metadata: {
      kind: meta.kind, from_status: before?.status ?? null, to_status: status, value_changed: before?.value !== value, show_publicly,
    } });
    revalidatePath("/", "layout");
    return { ok: true, message: `${meta.label} saved${status === "verified" ? " as verified" : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Website text with version history. Empty or unchanged default text clears the override.
// ---------------------------------------------------------------------------
export async function saveSiteContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const { data: current } = await s.db.from("site_content").select("key, value, version");
    const byKey = new Map((current ?? []).map((r) => [r.key, r]));
    const changed: string[] = [];
    for (const slot of CONTENT_SLOTS) {
      if (!(slot.key in raw)) continue;
      const text = raw[slot.key].replace(/\r\n/g, "\n").trim();
      if (text.length > slot.max) return { error: `${slot.label}: keep it under ${slot.max} characters.` };
      const next = !text || text === slot.default ? null : text;
      const prev = byKey.get(slot.key);
      if ((prev?.value ?? null) === next) continue;
      const version = (prev?.version ?? 0) + 1;
      const { error } = await s.db.from("site_content").upsert({ key: slot.key, value: next, version, updated_by: s.userId }, { onConflict: "key" });
      if (error) throw error;
      const { error: vErr } = await s.db.from("site_content_versions").insert({ key: slot.key, version, value: next, created_by: s.userId });
      if (vErr) throw vErr;
      changed.push(slot.key);
    }
    if (!changed.length) return { ok: true, message: "No changes to save." };
    await audit({ actorType: "admin", actorId: s.userId, action: "site_content.updated", entityType: "business_settings", entityId: "1", metadata: { slots: changed } });
    revalidatePath("/", "layout");
    return { ok: true, message: `Saved ${changed.length} ${changed.length === 1 ? "section" : "sections"}. Public pages refresh within a minute.` };
  } catch (e) {
    return fail(e);
  }
}

export async function restoreSiteContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const id = z.coerce.number().int().positive().parse(fd.get("version_id"));
    const { data: v } = await s.db.from("site_content_versions").select("id, key, value, version").eq("id", id).single();
    if (!v) return { error: "That version was not found." };
    const { data: cur } = await s.db.from("site_content").select("version").eq("key", v.key).maybeSingle();
    const version = (cur?.version ?? 0) + 1;
    const { error } = await s.db.from("site_content").upsert({ key: v.key, value: v.value, version, updated_by: s.userId }, { onConflict: "key" });
    if (error) throw error;
    const { error: vErr } = await s.db.from("site_content_versions").insert({ key: v.key, version, value: v.value, restored_from: v.id, created_by: s.userId });
    if (vErr) throw vErr;
    await audit({ actorType: "admin", actorId: s.userId, action: "site_content.restored", entityType: "business_settings", entityId: "1", metadata: { slot: v.key, restored_version: v.version } });
    revalidatePath("/", "layout");
    return { ok: true, message: `Restored version ${v.version}.` };
  } catch (e) {
    return fail(e);
  }
}
