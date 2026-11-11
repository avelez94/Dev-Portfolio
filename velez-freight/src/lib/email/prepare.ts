import "server-only";
import type { StaffSession } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { site } from "@/config/site";
import { brand } from "@/config/brand";
import { buildEmail, type Footer } from "./render";
import { domainOf, outreachGates, type Sender } from "./readiness";
import { variablesFor } from "./variables";
import { makeUnsubscribeToken } from "./unsubscribe-token";

/** The legally required footer: who is sending, a postal address, why, and how to opt out. */
export function footerFor(o: { settings: { legalNameConfirmed: boolean; legalEntityName: string | null }; mailingAddress: string | null; unsubscribeUrl: string | null; carrier: boolean }): Footer {
  return {
    businessName: o.settings.legalNameConfirmed && o.settings.legalEntityName ? o.settings.legalEntityName : brand.name,
    mailingAddress: o.mailingAddress,
    unsubscribeUrl: o.unsubscribeUrl,
    reason: o.carrier
      ? "You are receiving this because your company operates as a motor carrier and we would like to work together."
      : "You are receiving this because of your interest in or connection with our freight services.",
  };
}

export type MessageRow = {
  id: string; reference: string; status: string; to_email: string; to_name: string | null; subject: string; body: string;
  sender_id: string | null; template_id: string | null; shipper_id: string | null; carrier_id: string | null; created_by: string | null;
};

/** Renders a message exactly as it would be sent, with every problem that blocks it. */
export async function prepareMessage(s: StaffSession, m: MessageRow) {
  const [{ data: b }, { data: senders }, { data: sup }, tpl, company] = await Promise.all([
    s.db.from("business_settings").select("*").eq("id", 1).single(),
    s.db.from("sender_identities").select("*"),
    s.db.from("email_suppressions").select("reason").eq("email", m.to_email.toLowerCase()).maybeSingle(),
    m.template_id ? s.db.from("email_templates").select("requires_operational, status, name").eq("id", m.template_id).maybeSingle() : Promise.resolve({ data: null }),
    m.shipper_id ? s.db.from("shipper_prospects").select("company").eq("id", m.shipper_id).maybeSingle().then((r) => r.data?.company ?? null)
      : m.carrier_id ? s.db.from("carrier_leads").select("company_name").eq("id", m.carrier_id).maybeSingle().then((r) => r.data?.company_name ?? null) : Promise.resolve(null),
  ]);
  const settings = await getSettings();
  const sender = ((senders ?? []) as Sender[]).find((x) => x.id === m.sender_id) ?? null;
  const token = makeUnsubscribeToken(m.to_email);
  const unsubscribeUrl = token ? `${site.url}/unsubscribe?t=${token}` : null;
  const built = buildEmail({
    subject: m.subject, body: m.body,
    vars: variablesFor({ contactName: m.to_name, company, sender, websiteDomain: b?.website_domain }),
    footer: footerFor({ settings, mailingAddress: b?.mailing_address ?? null, unsubscribeUrl, carrier: Boolean(m.carrier_id) }),
  });
  const problems: string[] = [];
  if (built.missing.length) problems.push(`Missing information for: ${built.missing.join(", ")}. Fill it in on the record or add a fallback.`);
  if (built.unknown.length) problems.push(`Unknown placeholders: ${built.unknown.join(", ")}.`);
  if (sup) problems.push(`This address is on the do not email list (${sup.reason}).`);
  if (!sender || !sender.active) problems.push("Choose an active sender.");
  else if (b?.sender_domain && domainOf(sender.email) !== b.sender_domain) problems.push(`The sender address is not on the verified domain ${b.sender_domain}.`);
  if (tpl.data?.requires_operational && !settings.operational) problems.push(`The template “${tpl.data.name}” can only be used once brokerage operations are enabled.`);
  const gates = outreachGates(b ?? {}, (senders ?? []) as Sender[]);
  return { built, problems, gates, sender, settingsRow: b, unsubscribeUrl };
}

