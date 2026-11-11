import "server-only";
import type { StaffSession } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { LAUNCH_ITEMS } from "@/config/launch";
import { prospectStatuses } from "@/config/admin";

export type Brief = { headline: string; generatedAt: string; sections: { title: string; items: string[] }[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Executive Insights: a rules based daily brief built only from counts in your own records.
 * It reads; it never writes anything except its own run record, and it never estimates.
 */
export async function buildExecutiveBrief(s: StaffSession): Promise<Brief> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const soon = new Date(now);
  soon.setDate(now.getDate() + 30);
  const today = now.toISOString().slice(0, 10);
  const in30 = soon.toISOString().slice(0, 10);
  const week = weekAgo.toISOString();
  const settings = await getSettings();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };

  const [tasks, prospects, newProspects, outreach, sentWeek, bouncedWeek, suppressed, inquiriesWeek, inquiriesNew, carriersVerified, carriersReview, carrierInsurance, creds] = await Promise.all([
    s.db.from("follow_up_tasks").select("title, priority_tier, due_date").eq("status", "open").order("priority_tier").order("due_date", { nullsFirst: false }).limit(500),
    s.db.from("shipper_prospects").select("status"),
    count(s.db.from("shipper_prospects").select("id", head).gte("created_at", week)),
    s.db.from("outreach_messages").select("status"),
    count(s.db.from("outreach_messages").select("id", head).gte("sent_at", week)),
    count(s.db.from("outreach_messages").select("id", head).gte("sent_at", week).eq("delivery_status", "bounced")),
    count(s.db.from("email_suppressions").select("email", head)),
    count(s.db.from("contact_inquiries").select("id", head).gte("created_at", week)),
    count(s.db.from("contact_inquiries").select("id", head).eq("status", "new")),
    count(s.db.from("carrier_leads").select("id", head).eq("verification_status", "verified")),
    count(s.db.from("carrier_leads").select("id", head).eq("verification_status", "in_review")),
    count(s.db.from("carrier_leads").select("id", head).eq("verification_status", "verified").lte("insurance_expires_on", in30)),
    s.db.from("regulatory_credentials").select("kind, status, expires_on"),
  ]);

  const open = tasks.data ?? [];
  const critical = open.filter((t) => t.priority_tier === 1).length;
  const risk = open.filter((t) => t.priority_tier === 2).length;
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length;
  const stages = prospectStatuses.map((st) => ({ label: st.label, n: (prospects.data ?? []).filter((p) => p.status === st.value).length })).filter((x) => x.n > 0);
  const om = outreach.data ?? [];
  const byStatus = (st: string) => om.filter((m) => m.status === st).length;
  const cr = creds.data ?? [];
  const verified = cr.filter((c) => c.status === "verified").length;
  const expiring = cr.filter((c) => c.expires_on && c.expires_on <= in30 && (c.status === "verified" || c.status === "expired")).length;
  const launchDone = LAUNCH_ITEMS.filter((i) => settings.launchChecklist[i.key]?.status === "done").length;

  const sections: Brief["sections"] = [
    { title: "Priorities", items: [
      `${plural(open.length, "open task")}: ${critical} critical, ${risk} at risk, ${overdue} overdue.`,
      ...open.slice(0, 5).map((t) => `Next up: ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`),
    ] },
    { title: "Shippers and inquiries", items: [
      stages.length ? `Pipeline: ${stages.map((x) => `${x.label} ${x.n}`).join(", ")}.` : "No shipper records yet.",
      `${plural(newProspects, "shipper")} added in the last 7 days.`,
      `${plural(inquiriesWeek, "website inquiry", "website inquiries")} in the last 7 days; ${inquiriesNew} not yet reviewed.`,
    ] },
    { title: "Outreach", items: [
      `${byStatus("pending_approval")} waiting for approval, ${byStatus("approved")} approved but not sent, ${byStatus("failed")} failed, ${byStatus("draft")} drafts.`,
      `${plural(sentWeek, "email")} sent in the last 7 days${sentWeek ? `, ${bouncedWeek} bounced` : ""}. ${plural(suppressed, "address", "addresses")} on the do not email list.`,
    ] },
    { title: "Carriers", items: [
      `${plural(carriersVerified, "verified carrier")}, ${carriersReview} in review.`,
      carrierInsurance ? `${plural(carrierInsurance, "verified carrier")} with insurance expiring within 30 days.` : "No verified carrier insurance expires within 30 days.",
    ] },
    { title: "Business setup", items: [
      settings.operational ? "Brokerage operations are enabled." : "Prelaunch: brokerage operations are off.",
      `Launch checklist: ${launchDone} of ${LAUNCH_ITEMS.length} done.`,
      `${plural(verified, "credential")} verified${expiring ? `; ${expiring} expiring within 30 days or expired` : ""}.`,
    ] },
  ];
  const headline = critical
    ? `${plural(critical, "critical item")} need attention today.`
    : overdue ? `${plural(overdue, "task")} overdue; nothing critical.` : open.length ? "Nothing critical or overdue." : "All caught up.";
  return { headline, generatedAt: now.toISOString(), sections };
}
