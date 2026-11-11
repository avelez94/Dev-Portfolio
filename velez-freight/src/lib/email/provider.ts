import "server-only";
import { env } from "@/lib/env";

// Email provider adapter. Resend today; another provider can implement the same two functions.
// The API base can point at a local stand in for automated tests; production uses Resend.
const base = () => (process.env.RESEND_API_BASE || "https://api.resend.com").replace(/\/$/, "");

export type OutboundEmail = {
  from: string; to: string; replyTo?: string | null; subject: string; html: string; text: string;
  headers?: Record<string, string>; idempotencyKey: string; tags?: { name: string; value: string }[];
};
export type SendResult = { ok: true; id: string } | { ok: false; error: string; retryable: boolean };

export async function sendEmail(msg: OutboundEmail): Promise<SendResult> {
  if (!env.resendApiKey) return { ok: false, error: "Email provider is not configured.", retryable: false };
  try {
    const res = await fetch(`${base()}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": msg.idempotencyKey },
      body: JSON.stringify({
        from: msg.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}), headers: msg.headers, tags: msg.tags,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok && data.id) return { ok: true, id: data.id };
    return { ok: false, error: (data.message || `Provider responded ${res.status}`).slice(0, 300), retryable: res.status === 429 || res.status >= 500 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "Network error", retryable: true };
  }
}

export type DomainStatus = "verified" | "pending" | "failed" | "not_found" | "unknown";

/** Looks up the sending domain's verification status with the provider (read only). */
export async function getDomainStatus(domain: string): Promise<{ status: DomainStatus; error?: string }> {
  if (!env.resendApiKey) return { status: "unknown", error: "Email provider is not configured." };
  try {
    const res = await fetch(`${base()}/domains`, { headers: { Authorization: `Bearer ${env.resendApiKey}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { status: "unknown", error: `Provider responded ${res.status}` };
    const data = (await res.json()) as { data?: { name: string; status: string }[] };
    const d = data.data?.find((x) => x.name.toLowerCase() === domain.toLowerCase());
    if (!d) return { status: "not_found" };
    if (d.status === "verified") return { status: "verified" };
    if (d.status === "failed" || d.status === "temporary_failure") return { status: "failed" };
    return { status: "pending" };
  } catch (e) {
    return { status: "unknown", error: e instanceof Error ? e.message.slice(0, 200) : "Network error" };
  }
}
