import Link from "next/link";
import { CalendarClock, Check, FileText, Mail, MessageSquare, Phone, Users } from "lucide-react";
import { addContact, logActivity, removeContact, scheduleFollowUp, setStage } from "@/app/admin/crm-actions";
import { activityOutcomes, activityTypes, fmtDate, fmtDateTime, prospectStatuses } from "@/config/admin";
import { businessToday } from "@/lib/metrics/period";
import { cn } from "@/lib/utils";
import { ActionForm } from "./action-form";
import { AdminField, EmptyState, Panel, adminInput, adminTextarea } from "./admin-ui";

export function nowLocalInput() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Record an activity that already happened, and optionally schedule the next follow up. */
export function ActivityForm({ target, targetId }: { target: "shipper" | "carrier"; targetId: string }) {
  const id = `act-${targetId.slice(0, 8)}`;
  return (
    <Panel title="Record an activity">
      <p className="mb-3 text-xs text-slate-muted">Log calls, emails and meetings you completed. Nothing is sent from the dashboard.</p>
      <ActionForm action={logActivity} submitLabel="Save activity" resetOnSuccess>
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="target_id" value={targetId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminField label="Type" htmlFor={`${id}-type`}><select id={`${id}-type`} name="activity_type" className={adminInput}>{activityTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></AdminField>
          <AdminField label="Direction" htmlFor={`${id}-dir`}><select id={`${id}-dir`} name="direction" className={adminInput}><option value="outbound">Outbound (we reached out)</option><option value="inbound">Inbound (they reached out)</option></select></AdminField>
          <AdminField label="When" htmlFor={`${id}-at`}><input id={`${id}-at`} name="occurred_at" type="datetime-local" defaultValue={nowLocalInput()} className={adminInput} /></AdminField>
          <AdminField label="Outcome" htmlFor={`${id}-out`} className="sm:col-span-2"><select id={`${id}-out`} name="outcome" className={adminInput}>{activityOutcomes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></AdminField>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="got_response" className="size-4 accent-brand-red" /> They responded meaningfully</label>
          <AdminField label="Summary" htmlFor={`${id}-sum`} className="sm:col-span-3"><textarea id={`${id}-sum`} name="summary" required maxLength={2000} className={adminTextarea} placeholder="What was discussed and agreed" /></AdminField>
          <AdminField label="Schedule next follow up (optional)" htmlFor={`${id}-next`}><input id={`${id}-next`} name="next_follow_up" type="date" min={businessToday()} className={adminInput} /></AdminField>
        </div>
      </ActionForm>
    </Panel>
  );
}

export function FollowUpForm({ target, targetId, current }: { target: "shipper" | "carrier"; targetId: string; current: string | null }) {
  return (
    <ActionForm action={scheduleFollowUp} submitLabel="Schedule" variant="navy" className="space-y-2">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="target_id" value={targetId} />
      <AdminField label={current ? `Next follow up: ${fmtDate(current)}. Change to` : "Schedule a follow up"} htmlFor={`fu-${targetId}`}>
        <input id={`fu-${targetId}`} name="date" type="date" min={businessToday()} required className={adminInput} />
      </AdminField>
    </ActionForm>
  );
}

const ORDER = ["researching", "contact_identified", "contacted", "responded", "qualified", "potential_customer", "active_customer"];

export function StageStepper({ status }: { status: string }) {
  const idx = ORDER.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Pipeline stage">
      {ORDER.map((st, i) => {
        const label = prospectStatuses.find((p) => p.value === st)?.label;
        const done = idx >= 0 && i <= idx;
        return (
          <li key={st} aria-current={i === idx ? "step" : undefined} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", i === idx ? "bg-navy text-white" : done ? "bg-info-soft text-info" : "bg-ivory-200 text-slate-muted")}>
            {done && i !== idx && <Check aria-hidden="true" className="size-3" />}{label}
          </li>
        );
      })}
      {status === "lost" && <li aria-current="step" className="rounded-full bg-ivory-200 px-2.5 py-1 text-xs font-semibold text-charcoal">Lost / Not Interested</li>}
    </ol>
  );
}

export function StageForm({ id, status }: { id: string; status: string }) {
  return (
    <ActionForm action={setStage} submitLabel="Update stage" variant="navy" className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-2 sm:grid-cols-2">
        <AdminField label="Move to stage" htmlFor={`stage-${id}`}>
          <select id={`stage-${id}`} name="status" defaultValue={status} className={adminInput}>{prospectStatuses.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        </AdminField>
        <AdminField label="Reason (required for Lost)" htmlFor={`lost-${id}`}><input id={`lost-${id}`} name="lost_reason" maxLength={500} className={adminInput} /></AdminField>
      </div>
    </ActionForm>
  );
}

type Contact = { id: string; name: string; title: string | null; email: string | null; phone: string | null; is_primary: boolean };
export function ContactsPanel({ shipperId, contacts, canDelete }: { shipperId: string; contacts: Contact[]; canDelete: boolean }) {
  return (
    <Panel title="Contacts">
      <div id="contacts" className="scroll-mt-24" />
      {contacts.length ? (
        <ul className="mb-4 space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-lg bg-ivory p-3 text-sm">
              <p className="font-semibold text-navy">{c.name}{c.is_primary && <span className="ml-2 rounded bg-info-soft px-1.5 py-0.5 text-[0.7rem] text-info">Primary</span>}</p>
              {c.title && <p className="text-xs text-slate-muted">{c.title}</p>}
              <p className="mt-1 flex flex-wrap gap-3 text-xs">
                {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-navy underline"><Mail aria-hidden="true" className="size-3.5" />{c.email}</a>}
                {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-navy underline"><Phone aria-hidden="true" className="size-3.5" />{c.phone}</a>}
              </p>
              {canDelete && <form action={removeContact} className="mt-1"><input type="hidden" name="id" value={c.id} /><button className="text-xs text-slate-muted hover:text-danger">Remove</button></form>}
            </li>
          ))}
        </ul>
      ) : <p className="mb-4 text-sm text-slate-muted">No contacts yet.</p>}
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-navy"><Users aria-hidden="true" className="mr-1 inline size-4" />Add a contact</summary>
        <ActionForm action={addContact} submitLabel="Add contact" resetOnSuccess className="mt-3">
          <input type="hidden" name="shipper_id" value={shipperId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Name" htmlFor="c-name"><input id="c-name" name="name" required maxLength={120} className={adminInput} /></AdminField>
            <AdminField label="Title" htmlFor="c-title"><input id="c-title" name="title" maxLength={120} className={adminInput} /></AdminField>
            <AdminField label="Email" htmlFor="c-email"><input id="c-email" name="email" type="email" className={adminInput} /></AdminField>
            <AdminField label="Phone" htmlFor="c-phone"><input id="c-phone" name="phone" maxLength={32} className={adminInput} /></AdminField>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_primary" className="size-4 accent-brand-red" /> Primary contact</label>
        </ActionForm>
      </details>
    </Panel>
  );
}

export type TimelineEvent = { at: string; kind: "stage" | "activity" | "note" | "task" | "inquiry" | "quote" | "shipment" | "invoice" | "payment" | "verification" | "document" | "exception"; title: string; detail?: string | null; href?: string };
const KIND_ICON = { stage: Check, activity: MessageSquare, note: FileText, task: CalendarClock, inquiry: Mail, quote: FileText, shipment: FileText, invoice: FileText, payment: Check, verification: Check, document: FileText, exception: CalendarClock } as const;

/** Chronological history explaining what happened and when (business time zone). */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150);
  return (
    <Panel title="Activity timeline">
      {sorted.length ? (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {sorted.map((e, i) => {
            const Icon = KIND_ICON[e.kind];
            return (
              <li key={`${e.at}-${i}`} className="relative">
                <span className="absolute -left-[1.85rem] top-0.5 flex size-5 items-center justify-center rounded-full border border-line bg-white"><Icon aria-hidden="true" className="size-3 text-navy" /></span>
                <p className="text-sm font-medium text-navy">{e.href ? <Link href={e.href} className="hover:underline">{e.title}</Link> : e.title}</p>
                {e.detail && <p className="mt-0.5 whitespace-pre-wrap text-sm text-charcoal">{e.detail}</p>}
                <p className="mt-0.5 text-xs text-slate-muted">{fmtDateTime(e.at)}</p>
              </li>
            );
          })}
        </ol>
      ) : <EmptyState>No history yet. Record an activity or add a note to start the timeline.</EmptyState>}
    </Panel>
  );
}
