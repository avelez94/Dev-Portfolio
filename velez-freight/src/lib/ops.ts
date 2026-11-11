import "server-only";
import type { StaffSession } from "@/lib/auth";

/** Verified carriers that pass the explicit qualification rule today. */
export async function qualifiedCarriers(s: StaffSession) {
  const { data } = await s.db.from("carrier_leads").select("id, company_name").eq("verification_status", "verified").order("company_name").limit(200);
  const checks = await Promise.all((data ?? []).map(async (c) => ({ c, q: (await s.db.rpc("carrier_qualification", { p_carrier: c.id, p_on: null })).data as { qualified?: boolean } | null })));
  return checks.filter((x) => x.q?.qualified).map((x) => ({ id: x.c.id as string, name: x.c.company_name as string }));
}
