import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const LIMITS = {
  contact: { max: 5, windowSeconds: 3600 },
  launch: { max: 3, windowSeconds: 3600 },
  carrier: { max: 4, windowSeconds: 3600 },
  quote: { max: 5, windowSeconds: 3600 },
  login: { max: 8, windowSeconds: 900 },
} as const;
export type Bucket = keyof typeof LIMITS;

export async function clientKeyHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
  // Only a salted hash is stored; raw IP addresses never reach the database.
  return createHash("sha256").update(`${env.rateLimitSalt}|${ip}`).digest("hex");
}

/** Returns true when allowed. Fails closed (false) if the limiter itself errors. */
export async function allowRequest(db: SupabaseClient, bucket: Bucket) {
  const key = await clientKeyHash();
  const { max, windowSeconds } = LIMITS[bucket];
  const { data, error } = await db.rpc("check_rate_limit", { p_key_hash: key, p_bucket: bucket, p_max: max, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[rate-limit] check failed", error.message);
    return false;
  }
  return data === true;
}
