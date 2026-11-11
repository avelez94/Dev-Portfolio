import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Service role client. Bypasses RLS, so it is used ONLY inside server side handlers that have
 * already validated input (public submissions) or verified an admin session (admin actions).
 * Never return this client or its raw results to the browser.
 */
export function serviceClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
