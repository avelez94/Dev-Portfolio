import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { env } from "@/lib/env";

type State = "connected" | "partial" | "off";
export type Integration = { name: string; purpose: string; state: State; detail: string };

/** Live status of each outside service, read from this deployment's configuration. Read only. */
export function integrationStatus(): Integration[] {
  const emailKey = Boolean(env.resendApiKey);
  const sender = env.emailFrom;
  return [
    { name: "Database and sign in (Supabase)", purpose: "Records, team accounts, private files, scheduled jobs", state: env.supabaseUrl && env.supabaseServiceRoleKey ? "connected" : "off", detail: env.supabaseUrl ? "Connected" : "Not configured" },
    { name: "Hosting (Vercel)", purpose: "Website and dashboard", state: process.env.VERCEL ? "connected" : "partial", detail: process.env.VERCEL ? `Running on Vercel (${process.env.VERCEL_ENV ?? "unknown"} environment)` : "Running outside Vercel (local or test)" },
    { name: "Email delivery (Resend)", purpose: "Internal alerts now; approved outreach later", state: emailKey && sender ? "partial" : "off", detail: emailKey && sender ? `API key set; sender ${sender}. Domain verification is confirmed in Settings, Email Configuration.` : "No API key or sender address yet" },
    { name: "Email delivery events", purpose: "Delivered, bounced and complaint updates", state: process.env.RESEND_WEBHOOK_SECRET ? "connected" : "off", detail: process.env.RESEND_WEBHOOK_SECRET ? "Webhook signing secret set" : "Not connected (needs a webhook signing secret)" },
    { name: "Inbound email replies", purpose: "Seeing replies inside the dashboard", state: "off", detail: "Not connected. Replies arrive in your regular inbox." },
    { name: "FMCSA records", purpose: "Checking authority, insurance and carrier records", state: "partial", detail: "Manual: the dashboard links to the official lookup pages. No automatic lookups." },
    { name: "AI assistance", purpose: "Drafts and summaries for your review", state: "off", detail: "Not connected. Requires your approval and a provider account before any use." },
    { name: "Scheduled jobs (Supabase Cron)", purpose: "Refreshes follow up tasks every 15 minutes", state: env.supabaseUrl ? "connected" : "off", detail: "Runs inside the database; no extra service" },
  ];
}

export function IntegrationsList() {
  const items = integrationStatus();
  const icon = { connected: CircleCheck, partial: CircleAlert, off: CircleDashed };
  const color = { connected: "text-success", partial: "text-warning", off: "text-slate-muted" };
  const label = { connected: "Connected", partial: "Partly set up", off: "Not connected" };
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => {
        const Icon = icon[i.state];
        return (
          <li key={i.name} className="flex gap-3 py-3">
            <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${color[i.state]}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy">{i.name} <span className={`ml-1 text-xs font-semibold ${color[i.state]}`}>{label[i.state]}</span></p>
              <p className="text-xs text-slate-muted">{i.purpose}</p>
              <p className="mt-0.5 text-sm">{i.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
