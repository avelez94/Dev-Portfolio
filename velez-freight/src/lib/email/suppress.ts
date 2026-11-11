import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { audit } from "@/lib/data/audit";

/** Adds an address to the do not email list. Existing entries keep their original reason. */
export async function suppress(email: string, reason: "unsubscribed" | "bounced" | "complained", source: string) {
  const db = serviceClient();
  if (!db) return false;
  const address = email.toLowerCase();
  const { data: existing } = await db.from("email_suppressions").select("email").eq("email", address).maybeSingle();
  if (existing) return true;
  const { error } = await db.from("email_suppressions").insert({ email: address, reason, source });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[suppress] failed", error.message);
    return false;
  }
  await audit({ actorType: reason === "unsubscribed" ? "public" : "system", action: `suppression.${reason}`, entityType: "email_suppression", metadata: { domain: email.split("@")[1], source } });
  return true;
}
