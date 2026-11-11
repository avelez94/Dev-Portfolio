"use server";

import { getStaff, isAdminRole } from "@/lib/auth";

export type SearchHit = { kind: string; title: string; subtitle?: string; href: string };

/** Searches records the signed in user may read (RLS applies). Financial records for admins only. */
export async function globalSearch(raw: string): Promise<SearchHit[]> {
  const s = await getStaff();
  if (!s) return [];
  // Only letters, numbers and a few separators reach the query (no PostgREST filter syntax).
  const term = raw.normalize("NFKC").replace(/[^\p{L}\p{N}@\s._+-]/gu, "").trim().slice(0, 60);
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const or = (cols: string[]) => cols.map((c) => `${c}.ilike.${like}`).join(",");
  const [shippers, contacts, carriers, inquiries, freight, quotes, shipments, invoices] = await Promise.all([
    s.db.from("shipper_prospects").select("id, company, contact_name, location").or(or(["company", "contact_name", "email"])).limit(8),
    s.db.from("shipper_contacts").select("shipper_id, name, email").or(or(["name", "email"])).limit(5),
    s.db.from("carrier_leads").select("id, company_name, mc_number, usdot_number").or(or(["company_name", "contact_name", "email", "mc_number", "usdot_number"])).limit(8),
    s.db.from("contact_inquiries").select("id, reference, name, company, inquiry_type").or(or(["reference", "name", "company", "email"])).limit(6),
    s.db.from("quote_inquiries").select("id, reference, company_name").or(or(["reference", "company_name", "contact_name", "email"])).limit(5),
    s.db.from("quotes").select("id, reference, origin_city, dest_city").or(or(["reference", "origin_city", "dest_city"])).limit(5),
    s.db.from("shipments").select("id, reference, origin_city, dest_city, status").or(or(["reference", "origin_city", "dest_city", "commodity"])).limit(5),
    isAdminRole(s.role) ? s.db.from("invoices").select("id, number, status").or(or(["number"])).limit(5) : Promise.resolve({ data: [] as { id: string; number: string; status: string }[] }),
  ]);
  const hits: SearchHit[] = [];
  shippers.data?.forEach((r) => hits.push({ kind: "Shipper", title: r.company, subtitle: [r.contact_name, r.location].filter(Boolean).join(" · "), href: `/admin/shippers/${r.id}` }));
  contacts.data?.forEach((r) => hits.push({ kind: "Contact", title: r.name, subtitle: r.email ?? undefined, href: `/admin/shippers/${r.shipper_id}#contacts` }));
  carriers.data?.forEach((r) => hits.push({ kind: "Carrier", title: r.company_name, subtitle: [r.mc_number && `MC ${r.mc_number}`, r.usdot_number && `DOT ${r.usdot_number}`].filter(Boolean).join(" · "), href: `/admin/carriers/${r.id}` }));
  inquiries.data?.forEach((r) => hits.push({ kind: "Inquiry", title: r.company || r.name, subtitle: `${r.reference} · ${r.inquiry_type.replace("_", " ")}`, href: `/admin/inquiries/contact/${r.id}` }));
  freight.data?.forEach((r) => hits.push({ kind: "Freight req.", title: r.company_name, subtitle: r.reference, href: `/admin/inquiries/quote/${r.id}` }));
  quotes.data?.forEach((r) => hits.push({ kind: "Quote", title: r.reference, subtitle: `${r.origin_city} to ${r.dest_city}`, href: `/admin/quotes/${r.id}` }));
  shipments.data?.forEach((r) => hits.push({ kind: "Shipment", title: r.reference, subtitle: `${r.origin_city} to ${r.dest_city} · ${r.status.replace("_", " ")}`, href: `/admin/shipments/${r.id}` }));
  invoices.data?.forEach((r) => hits.push({ kind: "Invoice", title: r.number, subtitle: r.status, href: `/admin/invoices/${r.id}` }));
  return hits.slice(0, 25);
}
