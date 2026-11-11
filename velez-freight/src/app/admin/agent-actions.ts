"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { getSettings } from "@/lib/data/settings";
import { buildExecutiveBrief } from "@/lib/agents/executive-brief";
import { type ActionState, fail, form } from "./form-helpers";

/** Only rules based agents with an implementation can run. */
const RUNNABLE = new Set(["executive_insights"]);

export async function setAgentStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const raw = form(fd);
    const key = z.string().regex(/^[a-z_]{3,40}$/).parse(raw.key);
    const enable = raw.enable === "true";
    const { data: a } = await s.db.from("agent_definitions").select("engine, requires_operational, name").eq("key", key).single();
    if (!a) return { error: "Agent not found." };
    if (enable) {
      if (a.engine === "ai") return { error: "AI agents stay off until you approve an AI provider and it is configured." };
      if (!RUNNABLE.has(key)) return { error: "This agent is not available yet." };
      if (a.requires_operational && !(await getSettings()).operational) return { error: "This agent works only once brokerage operations are enabled." };
      if (raw.confirm !== "ENABLE AGENT") return { error: "To enable this agent, type ENABLE AGENT." };
    }
    const { error } = await s.db.from("agent_definitions").update(enable ? { status: "enabled", enabled_by: s.userId, enabled_at: new Date().toISOString() } : { status: "disabled" }).eq("key", key);
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: enable ? "agent.enabled" : "agent.disabled", entityType: "agent", entityId: key });
    revalidatePath("/admin/agents");
    return { ok: true, message: `${a.name} ${enable ? "enabled" : "turned off"}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function runAgent(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const key = String(fd.get("key") ?? "");
  if (!RUNNABLE.has(key)) return { error: "This agent cannot run." };
  const { data: a } = await s.db.from("agent_definitions").select("status").eq("key", key).single();
  if (a?.status !== "enabled") return { error: "Enable the agent first." };
  const { data: run, error } = await s.db.from("agent_runs").insert({ agent_key: key, trigger: "manual", status: "running", requested_by: s.userId }).select("id").single();
  if (error || !run) return { error: "Could not start the run." };
  try {
    const brief = await buildExecutiveBrief(s);
    await s.db.from("agent_runs").update({ status: "succeeded", summary: brief.headline, output: brief, finished_at: new Date().toISOString() }).eq("id", run.id);
    await audit({ actorType: "admin", actorId: s.userId, action: "agent.run", entityType: "agent", entityId: key, metadata: { run: run.id } });
    revalidatePath("/admin/agents");
    return { ok: true, message: "Brief ready." };
  } catch (e) {
    await s.db.from("agent_runs").update({ status: "failed", error: e instanceof Error ? e.message.slice(0, 1000) : "Failed", finished_at: new Date().toISOString() }).eq("id", run.id);
    return { error: "The brief could not be prepared. Please try again." };
  }
}
