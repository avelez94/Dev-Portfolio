"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";

/** Marks the given notifications (or all visible ones) as read for the current user. */
export async function markNotificationsRead(ids?: string[]) {
  const s = await requireStaff();
  let list = ids ?? [];
  if (!ids) {
    const { data } = await s.db.from("notifications").select("id").order("created_at", { ascending: false }).limit(200);
    list = (data ?? []).map((n) => n.id as string);
  }
  if (!list.length) return;
  const { data: already } = await s.db.from("notification_reads").select("notification_id").eq("user_id", s.userId).in("notification_id", list);
  const done = new Set((already ?? []).map((r) => r.notification_id as string));
  const rows = list.filter((id) => !done.has(id)).map((notification_id) => ({ notification_id, user_id: s.userId }));
  if (rows.length) await s.db.from("notification_reads").insert(rows);
  revalidatePath("/admin", "layout");
}
