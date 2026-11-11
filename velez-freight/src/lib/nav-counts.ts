import "server-only";
import { cache } from "react";
import type { StaffSession } from "@/lib/auth";
import { businessToday } from "@/lib/metrics/period";

/** Sidebar badges: due or overdue tasks, unread notifications, and new inquiries. */
export const loadNavCounts = cache(async (s: StaffSession) => {
  const today = businessToday();
  const head = { count: "exact" as const, head: true };
  const [tasks, newContact, newQuote, recent] = await Promise.all([
    s.db.from("follow_up_tasks").select("id, snoozed_until").eq("status", "open").lte("due_date", today).limit(500),
    s.db.from("contact_inquiries").select("id", head).eq("status", "new"),
    s.db.from("quote_inquiries").select("id", head).eq("status", "pending_review"),
    s.db.from("notifications").select("id").order("created_at", { ascending: false }).limit(100),
  ]);
  const ids = (recent.data ?? []).map((n) => n.id as string);
  let read = 0;
  if (ids.length) {
    const { data } = await s.db.from("notification_reads").select("notification_id").eq("user_id", s.userId).in("notification_id", ids);
    read = data?.length ?? 0;
  }
  return {
    tasks: (tasks.data ?? []).filter((t) => !t.snoozed_until || (t.snoozed_until as string) <= today).length,
    notifications: ids.length - read,
    inquiries: (newContact.count ?? 0) + (newQuote.count ?? 0),
  };
});
