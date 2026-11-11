"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth";

/** Saves the current list filters as this user's default view (per browser independent). */
export async function saveView(key: string, filters: Record<string, string>) {
  const s = await requireStaff();
  const k = z.string().regex(/^[a-z_:]{2,60}$/).safeParse(key);
  if (!k.success) return { error: "Invalid view." };
  const clean = Object.fromEntries(Object.entries(filters).filter(([kk, v]) => /^[a-z_]{1,20}$/.test(kk) && typeof v === "string" && v.length <= 80 && kk !== "page"));
  const { error } = await s.db.from("report_preferences").upsert({ user_id: s.userId, report_key: k.data, filters: clean, updated_at: new Date().toISOString() });
  return error ? { error: "Could not save this view." } : { ok: true };
}

export async function loadView(key: string): Promise<Record<string, string> | null> {
  const s = await requireStaff();
  const { data } = await s.db.from("report_preferences").select("filters").eq("user_id", s.userId).eq("report_key", key).maybeSingle();
  return (data?.filters as Record<string, string> | undefined) ?? null;
}
