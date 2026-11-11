import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { verifyWebhook } from "@/lib/email/webhook-signature";
import { suppress } from "@/lib/email/suppress";

// Delivery updates from the email provider. Only signed requests are accepted. Opens and clicks
// are not tracked. Each event is stored once (keyed by the webhook message id).
const DELIVERY: Record<string, "delivered" | "delayed" | "bounced" | "complained"> = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  const body = await request.text();
  const ok = verifyWebhook(secret, { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") }, body);
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  let event: { type?: string; created_at?: string; data?: { email_id?: string; to?: string[]; bounce?: { message?: string } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const status = event.type ? DELIVERY[event.type] : undefined;
  const providerId = event.data?.email_id;
  if (!status || !providerId) return NextResponse.json({ ok: true, ignored: true });

  const db = serviceClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: m } = await db.from("outreach_messages").select("id, to_email").eq("provider_message_id", providerId).maybeSingle();
  const occurred = event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? event.created_at : new Date().toISOString();
  const { error } = await db.from("email_events").insert({
    message_id: m?.id ?? null, provider_event_id: request.headers.get("svix-id"), provider_message_id: providerId,
    event_type: event.type, detail: event.data?.bounce?.message?.slice(0, 500) ?? null, occurred_at: occurred,
  });
  if (error && !/duplicate|unique/i.test(error.message)) return NextResponse.json({ ok: false }, { status: 500 });
  if (error) return NextResponse.json({ ok: true, duplicate: true });

  if (m) {
    await db.from("outreach_messages").update({ delivery_status: status, last_event_at: occurred }).eq("id", m.id);
    if (status === "bounced" || status === "complained") await suppress(m.to_email, status, `provider ${event.type}`);
  }
  return NextResponse.json({ ok: true });
}
