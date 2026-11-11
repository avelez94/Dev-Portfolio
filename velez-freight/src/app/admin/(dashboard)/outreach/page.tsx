import Link from "next/link";
import { CircleAlert, CircleCheck, PenLine } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { outreachGates, gatesPass, type Sender } from "@/lib/email/readiness";
import { MESSAGE_STATUS, DELIVERY_STATUS } from "@/config/outreach";
import { fmtDateTime } from "@/config/admin";
import { Panel } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { OutreachTabs } from "./outreach-tabs";

export const metadata = { title: "Outreach" };

type Row = { id: string; reference: string; to_name: string | null; to_email: string; subject: string; status: string; delivery_status: string; created_at: string; sent_at: string | null };

function List({ items, empty }: { items: Row[]; empty: string }) {
  if (!items.length) return <p className="py-3 text-sm text-slate-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/admin/outreach/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:bg-ivory">
            <span className="min-w-0 flex-1 truncate text-sm"><span className="font-semibold text-navy">{r.subject}</span> <span className="text-slate-muted">to {r.to_name || r.to_email}</span></span>
            <StatusPill tone={MESSAGE_STATUS[r.status]?.tone ?? "muted"}>{MESSAGE_STATUS[r.status]?.label ?? r.status}</StatusPill>
            {r.status === "sent" && <span className="text-xs text-slate-muted">{DELIVERY_STATUS[r.delivery_status]}</span>}
            <span className="w-36 text-right text-xs text-slate-muted">{fmtDateTime(r.sent_at ?? r.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function OutreachPage() {
  const s = await requireStaff();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [{ data: b }, { data: senders }, { data: messages }, { count: suppressed }] = await Promise.all([
    s.db.from("business_settings").select("*").eq("id", 1).single(),
    s.db.from("sender_identities").select("*"),
    s.db.from("outreach_messages").select("id, reference, to_name, to_email, subject, status, delivery_status, created_at, sent_at").order("created_at", { ascending: false }).limit(300),
    s.db.from("email_suppressions").select("email", { count: "exact", head: true }),
  ]);
  const gates = outreachGates(b ?? {}, (senders ?? []) as Sender[]);
  const rows = (messages ?? []) as Row[];
  const by = (st: string) => rows.filter((r) => r.status === st);
  const recentSent = rows.filter((r) => r.sent_at && r.sent_at >= since.toISOString());
  const pct = (n: number) => (recentSent.length ? `${Math.round((n / recentSent.length) * 100)}%` : "None sent");
  const stats = [
    { label: "Drafts", value: by("draft").length },
    { label: "Waiting for approval", value: by("pending_approval").length },
    { label: "Approved, not sent", value: by("approved").length },
    { label: "Sent in the last 30 days", value: recentSent.length },
    { label: "Delivered (30 days)", value: pct(recentSent.filter((r) => r.delivery_status === "delivered").length) },
    { label: "Bounced (30 days)", value: pct(recentSent.filter((r) => r.delivery_status === "bounced").length) },
    { label: "Do not email list", value: suppressed ?? 0 },
    { label: "Replies", value: "Not tracked" },
  ];
  const queue = rows.filter((r) => ["pending_approval", "approved", "failed", "draft"].includes(r.status)).slice(0, 25);
  const history = rows.filter((r) => ["sent", "cancelled"].includes(r.status)).slice(0, 25);

  return (
    <>
      <PageHeader title="Outreach" crumbs={[{ label: "Outreach" }]} description="Write, approve and send emails to shippers and carriers, with every message recorded on the customer record."
        actions={<Link href="/admin/outreach/compose" className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"><PenLine aria-hidden="true" className="size-4" /> Compose email</Link>} />
      <OutreachTabs current="/admin/outreach" />

      <Panel title={gatesPass(gates) ? "Sending is ready" : "Sending is off"} className="mb-6">
        <p className="mb-3 text-sm">{gatesPass(gates) ? "All conditions are met. Each message still needs approval and a final confirmation before it is sent." : "You can write drafts and templates now. Nothing can be sent until every item below is complete."}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {gates.map((g) => (
            <li key={g.key} className="flex items-start gap-2 text-sm">
              {g.ok ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />}
              <span><span className="font-medium text-navy">{g.label}</span>{g.detail ? <span className="block text-xs text-slate-muted">{g.detail}</span> : null}<span className="sr-only">{g.ok ? " (done)" : " (not done)"}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm"><Link href="/admin/outreach/setup" className="font-semibold text-brand-red-dark underline">Open sending setup</Link></p>
      </Panel>

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="rounded-lg border border-line bg-white p-4">
            <dt className="text-xs text-slate-muted">{st.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-bold text-navy">{st.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Needs attention"><List items={queue} empty="No drafts or approvals waiting." /></Panel>
        <Panel title="Recently sent"><List items={history} empty="Nothing has been sent yet." /></Panel>
      </div>
      <p className="mt-4 text-xs text-slate-muted">Replies come to your regular inbox; reply tracking needs a connected inbox (not set up). Opens and clicks are not tracked.</p>
    </>
  );
}
