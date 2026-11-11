import "server-only";
import { Resend } from "resend";
import { env, isEmailConfigured } from "@/lib/env";
import { site } from "@/config/site";
import { brand } from "@/config/brand";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Notification = { subject: string; heading: string; rows: [string, string | null | undefined][]; adminPath: string };

/**
 * Internal notification to the owner. Contains only what is needed to triage the inquiry and a
 * link to the private dashboard. Returns "skipped" when email is not configured.
 */
export async function notifyAdmin(n: Notification): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) return "skipped";
  const resend = new Resend(env.resendApiKey);
  const url = new URL(n.adminPath, site.url).toString();
  const rows = n.rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5A6470;vertical-align:top">${escape(k)}</td><td style="padding:6px 0;color:#22272B">${escape(String(v)).replace(/\n/g, "<br>")}</td></tr>`)
    .join("");
  // Branded with text and colors only: no remote images, so nothing loads from a server that
  // may not be public yet. The sender identity comes from NOTIFY_EMAIL_FROM (a verified domain).
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><div style="border-top:4px solid #E1252F;padding:20px 0"><p style="margin:0 0 14px;font-size:12px;font-weight:bold;letter-spacing:2px;color:#142839">${escape(brand.name.toUpperCase())}</p><h1 style="font-size:20px;color:#142839;margin:0 0 12px">${escape(n.heading)}</h1><table style="font-size:14px;border-collapse:collapse">${rows}</table><p style="margin-top:20px"><a href="${url}" style="background:#E1252F;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Open in the Command Center</a></p><p style="margin-top:24px;font-size:12px;color:#5A6470">Internal notification from the ${escape(brand.name)} Business Command Center. Nothing has been sent to the customer.</p></div></div>`;
  const text = `${brand.name}\n\n${n.heading}\n\n${n.rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${url}`;
  try {
    const { error } = await resend.emails.send({ from: env.emailFrom, to: env.notifyTo.split(",").map((s) => s.trim()), subject: `${n.subject} | ${brand.short}`, html, text });
    if (error) {
      console.error("[notify] send failed", error.message);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("[notify] send threw", e instanceof Error ? e.message : e);
    return "failed";
  }
}
