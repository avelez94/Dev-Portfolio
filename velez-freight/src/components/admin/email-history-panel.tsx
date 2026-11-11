import Link from "next/link";
import { Mail } from "lucide-react";
import type { StaffSession } from "@/lib/auth";
import { DELIVERY_STATUS, MESSAGE_STATUS } from "@/config/outreach";
import { fmtDateTime } from "@/config/admin";
import { Panel } from "@/components/admin/admin-ui";
import { StatusPill } from "@/components/admin/status-pill";

/** Emails written to this shipper or carrier, with links to compose more. */
export async function EmailHistoryPanel({ s, kind, id, recipients }: { s: StaffSession; kind: "shipper" | "carrier"; id: string; recipients: { key: string; label: string }[] }) {
  const { data: messages } = await s.db.from("outreach_messages").select("id, subject, to_email, status, delivery_status, created_at, sent_at")
    .eq(kind === "shipper" ? "shipper_id" : "carrier_id", id).order("created_at", { ascending: false }).limit(20);
  return (
    <Panel title="Email">
      {recipients.length ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {recipients.map((r) => (
            <li key={r.key}><Link href={`/admin/outreach/compose?to=${encodeURIComponent(r.key)}`} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-ivory"><Mail aria-hidden="true" className="size-3.5" /> Email {r.label}</Link></li>
          ))}
        </ul>
      ) : <p className="mb-3 text-sm text-slate-muted">Add an email address to write from the dashboard.</p>}
      {messages?.length ? (
        <ul className="divide-y divide-line">
          {messages.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/outreach/${m.id}`} className="flex flex-wrap items-center gap-2 py-2 text-sm hover:bg-ivory">
                <span className="min-w-0 flex-1 truncate font-medium text-navy">{m.subject}</span>
                <StatusPill tone={MESSAGE_STATUS[m.status]?.tone ?? "muted"}>{MESSAGE_STATUS[m.status]?.label ?? m.status}</StatusPill>
                {m.status === "sent" && <span className="text-xs text-slate-muted">{DELIVERY_STATUS[m.delivery_status]}</span>}
                <span className="text-xs text-slate-muted">{fmtDateTime(m.sent_at ?? m.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-muted">No emails yet.</p>}
    </Panel>
  );
}
