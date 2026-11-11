import "server-only";
import { brand } from "@/config/brand";
import { site } from "@/config/site";
import { firstName, type Variables } from "./render";
import type { Sender } from "./readiness";

/** Variables for one message, from the recipient record and the chosen sender. */
export function variablesFor(input: { contactName: string | null; company: string | null; sender: Sender | null; websiteDomain?: string | null }): Variables {
  const s = input.sender;
  const signature = s ? (s.signature?.trim() || [s.display_name, s.title, brand.name].filter(Boolean).join("\n")) : null;
  return {
    "contact.first_name": firstName(input.contactName),
    "contact.name": input.contactName,
    "company.name": input.company,
    "sender.name": s?.display_name,
    "sender.title": s?.title,
    "sender.email": s?.email,
    "sender.signature": signature,
    "business.name": brand.name,
    "business.website": input.websiteDomain ? `https://${input.websiteDomain}` : site.url,
  };
}
