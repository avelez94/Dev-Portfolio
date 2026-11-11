import Link from "next/link";
import { fmtDateTime } from "@/config/admin";
import { isAdminRole } from "@/lib/auth";
import { Panel } from "@/components/admin/admin-ui";
import type { TabProps } from "./ui";

const LABELS: Record<string, string> = {
  "business_settings.updated": "Activation and notification settings saved",
  "website_content.updated": "Website facts saved",
  "business_identity.updated": "Company profile saved",
  "launch_checklist.updated": "Launch checklist saved",
  "contact_support.updated": "Contact and support details saved",
  "display_prefs.updated": "Website display preferences saved",
  "credential.updated": "Regulatory credential updated",
  "site_content.updated": "Website text edited",
  "site_content.restored": "Website text restored from history",
  "outreach.sending_changed": "Outreach sending approval changed",
};

export async function ActivityTab({ s }: TabProps) {
  if (!isAdminRole(s.role)) return <Panel title="Activity"><p className="text-sm">Settings history is available to owners and admins.</p></Panel>;
  const { data: events } = await s.db.from("audit_events").select("id, actor_id, action, metadata, created_at").eq("entity_type", "business_settings").order("created_at", { ascending: false }).limit(60);
  const { data: people } = await s.db.from("profiles").select("id, full_name, email");
  const who = (id: string | null) => people?.find((p) => p.id === id)?.full_name || people?.find((p) => p.id === id)?.email || "System";
  return (
    <Panel title="Settings activity" actions={<Link href="/admin/audit" className="text-sm font-semibold text-brand-red-dark underline">Full audit log</Link>}>
      {events?.length ? (
        <ol className="divide-y divide-line text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2">
              <span className="w-40 shrink-0 text-xs text-slate-muted">{fmtDateTime(e.created_at)}</span>
              <span className="font-medium text-navy">{LABELS[e.action] ?? e.action}</span>
              {typeof e.metadata?.kind === "string" && <span className="text-xs text-slate-muted">({String(e.metadata.kind).replace(/_/g, " ")}{e.metadata.to_status ? `, ${String(e.metadata.to_status).replace(/_/g, " ")}` : ""})</span>}
              <span className="ml-auto text-xs">{who(e.actor_id)}</span>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-slate-muted">No settings changes recorded yet.</p>}
    </Panel>
  );
}
