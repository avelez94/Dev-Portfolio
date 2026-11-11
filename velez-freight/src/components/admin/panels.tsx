import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import type { StaffSession } from "@/lib/auth";
import { addNote, createTask, setTaskStatus } from "@/app/admin/actions";
import { fmtDate, fmtDateTime, type EntityType } from "@/config/admin";
import { ActionForm } from "./action-form";
import { AdminField, EmptyState, Panel, StatusBadge, adminInput, adminTextarea } from "./admin-ui";

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

export async function TasksPanel({ s, entityType, entityId, showLinked = false }: { s: StaffSession; entityType?: EntityType; entityId?: string; showLinked?: boolean }) {
  let q = s.db.from("follow_up_tasks").select("id, title, details, due_date, priority, status, entity_type, entity_id").order("status").order("due_date", { ascending: true, nullsFirst: false }).limit(200);
  if (entityType && entityId) q = q.eq("entity_type", entityType).eq("entity_id", entityId);
  const { data: tasks } = await q;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Panel title="Follow up tasks">
      <ActionForm action={createTask} submitLabel="Add task" variant="navy" resetOnSuccess className="mb-5">
        {entityType && <input type="hidden" name="entity_type" value={entityType} />}
        {entityId && <input type="hidden" name="entity_id" value={entityId} />}
        <div className="grid gap-3 sm:grid-cols-[1fr_9.5rem_7.5rem]">
          <AdminField label="Task" htmlFor={`task-title-${entityId ?? "all"}`}><input id={`task-title-${entityId ?? "all"}`} name="title" required maxLength={200} className={adminInput} /></AdminField>
          <AdminField label="Due" htmlFor={`task-due-${entityId ?? "all"}`}><input id={`task-due-${entityId ?? "all"}`} name="due_date" type="date" className={adminInput} /></AdminField>
          <AdminField label="Priority" htmlFor={`task-pri-${entityId ?? "all"}`}>
            <select id={`task-pri-${entityId ?? "all"}`} name="priority" defaultValue="normal" className={adminInput}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select>
          </AdminField>
        </div>
      </ActionForm>
      {tasks?.length ? (
        <ul className="divide-y divide-line">
          {tasks.map((t) => {
            const overdue = t.status === "open" && t.due_date && t.due_date < today;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <StatusBadge value={t.status} label={t.status === "open" ? (overdue ? "Overdue" : "Open") : t.status === "done" ? "Done" : "Cancelled"} />
                <span className={t.status !== "open" ? "text-slate-muted line-through" : "font-medium"}>{t.title}</span>
                {t.priority === "high" && <span className="text-xs font-bold uppercase text-brand-red-dark">High</span>}
                {t.due_date && <span className={`flex items-center gap-1 text-xs ${overdue ? "font-semibold text-brand-red-dark" : "text-slate-muted"}`}><CalendarClock aria-hidden="true" className="size-3.5" />{fmtDate(t.due_date)}</span>}
                {showLinked && t.entity_type && <a className="text-xs text-brand-red-dark underline" href={linkFor(t.entity_type, t.entity_id)}>Open record</a>}
                {t.status === "open" && (
                  <span className="ml-auto flex gap-1">
                    <form action={setTaskStatus}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="done" /><button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-navy hover:bg-ivory-200"><CheckCircle2 aria-hidden="true" className="size-4 text-brand-red" />Done</button></form>
                    <form action={setTaskStatus}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="cancelled" /><button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-muted hover:bg-ivory-200"><XCircle aria-hidden="true" className="size-4" />Cancel</button></form>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>No follow up tasks.</EmptyState>
      )}
    </Panel>
  );
}

export function linkFor(type: string | null, id: string | null) {
  if (!type || !id) return "/admin";
  return { shipper_prospect: `/admin/shippers/${id}`, carrier_lead: `/admin/carriers/${id}`, contact_inquiry: `/admin/inquiries/contact/${id}`, quote_inquiry: `/admin/inquiries/quote/${id}` }[type] ?? "/admin";
}
