import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { parseArrival } from "@/lib/attribution";

/**
 * Records how an inquiry's visitor arrived. Runs after the inquiry is saved and never affects
 * it: if the value is missing or invalid, or the table is unavailable, nothing is recorded.
 */
export async function recordAttribution(kind: "contact" | "quote", inquiryId: string, inquiryType: string, raw: unknown) {
  const arrival = parseArrival(raw);
  const db = serviceClient();
  if (!db) return;
  const { error } = await db.from("inquiry_attribution").insert({
    inquiry_kind: kind, inquiry_id: inquiryId, inquiry_type: inquiryType,
    landing_page: arrival?.landing ?? null, traffic_channel: arrival?.channel ?? "unknown", search_engine: arrival?.engine ?? null,
  });
  if (error) console.warn("[attribution] not recorded:", error.message);
}
