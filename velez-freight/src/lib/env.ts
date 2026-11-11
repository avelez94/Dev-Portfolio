import "server-only";

/** Server only environment access. Nothing in this file may be imported by a client component. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.NOTIFY_EMAIL_FROM ?? "",
  notifyTo: process.env.NOTIFY_EMAIL_TO ?? "",
  rateLimitSalt: process.env.RATE_LIMIT_SALT ?? "",
  /**
   * Master switch for brokerage operations. Must be "true" exactly. Set it only after broker
   * authority, financial security (BMC-84/85) and process agent (BOC-3) filings are verified active.
   */
  brokerAuthorityActive: process.env.BROKER_AUTHORITY_ACTIVE === "true",
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey);
}

export function isEmailConfigured() {
  return Boolean(env.resendApiKey && env.emailFrom && env.notifyTo);
}
