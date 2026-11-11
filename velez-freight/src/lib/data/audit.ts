import "server-only";
import { serviceClient } from "@/lib/supabase/service";

export async function audit(event: {
  actorType: "admin" | "public" | "system";
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = serviceClient();
  if (!db) return;
  const { error } = await db.from("audit_events").insert({
    actor_type: event.actorType,
    actor_id: event.actorId ?? null,
    action: event.action,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    metadata: event.metadata ?? {},
  });
  if (error) console.error("[audit] insert failed", error.message);
}
