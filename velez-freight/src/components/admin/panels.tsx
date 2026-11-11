import Link from "next/link";
import type { StaffSession } from "@/lib/auth";
import { addNote, createTask } from "@/app/admin/actions";
import { describeTasks, loadTeam, TASK_COLUMNS, toTaskView, type TaskRow } from "@/lib/priorities";
import { TaskItem } from "./task-item";
import { fmtDateTime, type EntityType } from "@/config/admin";
import { ActionForm } from "./action-form";
import { AdminField, EmptyState, Panel, adminInput, adminTextarea } from "./admin-ui";

export async function NotesPanel({ s, entityType, entityId }: { s: StaffSession; entityType: EntityType; entityId: string }) {
  const { data: notes } = await s.db.from("crm_notes").select("id, body, created_at, author_id").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: false }).limit(100);
  const { data: people } = await s.db.from("profiles").select("id, full_name, email");
  const who = (id: string | null) => people?.find((p) => p.id === id)?.full_name || people?.find((p) => p.id === id)?.email || "Former user";
  return (
    <Panel title="Notes">
      <ActionForm action={addNote} submitLabel="Add note" resetOnSuccess>
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />
        <label htmlFor={`note-${entityId}`} className="sr-only">New note</label>
        <textarea id={`note-${entityId}`} name="body" required maxLength={4000} className={adminTextarea} placeholder="Call summary, next steps, details to remember" />
      </ActionForm>
      <ul className="mt-5 space-y-3">
        {(notes ?? []).map((n) => (
          <li key={n.id} className="rounded-lg bg-ivory p-3 text-sm">
            <p className="whitespace-pre-wrap leading-relaxed">{n.body}</p>
            <p className="mt-1.5 text-xs text-slate-muted">{who(n.author_id)} · {fmtDateTime(n.created_at)}</p>
          </li>
        ))}
      </ul>
      {!notes?.length && <p className="mt-4 text-sm text-slate-muted">No notes yet.</p>}
    </Panel>
  );
}

export async function TasksPanel({ s, entityType, entityId }: { s: StaffSession; entityType?: EntityType; entityId?: string; showLinked?: boolean }) {
  let q = s.db.from("follow_up_tasks").select(TASK_COLUMNS).eq("status", "open").order("priority_tier").order("due_date", { ascending: true, nullsFirst: false }).limit(50);
  if (entityType && entityId) q = q.eq("entity_type", entityType).eq("entity_id", entityId);
  const [{ data }, team] = await Promise.all([q, loadTeam(s)]);
  const items = await describeTasks(s, (data ?? []) as TaskRow[]);
  return (
    <Panel title="Open tasks" actions={<Link href="/admin/tasks" className="text-xs font-semibold text-brand-red-dark hover:underline">Task center</Link>}>
      <ActionForm action={createTask} submitLabel="Add task" variant="navy" resetOnSuccess className="mb-4">
        {entityType && <input type="hidden" name="entity_type" value={entityType} />}
        {entityId && <input type="hidden" name="entity_id" value={entityId} />}
        <div className="grid gap-3 sm:grid-cols-[1fr_9.5rem]">
          <AdminField label="Task" htmlFor={`task-title-${entityId ?? "all"}`}><input id={`task-title-${entityId ?? "all"}`} name="title" required maxLength={200} className={adminInput} /></AdminField>
          <AdminField label="Due" htmlFor={`task-due-${entityId ?? "all"}`}><input id={`task-due-${entityId ?? "all"}`} name="due_date" type="date" className={adminInput} /></AdminField>
        </div>
      </ActionForm>
      {items.length ? <ul className="space-y-2">{items.map((t) => <TaskItem key={t.id} t={toTaskView(t)} team={team} compact />)}</ul> : <EmptyState>No open tasks.</EmptyState>}
    </Panel>
  );
}

export function linkFor(type: string | null, id: string | null) {
  if (!type || !id) return "/admin";
  return { shipper_prospect: `/admin/shippers/${id}`, carrier_lead: `/admin/carriers/${id}`, contact_inquiry: `/admin/inquiries/contact/${id}`, quote_inquiry: `/admin/inquiries/quote/${id}`, quote: `/admin/quotes/${id}`, shipment: `/admin/shipments/${id}`, invoice: `/admin/invoices/${id}` }[type] ?? "/admin";
}
