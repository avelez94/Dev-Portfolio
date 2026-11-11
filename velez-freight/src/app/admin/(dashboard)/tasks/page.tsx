import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createTask } from "@/app/admin/actions";
import { taskCategories, label } from "@/config/admin";
import { businessToday } from "@/lib/metrics/period";
import { describeTasks, loadTeam, TASK_COLUMNS, TIERS, toTaskView, type TaskRow } from "@/lib/priorities";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, EmptyState, FilterBar, Pager, Panel, adminInput, adminTextarea, filterSelect } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { TaskItem } from "@/components/admin/task-item";
import { cn } from "@/lib/utils";

export const metadata = { title: "My Tasks" };
const PAGE = 30;
const VIEWS = [
  { value: "today", label: "Today", help: "Due today or earlier, not snoozed." },
  { value: "overdue", label: "Overdue", help: "Past due and still open." },
  { value: "upcoming", label: "Upcoming", help: "Due after today, or snoozed until later." },
  { value: "completed", label: "Completed", help: "Done, closed automatically, or cancelled. Reopen to undo." },
  { value: "all", label: "All open", help: "Every open task." },
] as const;

type SP = { view?: string; category?: string; tier?: string; who?: string; page?: string; new?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.value === sp.view) ? sp.view! : "today";
  const category = taskCategories.some((c) => c.value === sp.category) ? sp.category : undefined;
  const tier = ["1", "2", "3", "4", "5"].includes(sp.tier ?? "") ? Number(sp.tier) : undefined;
  const who = ["me", "unassigned"].includes(sp.who ?? "") ? sp.who : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const today = businessToday();
  await s.db.rpc("refresh_system_tasks", { p_force: false });

  let q = s.db.from("follow_up_tasks").select(TASK_COLUMNS, { count: "exact" });
  if (view === "completed") q = q.neq("status", "open").order("completed_at", { ascending: false });
  else {
    q = q.eq("status", "open");
    if (view === "today") q = q.lte("due_date", today).or(`snoozed_until.is.null,snoozed_until.lte.${today}`);
    if (view === "overdue") q = q.lt("due_date", today);
    if (view === "upcoming") q = q.or(`due_date.gt.${today},snoozed_until.gt.${today}`);
    q = q.order("priority_tier").order("due_date", { ascending: true, nullsFirst: false });
  }
  if (category) q = q.eq("category", category);
  if (tier) q = q.eq("priority_tier", tier);
  if (who === "me") q = q.eq("assigned_to", s.userId);
  if (who === "unassigned") q = q.is("assigned_to", null);
  const [{ data, count }, team] = await Promise.all([q.range((page - 1) * PAGE, page * PAGE - 1), loadTeam(s)]);
  const items = await describeTasks(s, (data ?? []) as TaskRow[]);
  const filters = Object.fromEntries(Object.entries({ view: view !== "today" ? view : undefined, category, tier: tier ? String(tier) : undefined, who }).filter(([, v]) => v)) as Record<string, string>;
  const viewHref = (v: string) => { const p = new URLSearchParams({ ...filters, view: v }); return `/admin/tasks?${p}`; };

  return (
    <>
      <PageHeader title="My Tasks" crumbs={[{ label: "My Tasks" }]} description="Every follow up and workflow item in one place. Workflow rules create tasks from your records; completing a task never sends anything to a customer or carrier." />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          <nav aria-label="Task views" className="mb-4 flex flex-wrap gap-2">
            {VIEWS.map((v) => (
              <Link key={v.value} href={viewHref(v.value)} aria-current={view === v.value ? "page" : undefined} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", view === v.value ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40")}>{v.label}</Link>
            ))}
          </nav>
          <p className="mb-3 text-xs text-slate-muted">{VIEWS.find((v) => v.value === view)?.help}</p>
          <FilterBar base="/admin/tasks" active={Boolean(category || tier || who)}>
            <input type="hidden" name="view" value={view} />
            <label className="text-xs font-semibold uppercase tracking-wide text-navy">Category<select name="category" defaultValue={category ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All</option>{taskCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy">Priority<select name="tier" defaultValue={tier ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">All</option>{Object.entries(TIERS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></label>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy">Assigned<select name="who" defaultValue={who ?? ""} className={`mt-1 block ${filterSelect}`}><option value="">Anyone</option><option value="me">Me</option><option value="unassigned">Unassigned</option></select></label>
          </FilterBar>
          {items.length ? (
            <ul className="space-y-3">{items.map((t) => <TaskItem key={t.id} t={toTaskView(t)} team={team} />)}</ul>
          ) : (
            <EmptyState>{view === "today" ? "Nothing is due today. " : view === "overdue" ? "Nothing is overdue. " : "No tasks in this view. "}{category ? `Filtered to ${label(taskCategories, category)}. ` : ""}<Link href="/admin/tasks?view=upcoming" className="font-semibold text-brand-red-dark underline">See upcoming</Link></EmptyState>
          )}
          <Pager base="/admin/tasks" params={filters} page={page} pageSize={PAGE} total={count ?? 0} />
        </div>
        <Panel title="New task" className="h-fit">
          <div id="new-task" className="scroll-mt-24" />
          <ActionForm action={createTask} submitLabel="Create task" resetOnSuccess>
            <AdminField label="Task" htmlFor="nt-title"><input id="nt-title" name="title" required maxLength={200} autoFocus={Boolean(sp.new)} className={adminInput} /></AdminField>
            <AdminField label="Details" htmlFor="nt-details"><textarea id="nt-details" name="details" maxLength={2000} className={adminTextarea} /></AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Due" htmlFor="nt-due"><input id="nt-due" name="due_date" type="date" defaultValue={today} className={adminInput} /></AdminField>
              <AdminField label="Priority" htmlFor="nt-tier"><select id="nt-tier" name="priority_tier" defaultValue="5" className={adminInput}>{Object.entries(TIERS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></AdminField>
              <AdminField label="Category" htmlFor="nt-cat"><select id="nt-cat" name="category" defaultValue="admin" className={adminInput}>{taskCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></AdminField>
              <AdminField label="Repeats" htmlFor="nt-rec"><select id="nt-rec" name="recurrence" defaultValue="none" className={adminInput}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></AdminField>
            </div>
            {team.length > 1 && <AdminField label="Assign to" htmlFor="nt-who"><select id="nt-who" name="assigned_to" defaultValue={s.userId} className={adminInput}><option value="">Unassigned</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></AdminField>}
            <p className="text-xs text-slate-muted">To link a task to a shipper or carrier, add it from that record&apos;s page.</p>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
