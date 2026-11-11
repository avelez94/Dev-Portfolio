import { Bot, Lock } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { runAgent, setAgentStatus } from "@/app/admin/agent-actions";
import type { Brief } from "@/lib/agents/executive-brief";
import { fmtDateTime } from "@/config/admin";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";

export const metadata = { title: "Agents" };

type Agent = { key: string; name: string; purpose: string; engine: "rules" | "ai"; status: string; can_read: string[]; can_prepare: string[]; never: string[]; requires_operational: boolean; enabled_at: string | null };
type Run = { id: string; agent_key: string; status: string; summary: string | null; output: Brief | null; error: string | null; started_at: string };

function BriefView({ brief }: { brief: Brief }) {
  return (
    <div className="rounded-md border border-line bg-ivory p-4">
      <p className="font-serif text-lg font-bold text-navy">{brief.headline}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {brief.sections.map((sec) => (
          <section key={sec.title}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-navy">{sec.title}</h4>
            <ul className="mt-1.5 space-y-1 text-sm">{sec.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default async function AgentsPage() {
  const s = await requireStaff();
  const admin = isAdminRole(s.role);
  const [{ data: agents }, { data: runs }, { data: approvals }] = await Promise.all([
    s.db.from("agent_definitions").select("*").order("engine", { ascending: false }).order("name"),
    admin ? s.db.from("agent_runs").select("id, agent_key, status, summary, output, error, started_at").order("started_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] as Run[] }),
    admin ? s.db.from("approval_requests").select("id, title, agent_key, created_at").eq("status", "pending") : Promise.resolve({ data: [] }),
  ]);
  const latest = ((runs ?? []) as Run[]).find((r) => r.agent_key === "executive_insights" && r.status === "succeeded");

  return (
    <>
      <PageHeader title="Agents" crumbs={[{ label: "Agents" }]} description="Assistants that read your records and prepare work for you. Every agent starts off. None can send, pay, book or verify anything on its own." />

      {latest?.output && (
        <Panel title={`Executive brief, ${fmtDateTime(latest.started_at)}`} className="mb-6"><BriefView brief={latest.output} /></Panel>
      )}

      <Panel title="Waiting for your approval" className="mb-6">
        {approvals?.length ? (
          <ul className="divide-y divide-line text-sm">{approvals.map((a) => <li key={a.id} className="py-2">{a.title} <span className="text-xs text-slate-muted">{fmtDateTime(a.created_at)}</span></li>)}</ul>
        ) : <p className="text-sm text-slate-muted">Nothing is waiting. Agents that prepare work (drafts, suggestions) would place it here for you to approve or reject.</p>}
      </Panel>

      <ul className="grid gap-4 lg:grid-cols-2">
        {((agents ?? []) as Agent[]).map((a) => {
          const enabled = a.status === "enabled";
          return (
            <li key={a.key} className="flex flex-col rounded-lg border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Bot aria-hidden="true" className="size-5 text-brand-red" />
                <h2 className="font-sans text-base font-bold text-navy">{a.name}</h2>
                <StatusPill tone={enabled ? "ok" : "muted"}>{enabled ? "On" : "Off"}</StatusPill>
                <StatusPill tone="muted">{a.engine === "rules" ? "Rules based, no AI" : "AI, not connected"}</StatusPill>
                {a.requires_operational && <StatusPill tone="muted">Once operating</StatusPill>}
              </div>
              <p className="mt-2 text-sm">{a.purpose}</p>
              <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                <div><dt className="font-bold uppercase tracking-wide text-navy">Can read</dt><dd><ul className="mt-1 space-y-0.5">{a.can_read.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-navy">Can prepare</dt><dd><ul className="mt-1 space-y-0.5">{a.can_prepare.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-navy">Never</dt><dd><ul className="mt-1 space-y-0.5">{a.never.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
              </dl>
              <div className="mt-auto pt-4">
                {!admin ? null : a.engine === "ai" ? (
                  <p className="flex items-center gap-2 text-xs text-slate-muted"><Lock aria-hidden="true" className="size-3.5" /> Stays off until you approve an AI provider. No AI service is connected or paid for.</p>
                ) : a.key !== "executive_insights" ? (
                  <p className="text-xs text-slate-muted">Planned. Its checks run today as part of your daily priorities.</p>
                ) : enabled ? (
                  <div className="flex flex-wrap items-start gap-4">
                    <ActionForm action={runAgent} submitLabel="Run now" variant="navy" trackChanges={false}><input type="hidden" name="key" value={a.key} /></ActionForm>
                    <ActionForm action={setAgentStatus} submitLabel="Turn off" variant="outline" trackChanges={false}><input type="hidden" name="key" value={a.key} /><input type="hidden" name="enable" value="false" /></ActionForm>
                  </div>
                ) : (
                  <ActionForm action={setAgentStatus} submitLabel="Enable" variant="navy" trackChanges={false}>
                    <input type="hidden" name="key" value={a.key} /><input type="hidden" name="enable" value="true" />
                    <AdminField label="To enable, type ENABLE AGENT" htmlFor={`ag-${a.key}`}><input id={`ag-${a.key}`} name="confirm" autoComplete="off" className={adminInput} /></AdminField>
                  </ActionForm>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {admin && (runs?.length ?? 0) > 0 && (
        <Panel title="Run history" className="mt-6">
          <ul className="divide-y divide-line text-sm">
            {((runs ?? []) as Run[]).map((r) => (
              <li key={r.id} className="flex flex-wrap gap-3 py-2"><span className="w-40 text-xs text-slate-muted">{fmtDateTime(r.started_at)}</span><span className="font-medium text-navy">{r.agent_key.replace(/_/g, " ")}</span><StatusPill tone={r.status === "succeeded" ? "ok" : r.status === "failed" ? "danger" : "warn"}>{r.status}</StatusPill><span>{r.summary ?? r.error}</span></li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
