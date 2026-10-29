/**
 * Whether this deployment runs the admin in demo mode: fictional data held in
 * the browser, simulated email, meetings, scans, and payments, and no access
 * to the real database from any admin screen or admin API.
 *
 * Demo mode is on for Vercel preview deployments (they share the production
 * database, so their admin must never touch it) and wherever ADMIN_DEMO is
 * "on". ADMIN_DEMO="off" turns it off on a preview. It can never be on in
 * production. Safe to import anywhere, including the proxy.
 */
export function demoDeployment(): boolean {
  if (process.env.VERCEL_ENV === 'production') return false
  const flag = process.env.ADMIN_DEMO
  if (flag === 'off') return false
  return flag === 'on' || process.env.VERCEL_ENV === 'preview'
}

export const DEMO_LABEL = 'Demo • Fictional data • Changes are temporary.'

/**
 * The admin API routes. In demo mode the browser sends these to the demo
 * engine instead, and the proxy closes the real ones.
 */
export const REAL_ADMIN_API = /^\/api\/(admin\/data\/.+|care\/admin\/.+|invoices\/send|email\/send|meetings\/schedule|proposals|sows|contracts|contracts\/send-signed|debt-payoff)\/?$/

/**
 * The client document APIs (proposal, SOW, contract, care agreement). In demo mode, a signed
 * in admin viewing those pages on the preview uses the demo data instead, so
 * accepting a demo proposal or signing a demo contract can be tried safely.
 */
export const DEMO_PUBLIC_DOCS = /^\/api\/(?:(proposals|sows|contracts)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|care\/(agreement)\/[A-Za-z0-9_-]{32}(?:\/checkout)?)$/i
