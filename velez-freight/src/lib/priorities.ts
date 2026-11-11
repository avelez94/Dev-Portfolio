import "server-only";
import type { StaffSession } from "@/lib/auth";
import { addDays, businessToday, daysBetween } from "@/lib/metrics/period";

export const TIERS: Record<number, { label: string; tone: "danger" | "amber" | "info" | "green" | "neutral" }> = {
  1: { label: "Critical", tone: "danger" },
  2: { label: "Risk", tone: "amber" },
  3: { label: "Time sensitive", tone: "info" },
  4: { label: "Opportunity", tone: "green" },
  5: { label: "Routine", tone: "neutral" },
};

export type TaskRow = {
  id: string; title: string; details: string | null; due_date: string | null; priority_tier: number; category: string; status: string;
  recommended_action: string | null; entity_type: string | null; entity_id: string | null; assigned_to: string | null; source: string;
  snoozed_until: string | null; created_at: string; completed_at: string | null; resolution: string | null; recurrence: string;
};
export type PriorityItem = TaskRow & { related: { label: string; href: string } | null; dueText: string; overdue: boolean };

const ENTITY = {
  shipper_prospect: { table: "shipper_prospects", col: "company", href: (id: string) => `/admin/shippers/${id}` },
  carrier_lead: { table: "carrier_leads", col: "company_name", href: (id: string) => `/admin/carriers/${id}` },
  contact_inquiry: { table: "contact_inquiries", col: "company,name", href: (id: string) => `/admin/inquiries/contact/${id}` },
  quote_inquiry: { table: "quote_inquiries", col: "company_name", href: (id: string) => `/admin/inquiries/quote/${id}` },
  quote: { table: "quotes", col: "reference", href: (id: string) => `/admin/quotes/${id}` },
  shipment: { table: "shipments", col: "reference", href: (id: string) => `/admin/shipments/${id}` },
  invoice: { table: "invoices", col: "number", href: (id: string) => `/admin/invoices/${id}` },
  carrier_bill: { table: "carrier_bills", col: "carrier_invoice_reference", href: () => `/admin/payables` },
  outreach_message: { table: "outreach_messages", col: "subject", href: (id: string) => `/admin/outreach/${id}` },
  regulatory_credential: { table: "regulatory_credentials", col: "kind", href: () => `/admin/settings?tab=compliance#credentials` },
} as const;

export const TASK_COLUMNS = "id, title, details, due_date, priority_tier, category, status, recommended_action, entity_type, entity_id, assigned_to, source, snoozed_until, created_at, completed_at, resolution, recurrence";

/** Attaches a readable related record and due text to tasks (batched, one query per record type). */
export async function describeTasks(s: StaffSession, tasks: TaskRow[]): Promise<PriorityItem[]> {
  const today = businessToday();
  const byType = new Map<string, Set<string>>();
  tasks.forEach((t) => t.entity_type && t.entity_id && byType.set(t.entity_type, (byType.get(t.entity_type) ?? new Set()).add(t.entity_id)));
  const names = new Map<string, string>();
  await Promise.all([...byType.entries()].map(async ([type, ids]) => {
    const e = ENTITY[type as keyof typeof ENTITY];
    if (!e) return;
    const { data } = await s.db.from(e.table).select(`id, ${e.col}`).in("id", [...ids]);
    (data as Record<string, string | null>[] | null)?.forEach((r) => names.set(`${type}:${r.id}`, (e.col === "company,name" ? r.company || r.name : r[e.col]) ?? "Record"));
  }));
  return tasks.map((t) => {
    const e = t.entity_type ? ENTITY[t.entity_type as keyof typeof ENTITY] : null;
    const related = e && t.entity_id ? { label: names.get(`${t.entity_type}:${t.entity_id}`) ?? "Open record", href: e.href(t.entity_id) } : null;
    let dueText = "No due date";
    let overdue = false;
    if (t.due_date) {
      const d = daysBetween(today, t.due_date);
      overdue = d < 0 && t.status === "open";
      dueText = d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : d > 1 ? `Due in ${d} days` : `${-d} day${d === -1 ? "" : "s"} overdue`;
    }
    return { ...t, related, dueText, overdue };
  });
}

/** Today's priorities: open, not snoozed, and due within two days or a critical or risk item. */
export async function loadPriorities(s: StaffSession, limit = 30): Promise<PriorityItem[]> {
  await s.db.rpc("refresh_system_tasks", { p_force: false });
  const today = businessToday();
  const { data } = await s.db
    .from("follow_up_tasks")
    .select(TASK_COLUMNS)
    .eq("status", "open")
    .or(`due_date.lte.${addDays(today, 2)},priority_tier.lte.2`)
    .order("priority_tier", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit * 2);
  const visible = ((data ?? []) as TaskRow[]).filter((t) => !t.snoozed_until || t.snoozed_until <= today).slice(0, limit);
  return describeTasks(s, visible);
}

/** Shapes a task for the interactive TaskItem component. */
export function toTaskView(t: PriorityItem) {
  const tier = TIERS[t.priority_tier] ?? TIERS[5];
  return {
    id: t.id, title: t.title, status: t.status, priority_tier: t.priority_tier, tierLabel: tier.label, tierTone: tier.tone, dueText: t.dueText, overdue: t.overdue,
    recommended_action: t.recommended_action, related: t.related, assigned_to: t.assigned_to, source: t.source, category: t.category,
    completed_at: t.completed_at, resolution: t.resolution,
  };
}

export async function loadTeam(s: StaffSession) {
  const { data } = await s.db.from("profiles").select("id, full_name, email").eq("is_active", true).order("created_at");
  return (data ?? []).map((p) => ({ id: p.id as string, name: (p.full_name || p.email) as string }));
}
