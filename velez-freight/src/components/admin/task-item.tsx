"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlarmClock, ArrowRight, Check, CircleAlert, RotateCcw, UserRound } from "lucide-react";
import { completeTask, reassignTask, reopenTask, snoozeTask } from "@/app/admin/task-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TaskView = {
  id: string; title: string; status: string; priority_tier: number; tierLabel: string; tierTone: "danger" | "amber" | "info" | "green" | "neutral";
  dueText: string; overdue: boolean; recommended_action: string | null; related: { label: string; href: string } | null;
  assigned_to: string | null; source: string; category: string; completed_at?: string | null; resolution?: string | null;
};
export type Member = { id: string; name: string };

export function TaskItem({ t, team, compact = false }: { t: TaskView; team: Member[]; compact?: boolean }) {
  const [state, setState] = useState<"open" | "done" | "snoozed">(t.status === "open" ? "open" : "done");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string } | undefined>, next: typeof state, success: string) =>
    start(async () => {
      const r = await fn();
      if (r?.error) setMsg(r.error);
      else { setState(next); setMsg(success); }
    });

  if (state !== "open" && t.status === "open") {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ivory px-4 py-3 text-sm" role="status">
        <span><span className="font-medium text-navy">{t.title}</span> <span className="text-slate-muted">{msg}</span></span>
        {state === "done" && (
          <button type="button" disabled={pending} onClick={() => run(() => reopenTask(t.id), "open", "Reopened.")} className="inline-flex items-center gap-1 font-semibold text-navy hover:underline">
            <RotateCcw aria-hidden="true" className="size-4" /> Undo
          </button>
        )}
      </li>
    );
  }

  return (
    <li className={cn("rounded-lg border bg-white px-4 py-3", t.overdue ? "border-danger/30" : "border-line")}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <Badge tone={t.tierTone}>{t.tierLabel}</Badge>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-navy">{t.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-muted">
            {t.related && <Link href={t.related.href} className="font-semibold text-navy underline-offset-2 hover:underline">{t.related.label}</Link>}
            <span className={cn(t.overdue && "flex items-center gap-1 font-semibold text-danger")}>{t.overdue && <CircleAlert aria-hidden="true" className="size-3.5" />}{t.dueText}</span>
            {t.source === "system" && <span>Workflow rule</span>}
            {t.status !== "open" && t.resolution && <span className="capitalize">{t.resolution.replace("_", " ")}</span>}
          </p>
          {!compact && t.recommended_action && <p className="mt-1.5 text-sm text-charcoal"><span className="font-semibold">Next step:</span> {t.recommended_action}</p>}
        </div>
      </div>
      {t.status === "open" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {t.related && (
            <Link href={t.related.href} className="inline-flex items-center gap-1 rounded-md bg-navy px-2.5 py-1.5 font-semibold text-white hover:bg-navy-800">
              Open record <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
          <button type="button" disabled={pending} onClick={() => run(() => completeTask(t.id), "done", "Marked done.")} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 font-semibold text-navy hover:bg-ivory">
            <Check aria-hidden="true" className="size-3.5" /> Done
          </button>
          <label className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-navy">
            <AlarmClock aria-hidden="true" className="size-3.5" />
            <span className="sr-only">Snooze {t.title}</span>
            <select disabled={pending} defaultValue="" onChange={(e) => { const d = Number(e.target.value); if (d) run(() => snoozeTask(t.id, d), "snoozed", `Snoozed ${d} day${d === 1 ? "" : "s"}.`); }} className="bg-transparent font-semibold outline-none">
              <option value="" disabled>Snooze</option>
              <option value="1">1 day</option><option value="3">3 days</option><option value="7">1 week</option><option value="14">2 weeks</option>
            </select>
          </label>
          {team.length > 1 && (
            <label className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-navy">
              <UserRound aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Assign {t.title} to</span>
              <select disabled={pending} defaultValue={t.assigned_to ?? ""} onChange={(e) => start(async () => { const r = await reassignTask(t.id, e.target.value || null); setMsg(r?.error ?? "Assignment saved."); })} className="bg-transparent font-semibold outline-none">
                <option value="">Unassigned</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          {msg && <span role="status" className="text-slate-muted">{msg}</span>}
        </div>
      )}
    </li>
  );
}
