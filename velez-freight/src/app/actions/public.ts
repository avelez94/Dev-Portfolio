"use server";

import { after } from "next/server";
import { z } from "zod";
import { carrierSchema, contactSchema, quoteSchema, spamEnvelope } from "@/lib/validation";
import { issueFormToken } from "@/lib/security/form-token";
import { flattenErrors, guardSubmission, type ActionResult } from "@/lib/security/submission";
import { getSettings } from "@/lib/data/settings";
import { audit } from "@/lib/data/audit";
import { notifyAdmin } from "@/lib/email/notify";
import { shipmentTypes } from "@/config/site";

/** Issues a signed timestamp used to reject bots that submit instantly or replay old pages. */
export async function getFormToken(): Promise<string> {
  return issueFormToken();
}

const labelFor = (v?: string) => shipmentTypes.find((s) => s.value === v)?.label ?? v;

function validationFailure(issues: z.core.$ZodIssue[]): ActionResult {
  return { ok: false, code: "validation", error: "Please correct the highlighted fields.", fieldErrors: flattenErrors(issues) };
}

// ---------------------------------------------------------------------------
// General, shipper and launch notification inquiries
// ---------------------------------------------------------------------------
export async function submitContact(input: unknown, envelope: unknown, sourcePage?: string): Promise<ActionResult> {
  const env = spamEnvelope.safeParse(envelope);
  if (!env.success) return { ok: false, code: "spam", error: "Please refresh the page and try again." };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.issues);

  const guard = await guardSubmission(env.data, parsed.data.inquiryType === "launch_notification" ? "launch" : "contact");
  if ("result" in guard) return guard.result;
  const { db } = guard;
  const d = parsed.data;

  const { data, error } = await db
    .from("contact_inquiries")
    .insert({
      inquiry_type: d.inquiryType,
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      company: d.company ?? null,
      shipment_type: d.shipmentType ?? null,
      message: d.message ?? null,
      source_page: sourcePage?.slice(0, 120) ?? null,
      privacy_ack: true,
    })
    .select("id, reference")
    .single();
  if (error || !data) {
    console.error("[contact] insert failed", error?.message);
    return { ok: false, code: "server", error: "Something went wrong and your message was not saved. Please try again shortly." };
  }

  after(async () => {
    await audit({ actorType: "public", action: "contact_inquiry.created", entityType: "contact_inquiry", entityId: data.id, metadata: { type: d.inquiryType } });
    const settings = await getSettings();
    if (settings.notifyOnContact) {
      const result = await notifyAdmin({
        subject: `New ${d.inquiryType === "launch_notification" ? "launch notification request" : "website inquiry"} ${data.reference}`,
        heading: d.inquiryType === "launch_notification" ? "Launch notification request" : `New ${d.inquiryType} inquiry`,
        rows: [["Reference", data.reference], ["Name", d.name], ["Company", d.company], ["Email", d.email], ["Phone", d.phone], ["Shipment type", labelFor(d.shipmentType)], ["Message", d.message]],
        adminPath: `/admin/inquiries/contact/${data.id}`,
      });
      if (result === "failed") await audit({ actorType: "system", action: "notification.failed", entityType: "contact_inquiry", entityId: data.id });
    }
  });

  return {
    ok: true,
    reference: data.reference,
    message:
      d.inquiryType === "launch_notification"
        ? "Thank you. We will email you when Velez Freight Group is ready to begin arranging shipments."
        : "Thank you. Your message was received and a member of our team will reply personally.",
  };
}

// ---------------------------------------------------------------------------
// Carrier partnership interest (no sensitive documents are accepted here)
// ---------------------------------------------------------------------------
export async function submitCarrier(input: unknown, envelope: unknown): Promise<ActionResult> {
  const env = spamEnvelope.safeParse(envelope);
  if (!env.success) return { ok: false, code: "spam", error: "Please refresh the page and try again." };
  const parsed = carrierSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.issues);

  const guard = await guardSubmission(env.data, "carrier");
  if ("result" in guard) return guard.result;
  const { db } = guard;
  const d = parsed.data;

  // Match an existing lead by USDOT, then MC, then email, so repeat inquiries build one history.
  let leadId: string | null = null;
  for (const [col, val] of [["usdot_number", d.usdotNumber], ["mc_number", d.mcNumber], ["email", d.email]] as const) {
    if (!val) continue;
    const { data } = await db.from("carrier_leads").select("id").eq(col, val).limit(1).maybeSingle();
    if (data) { leadId = data.id; break; }
  }
  const leadFields = {
    company_name: d.companyName,
    contact_name: d.contactName,
    email: d.email,
    phone: d.phone,
    mc_number: d.mcNumber ?? null,
    usdot_number: d.usdotNumber ?? null,
    equipment: d.equipment,
    operating_region: d.operatingRegion,
    fleet_size: d.fleetSize ?? null,
    last_inquiry_at: new Date().toISOString(),
  };
  if (leadId) {
    // Do not overwrite staff curated data with public input; only refresh contact recency.
    await db.from("carrier_leads").update({ last_inquiry_at: leadFields.last_inquiry_at }).eq("id", leadId);
  } else {
    const { data, error } = await db.from("carrier_leads").insert({ ...leadFields, source: "website" }).select("id").single();
    if (error || !data) {
      console.error("[carrier] lead insert failed", error?.message);
      return { ok: false, code: "server", error: "Something went wrong and your inquiry was not saved. Please try again shortly." };
    }
    leadId = data.id;
  }

  const summary = [
    `Equipment: ${d.equipment.join(", ")}`,
    `Region: ${d.operatingRegion}`,
    d.fleetSize ? `Fleet size: ${d.fleetSize}` : null,
    d.mcNumber ? `MC (as supplied): ${d.mcNumber}` : null,
    d.usdotNumber ? `USDOT (as supplied): ${d.usdotNumber}` : null,
    d.message ? `\n${d.message}` : null,
  ].filter(Boolean).join("\n");

  const { data: inquiry, error } = await db
    .from("contact_inquiries")
    .insert({ inquiry_type: "carrier", name: d.contactName, email: d.email, phone: d.phone, company: d.companyName, message: summary, source_page: "/carriers", privacy_ack: true, carrier_lead_id: leadId })
    .select("id, reference")
    .single();
  if (error || !inquiry) {
    console.error("[carrier] inquiry insert failed", error?.message);
    return { ok: false, code: "server", error: "Something went wrong and your inquiry was not saved. Please try again shortly." };
  }

  after(async () => {
    await audit({ actorType: "public", action: "carrier_inquiry.created", entityType: "carrier_lead", entityId: leadId ?? undefined, metadata: { inquiry: inquiry.id } });
    const settings = await getSettings();
    if (settings.notifyOnCarrier) {
      const result = await notifyAdmin({
        subject: `New carrier partnership inquiry ${inquiry.reference}`,
        heading: "Carrier partnership inquiry",
        rows: [["Reference", inquiry.reference], ["Company", d.companyName], ["Contact", d.contactName], ["Email", d.email], ["Phone", d.phone], ["MC (unverified)", d.mcNumber], ["USDOT (unverified)", d.usdotNumber], ["Equipment", d.equipment.join(", ")], ["Region", d.operatingRegion]],
        adminPath: `/admin/carriers/${leadId}`,
      });
      if (result === "failed") await audit({ actorType: "system", action: "notification.failed", entityType: "carrier_lead", entityId: leadId ?? undefined });
    }
  });

  return { ok: true, reference: inquiry.reference, message: "Thank you for your interest. We will review your information and contact you about next steps." };
}

// ---------------------------------------------------------------------------
// Detailed freight quote inquiry. Server enforced: refused unless operations are active.
// Creates a pending inquiry for manual review only. No price is generated.
// ---------------------------------------------------------------------------
export async function submitQuote(input: unknown, envelope: unknown): Promise<ActionResult> {
  const settings = await getSettings();
  if (!settings.operational) {
    return {
      ok: false,
      code: "not_operational",
      error: "Velez Freight Group is not arranging transportation yet, so freight quote requests are not being accepted. Please send a general inquiry instead.",
    };
  }
  const env = spamEnvelope.safeParse(envelope);
  if (!env.success) return { ok: false, code: "spam", error: "Please refresh the page and try again." };
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.issues);

  const guard = await guardSubmission(env.data, "quote");
  if ("result" in guard) return guard.result;
  const { db } = guard;
  const { route, freight, contact } = parsed.data;

  const { data, error } = await db
    .from("quote_inquiries")
    .insert({
      pickup_address: route.pickupAddress,
      delivery_address: route.deliveryAddress,
      pickup_date: route.pickupDate,
      delivery_deadline: route.deliveryDeadline ?? null,
      stops: route.stops.filter((s) => s.location).map((s) => s.location),
      freight_description: freight.description,
      commodity: freight.commodity,
      weight_lbs: freight.weightLbs,
      dimensions: freight.dimensions ?? null,
      piece_count: freight.pieceCount ?? null,
      piece_type: freight.pieceType,
      equipment: freight.equipment,
      special_handling: freight.specialHandling ?? null,
      loading_requirements: freight.loadingRequirements ?? null,
      company_name: contact.companyName,
      contact_name: contact.contactName,
      email: contact.email,
      phone: contact.phone,
      notes: contact.notes ?? null,
      privacy_ack: true,
    })
    .select("id, reference")
    .single();
  if (error || !data) {
    console.error("[quote] insert failed", error?.message);
    // The database gate raises P0001 when operations are disabled there.
    if (error?.code === "P0001") return { ok: false, code: "not_operational", error: "Freight quote requests are not being accepted right now." };
    return { ok: false, code: "server", error: "Something went wrong and your request was not saved. Please try again shortly." };
  }

  after(async () => {
    await audit({ actorType: "public", action: "quote_inquiry.created", entityType: "quote_inquiry", entityId: data.id });
    if (settings.notifyOnQuote) {
      const result = await notifyAdmin({
        subject: `New freight inquiry ${data.reference} (pending review)`,
        heading: "Freight inquiry pending manual review",
        rows: [["Reference", data.reference], ["Company", contact.companyName], ["Contact", contact.contactName], ["Email", contact.email], ["Phone", contact.phone], ["Pickup", `${route.pickupAddress} on ${route.pickupDate}`], ["Delivery", route.deliveryAddress], ["Deadline", route.deliveryDeadline], ["Description", freight.description], ["Commodity", freight.commodity], ["Weight (lbs)", String(freight.weightLbs)], ["Equipment", labelFor(freight.equipment)]],
        adminPath: `/admin/inquiries/quote/${data.id}`,
      });
      if (result === "failed") await audit({ actorType: "system", action: "notification.failed", entityType: "quote_inquiry", entityId: data.id });
    }
  });

  return {
    ok: true,
    reference: data.reference,
    message: "Thank you for contacting Velez Freight Group. Your request has been received and will be reviewed. Submitting an inquiry does not confirm transportation availability, pricing, or booking.",
  };
}
