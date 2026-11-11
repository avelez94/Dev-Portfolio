"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { addDays, businessToday } from "@/lib/metrics/period";
import type { ActionState } from "./actions";

const id = z.uuid();

async function update(taskId: string, patch: Record<string, unknown>, action: string, meta: Record<string, unknown> = {}): Promise<ActionState> {
  const s = await requireStaff();
  const parsed = id.safeParse(taskId);
  if (!parsed.success) return { error: "Invalid task." };
  const { error, data } = await s.db.from("follow_up_tasks").update(patch).eq("id", parsed.data).select("id").maybeSingle();
  if (error || !data) return { error: "That task could not be updated. It may have been changed by someone else." };
  await audit({ actorType: "admin", actorId: s.userId, action: `follow_up_task.${action}`, entityType: "follow_up_task", entityId: parsed.data, metadata: meta });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}

export async function completeTask(taskId: string): Promise<ActionState> {
  const s = await requireStaff();
  return update(taskId, { status: "done", resolution: "completed", completed_at: new Date().toISOString(), completed_by: s.userId }, "completed");
}

/** Undo for completing or cancelling a task. */
export async function reopenTask(taskId: string): Promise<ActionState> {
  return update(taskId, { status: "open", resolution: null, completed_at: null, completed_by: null }, "reopened");
}

export async function cancelTask(taskId: string): Promise<ActionState> {
  const s = await requireStaff();
  return update(taskId, { status: "cancelled", resolution: "cancelled", completed_at: new Date().toISOString(), completed_by: s.userId }, "cancelled");
}

export async function snoozeTask(taskId: string, days: number): Promise<ActionState> {
  if (![1, 3, 7, 14].includes(days)) return { error: "Choose a snooze length." };
  const until = addDays(businessToday(), days);
  return update(taskId, { snoozed_until: until }, "snoozed", { until });
}

export async function reassignTask(taskId: string, userId: string | null): Promise<ActionState> {
  const s = await requireStaff();
  if (userId) {
    const { data } = await s.db.from("profiles").select("id").eq("id", userId).eq("is_active", true).maybeSingle();
    if (!data) return { error: "Choose an active team member." };
  }
  return update(taskId, { assigned_to: userId }, "reassigned", { to: userId });
}
