import "server-only";
import { env } from "@/lib/env";

export type Gate = { key: string; label: string; ok: boolean; detail?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Settings = Record<string, any>;
export type Sender = { id: string; display_name: string; email: string; reply_to: string | null; title: string | null; signature: string | null; is_default: boolean; active: boolean };

export const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";

/**
 * Every condition that must hold before any outreach email can leave. All are checked again on
 * the server for each message at the moment of sending; this list only explains the state.
 */
export function outreachGates(b: Settings, senders: Sender[]): Gate[] {
  const domain = b.sender_domain as string | null;
  const onDomain = senders.filter((s) => s.active && domain && domainOf(s.email) === domain);
  return [
    { key: "provider", label: "Email provider connected", ok: Boolean(env.resendApiKey), detail: env.resendApiKey ? undefined : "Add RESEND_API_KEY in the hosting environment (with your approval)." },
    { key: "domain", label: "Sending domain verified with the provider", ok: Boolean(domain) && b.sender_domain_status === "verified", detail: domain ? `${domain}: ${String(b.sender_domain_status).replace(/_/g, " ")}` : "Choose the sending domain, then check its status." },
    { key: "sender", label: "A sender identity on the verified domain", ok: onDomain.length > 0, detail: onDomain.length ? onDomain.map((s) => s.email).join(", ") : "Add a sender address on your domain." },
    { key: "address", label: "Mailing address for the email footer", ok: Boolean(b.mailing_address), detail: b.mailing_address ? undefined : "Required by law in commercial email. Add it in Company profile." },
    { key: "unsubscribe", label: "Unsubscribe links can be signed", ok: Boolean(process.env.UNSUBSCRIBE_SECRET || process.env.FORM_TOKEN_SECRET) },
    { key: "approval", label: "Sending approved by the owner", ok: Boolean(b.outreach_sending_approved), detail: b.outreach_sending_approved ? undefined : "Off. Nothing can be sent until you approve sending." },
  ];
}

export const gatesPass = (gates: Gate[]) => gates.every((g) => g.ok);
