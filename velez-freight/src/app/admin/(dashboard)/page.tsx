import Link from "next/link";
import { ArrowRight, Building2, Inbox, ListChecks, Truck } from "lucide-react";
import { requireStaff, isAdminRole } from "@/lib/auth";
import { fmtDate, fmtDateTime, inquiryTypeLabels, prospectStatuses } from "@/config/admin";
import { EmptyState, PageTitle, Panel, StatusBadge } from "@/components/admin/admin-ui";
import { linkFor } from "@/components/admin/panels";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const s = await requireStaff();
  const { denied } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const head = { count: "exact" as const, head: true };

  const [newContacts, pendingQuotes, carrierUnverified, openTasks, overdue, prospects, recentContacts, recentQuotes, dueTasks, activity] = await Promise.all([
    s.db.from("contact_inquiries").select("id", head).eq("status", "new"),
    s.db.from("quote_inquiries").select("id", head).eq("status", "pending_review"),
    s.db.from("carrier_leads").select("id", head).in("verification_status", ["unverified", "in_review"]),
    s.db.from("follow_up_tasks").select("id", head).eq("status", "open"),
    s.db.from("follow_up_tasks").select("id", head).eq("status", "open").lt("due_date", today),
    s.db.from("shipper_prospects").select("status"),
    s.db.from("contact_inquiries").select("id, reference, inquiry_type, name, company, status, created_at").order("created_at", { ascending: false }).limit(6),
    s.db.from("quote_inquiries").select("id, reference, company_name, status, created_at").order("created_at", { ascending: false }).limit(4),
    s.db.from("follow_up_tasks").select("id, title, due_date, entity_type, entity_id").eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }).limit(6),
    isAdminRole(s.role) ? s.db.from("audit_events").select("id, action, actor_type, created_at, entity_type, entity_id").order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: null }),
  ]);

  const byStatus = prospectStatuses.map((p) => ({ ...p, count: prospects.data?.filter((r) => r.status === p.value).length ?? 0 }));
  const stats = [
    { label: "New contact inquiries", value: newContacts.count ?? 0, href: "/admin/inquiries?status=new", icon: Inbox },
    { label: "Quote inquiries to review", value: pendingQuotes.count ?? 0, href: "/admin/inquiries?type=quote", icon: Inbox },
    { label: "Carrier leads to verify", value: carrierUnverified.count ?? 0, href: "/admin/carriers?status=unverified", icon: Truck },
    { label: "Open follow ups", value: openTasks.count ?? 0, href: "/admin/tasks", icon: ListChecks, note: overdue.count ? `${overdue.count} overdue` : undefined },
  ];
  const recent = [
    ...(recentContacts.data ?? []).map((r) => ({ id: r.id, ref: r.reference, kind: inquiryTypeLabels[r.inquiry_type], who: r.company || r.name, status: r.status, at: r.created_at, href: `/admin/inquiries/contact/${r.id}` })),
    ...(recentQuotes.data ?? []).map((r) => ({ id: r.id, ref: r.reference, kind: "Freight quote", who: r.company_name, status: r.status, at: r.created_at, href: `/admin/inquiries/quote/${r.id}` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  return (
    <>
      <PageTitle title={`Welcome${s.name ? `, ${s.name.split(" ")[0]}` : ""}`} description="New inquiries, prospects, carrier leads, and follow ups at a glance." />
      {denied && <p role="alert" className="mb-6 rounded-md border border-brand-red/40 bg-brand-red/5 p-3 text-sm">That page requires owner or admin access.</p>}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label: l, value, href, icon: Icon, note }) => (
          <li key={l}>
            <Link href={href} className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)] transition hover:border-brand-red/40">
              <Icon aria-hidden="true" className="size-5 text-brand-red" />
              <span className="mt-3 font-serif text-4xl font-bold text-navy">{value}</span>
              <span className="mt-1 text-sm text-charcoal">{l}</span>
              {note && <span className="mt-1 text-xs font-semibold text-brand-red-dark">{note}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Recent website inquiries" actions={<Link href="/admin/inquiries" className="flex items-center gap-1 text-sm font-semibold text-brand-red-dark">View all <ArrowRight aria-hidden="true" className="size-4" /></Link>}>
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm hover:bg-ivory">
                    <span className="font-mono text-xs text-slate-muted">{r.ref}</span>
                    <span className="font-semibold text-navy">{r.who}</span>
                    <span className="text-slate-muted">{r.kind}</span>
                    <span className="ml-auto flex items-center gap-3"><StatusBadge value={r.status} label={r.status.replace("_", " ")} /><span className="text-xs text-slate-muted">{fmtDateTime(r.at)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No website inquiries yet.</EmptyState>
          )}
        </Panel>

        <Panel title="Upcoming follow ups" actions={<Link href="/admin/tasks" className="text-sm font-semibold text-brand-red-dark">All tasks</Link>}>
          {dueTasks.data?.length ? (
            <ul className="space-y-2">
              {dueTasks.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <a href={linkFor(t.entity_type, t.entity_id)} className="font-medium text-navy hover:underline">{t.title}</a>
                  <span className={`text-xs ${t.due_date && t.due_date < today ? "font-semibold text-brand-red-dark" : "text-slate-muted"}`}>{t.due_date ? fmtDate(t.due_date) : "No date"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Nothing scheduled.</EmptyState>
          )}
        </Panel>

        <Panel title="Shipper pipeline" actions={<Link href="/admin/shippers" className="flex items-center gap-1 text-sm font-semibold text-brand-red-dark"><Building2 aria-hidden="true" className="size-4" /> CRM</Link>}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {byStatus.map((p) => (
              <li key={p.value}>
                <Link href={`/admin/shippers?status=${p.value}`} className="flex items-center justify-between rounded-md bg-ivory px-3 py-2 text-sm hover:bg-ivory-200">
                  <span>{p.label}</span><span className="font-bold text-navy">{p.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {activity.data && (
          <Panel title="Recent activity" actions={<Link href="/admin/activity" className="text-sm font-semibold text-brand-red-dark">Activity log</Link>}>
            <ul className="space-y-2 text-sm">
              {activity.data.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span><span className="font-medium text-navy">{a.action}</span> <span className="text-slate-muted">({a.actor_type})</span></span>
                  <span className="shrink-0 text-xs text-slate-muted">{fmtDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
