import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkFormToken } from "./form-token";
import { allowRequest, type Bucket } from "./rate-limit";
import { serviceClient } from "@/lib/supabase/service";

export type ActionResult =
  | { ok: true; reference: string; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: "validation" | "spam" | "rate_limited" | "unavailable" | "not_operational" | "server" };

export const UNAVAILABLE: ActionResult = {
  ok: false,
  code: "unavailable",
  error: "Our inquiry system is not connected yet, so nothing was sent. Please try again later.",
};

/** Common guard for every public submission: spam checks, storage availability, rate limit. */
export async function guardSubmission(
  envelope: { token: string; website?: string },
  bucket: Bucket,
): Promise<{ db: SupabaseClient } | { result: ActionResult }> {
  // Honeypot filled or token invalid: respond generically without revealing which check failed.
  if (envelope.website) return { result: { ok: false, code: "spam", error: "We could not accept this submission. Please refresh the page and try again." } };
  const token = checkFormToken(envelope.token);
  if (token === "too_fast") return { result: { ok: false, code: "spam", error: "That was quicker than expected. Please wait a moment and submit again." } };
  if (token !== "ok") return { result: { ok: false, code: "spam", error: "This form expired. Please refresh the page and try again." } };

  const db = serviceClient();
  if (!db) return { result: UNAVAILABLE };
  if (!(await allowRequest(db, bucket))) {
    return { result: { ok: false, code: "rate_limited", error: "We have received several submissions from your connection recently. Please try again in an hour." } };
  }
  return { db };
}

export function flattenErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
