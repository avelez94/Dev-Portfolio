import Link from "next/link";
import { Bell, CheckCheck, Inbox, ShieldAlert, Truck, UserRound } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/config/admin";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/admin-ui";
import { markNotificationsRead } from "@/app/admin/notification-actions";

export const metadata = { title: "Notifications" };

const ICON = { inquiry: Inbox, carrier: Truck, task: UserRound, risk: ShieldAlert, system: Bell } as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const s = await requireStaff();
  const { show } = await searchParams;
  const { data } = await s.db.from("notifications").select("id, kind, title, link, created_at").order("created_at", { ascending: false }).limit(200);
  const ids = (data ?? []).map((n) => n.id as string);
  const { data: reads } = ids.length ? await s.db.from("notification_reads").select("notification_id").eq("user_id", s.userId).in("notification_id", ids) : { data: [] };
  const read = new Set((reads ?? []).map((r) => r.notification_id as string));
  const list = (data ?? []).filter((n) => show === "all" || !read.has(n.id));
  const unread = ids.length - read.size;
  const markAll = async () => { "use server"; await markNotificationsRead(); };
  return (
    <>
      <PageHeader
        title="Notifications"
        crumbs={[{ label: "Notifications" }]}
        description="New inquiries, carrier interest, assignments and risks raised by workflow rules. Notifications stay inside this dashboard; nothing here sends email."
        actions={unread > 0 ? <form action={markAll}><button className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory"><CheckCheck aria-hidden="true" className="size-4" /> Mark all as read</button></form> : null}
      />
      <nav aria-label="Filter notifications" className="mb-5 flex gap-2 text-sm">
        <Link href="/admin/notifications" aria-current={show !== "all" ? "true" : undefined} className={`rounded-full border px-3 py-1 font-semibold ${show !== "all" ? "border-navy bg-navy text-white" : "border-line bg-white text-navy"}`}>Unread ({unread})</Link>
        <Link href="/admin/notifications?show=all" aria-current={show === "all" ? "true" : undefined} className={`rounded-full border px-3 py-1 font-semibold ${show === "all" ? "border-navy bg-navy text-white" : "border-line bg-white text-navy"}`}>All</Link>
      </nav>
      {list.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {list.map((n) => {
            const Icon = ICON[n.kind as keyof typeof ICON] ?? Bell;
            const isRead = read.has(n.id);
            const open = async () => { "use server"; await markNotificationsRead([n.id]); };
            return (
              <li key={n.id} className={`flex items-center gap-4 px-4 py-3 ${isRead ? "" : "bg-info-soft/40"}`}>
                <Icon aria-hidden="true" className={`size-5 shrink-0 ${n.kind === "risk" ? "text-warning" : "text-navy"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${isRead ? "text-charcoal" : "font-semibold text-navy"}`}>{n.title}{!isRead && <span className="sr-only"> (unread)</span>}</p>
                  <p className="text-xs text-slate-muted">{fmtDateTime(n.created_at)}</p>
                </div>
                {n.link && <Link href={n.link} className="text-sm font-semibold text-brand-red-dark hover:underline">Open</Link>}
                {!isRead && <form action={open}><button className="text-xs font-semibold text-slate-muted hover:text-navy">Mark read</button></form>}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>{show === "all" ? "No notifications yet. New website inquiries, carrier interest and assigned tasks will appear here." : "You have read everything. "}<Link href="/admin/notifications?show=all" className="font-semibold text-brand-red-dark underline">Show all</Link></EmptyState>
      )}
    </>
  );
}
