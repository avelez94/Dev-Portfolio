"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { audit } from "@/lib/data/audit";
import type { ActionState } from "./actions";

/**
 * Brokerage operations. Every action re-checks that operations are enabled (environment switch
 * and dashboard switch); the database refuses new brokerage rows in prelaunch mode as well.
 * Nothing here contacts customers or carriers: "sent" and "paid" are records of things a person
 * did outside the system, and require explicit confirmation.
 */
const form = (fd: FormData) => Object.fromEntries(fd.entries()) as Record<string, string>;
const uuid = z.uuid();
const money = z.string().trim().transform((v) => v.replace(/[$,\s]/g, "")).pipe(z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter an amount like 1250.00"));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const optDate = z.string().optional().transform((v) => v || null);
const state = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a two letter state code.");
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const fail = (e: unknown): ActionState => ({ error: e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" ") : e instanceof Error && e.message.includes("not qualified") ? "That carrier does not pass the qualification checks. Open the carrier to see what is missing." : e instanceof Error && e.message.includes("prelaunch") ? "Brokerage records cannot be created in prelaunch mode." : "Something went wrong. Please try again." });
const NOT_ACTIVE: ActionState = { error: "Brokerage operations are not enabled. Quotes, shipments, invoices and payables become available after activation." };

async function operational() {
  return (await getSettings()).operational;
}
/** Converts a business local datetime (America/New_York) to an ISO instant. */
function localToIso(v: string | undefined | null) {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const asUtc = new Date(`${v}:00Z`);
  const ny = new Date(asUtc.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() + (utc.getTime() - ny.getTime())).toISOString();
}
const done = (path: string, message: string): ActionState => { revalidatePath(path); revalidatePath("/admin", "layout"); return { ok: true, message }; };

// ---------------------------------------------------------------- Quotes
export async function createQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  if (!(await operational())) return NOT_ACTIVE;
  let id: string;
  try {
    const v = z.object({
      shipper_id: uuid, quote_inquiry_id: z.union([z.literal("").transform(() => null), uuid]).optional(),
      freight_type: z.enum(["expedited", "dedicated", "general"]), equipment: z.string().trim().min(1).max(40),
      origin_city: z.string().trim().min(1).max(120), origin_state: state, dest_city: z.string().trim().min(1).max(120), dest_state: state,
      pickup_date: optDate, customer_rate: money, estimated_carrier_cost: money, valid_until: optDate, notes: opt(2000),
    }).parse(form(fd));
    const { data, error } = await s.db.from("quotes").insert({ ...v, created_by: s.userId }).select("id").single();
    if (error) throw error;
    id = data.id;
    await audit({ actorType: "admin", actorId: s.userId, action: "quote.created", entityType: "quote", entityId: id });
  } catch (e) { return fail(e); }
  redirect(`/admin/quotes/${id}`);
}

const QUOTE_FLOW: Record<string, { from: string[]; admin?: boolean; confirm?: string }> = {
  pending_approval: { from: ["draft"] },
  approved: { from: ["pending_approval"], admin: true },
  draft: { from: ["pending_approval", "approved"] },
  sent: { from: ["approved"], confirm: "I sent this quote to the customer myself, outside this system." },
  accepted: { from: ["sent"] }, declined: { from: ["sent"] }, expired: { from: ["sent", "approved"] },
  cancelled: { from: ["draft", "pending_approval", "approved", "sent"] },
};

export async function moveQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  if (!(await operational())) return NOT_ACTIVE;
  const v = z.object({ id: uuid, to: z.enum(Object.keys(QUOTE_FLOW) as [string, ...string[]]), confirm: z.string().optional() }).safeParse(form(fd));
  if (!v.success) return { error: "Invalid change." };
  const rule = QUOTE_FLOW[v.data.to];
  if (rule.admin && s.role === "staff") return { error: "Only owners and admins can approve quotes." };
  if (rule.confirm && v.data.confirm !== "on") return { error: "Confirm that you sent the quote yourself before recording it as sent." };
  const { data: q } = await s.db.from("quotes").select("status").eq("id", v.data.id).single();
  if (!q || !rule.from.includes(q.status)) return { error: `A ${String(q?.status).replace("_", " ")} quote cannot move to ${v.data.to.replace("_", " ")}.` };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: v.data.to };
  if (v.data.to === "approved") Object.assign(patch, { approved_by: s.userId, approved_at: now });
  if (v.data.to === "sent") patch.sent_at = now;
  if (["accepted", "declined", "expired"].includes(v.data.to)) patch.decided_at = now;
  const { error } = await s.db.from("quotes").update(patch).eq("id", v.data.id);
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: `quote.${v.data.to}`, entityType: "quote", entityId: v.data.id, metadata: { from: q.status } });
  return done(`/admin/quotes/${v.data.id}`, "Quote updated.");
}

// ---------------------------------------------------------------- Shipments
export async function createShipment(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  if (!(await operational())) return NOT_ACTIVE;
  let id: string;
  try {
    const raw = form(fd);
    const v = z.object({
      shipper_id: uuid, quote_id: z.union([z.literal("").transform(() => null), uuid]).optional(), carrier_id: z.union([z.literal("").transform(() => null), uuid]).optional(),
      freight_type: z.enum(["expedited", "dedicated", "general"]), equipment: z.string().trim().min(1).max(40), commodity: opt(200),
      origin_city: z.string().trim().min(1).max(120), origin_state: state, dest_city: z.string().trim().min(1).max(120), dest_state: state,
      customer_rate: money, carrier_cost: z.union([z.literal("").transform(() => null), money]).optional(),
    }).parse(raw);
    const row = { ...v, pickup_window_start: localToIso(raw.pickup_window_start), pickup_window_end: localToIso(raw.pickup_window_end), delivery_window_start: localToIso(raw.delivery_window_start), delivery_window_end: localToIso(raw.delivery_window_end), created_by: s.userId };
    const { data, error } = await s.db.from("shipments").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id;
    await audit({ actorType: "admin", actorId: s.userId, action: "shipment.booked", entityType: "shipment", entityId: id });
  } catch (e) { return fail(e); }
  redirect(`/admin/shipments/${id}`);
}

export async function assignCarrier(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  if (!(await operational())) return NOT_ACTIVE;
  const v = z.object({ id: uuid, carrier_id: uuid, carrier_cost: z.union([z.literal("").transform(() => null), money]).optional() }).safeParse(form(fd));
  if (!v.success) return { error: "Choose a carrier." };
  const patch: Record<string, unknown> = { carrier_id: v.data.carrier_id };
  if (v.data.carrier_cost) patch.carrier_cost = v.data.carrier_cost;
  const { error } = await s.db.from("shipments").update(patch).eq("id", v.data.id);
  if (error) return fail(new Error(error.message));
  await audit({ actorType: "admin", actorId: s.userId, action: "shipment.carrier_assigned", entityType: "shipment", entityId: v.data.id, metadata: { carrier: v.data.carrier_id } });
  return done(`/admin/shipments/${v.data.id}`, "Carrier assigned. The qualification rules passed.");
}

export async function recordShipmentEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  try {
    const raw = form(fd);
    const v = z.object({ shipment_id: uuid, event_type: z.enum(["dispatched", "arrived_pickup", "picked_up", "arrived_delivery", "delivered", "check_call", "note"]), source: z.string().trim().min(2, "Say where this information came from.").max(120), notes: opt(1000), verified: z.string().optional() }).parse(raw);
    const occurred = localToIso(raw.occurred_at);
    if (!occurred) return { error: "Choose when it happened." };
    if (Date.parse(occurred) > Date.now() + 5 * 60_000) return { error: "Events must already have happened." };
    const { error } = await s.db.from("shipment_events").insert({ shipment_id: v.shipment_id, event_type: v.event_type, occurred_at: occurred, verified: v.verified === "on", source: v.source, notes: v.notes, recorded_by: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: `shipment.event_${v.event_type}`, entityType: "shipment", entityId: v.shipment_id, metadata: { verified: v.verified === "on" } });
    return done(`/admin/shipments/${v.shipment_id}`, "Event recorded.");
  } catch (e) { return fail(e); }
}

export async function openException(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  const v = z.object({ shipment_id: uuid, exception_type: z.enum(["pickup_delay", "delivery_delay", "damage", "shortage", "refused", "documentation", "equipment", "other"]), description: z.string().trim().min(2).max(1000) }).safeParse(form(fd));
  if (!v.success) return { error: "Describe the exception." };
  const { error } = await s.db.from("shipment_exceptions").insert({ ...v.data, created_by: s.userId });
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: "shipment.exception_opened", entityType: "shipment", entityId: v.data.shipment_id, metadata: { type: v.data.exception_type } });
  await s.db.rpc("refresh_system_tasks", { p_force: true });
  return done(`/admin/shipments/${v.data.shipment_id}`, "Exception recorded. A critical task was created.");
}

export async function resolveException(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  const v = z.object({ id: uuid, shipment_id: uuid, resolution: z.string().trim().min(2, "Describe how it was resolved.").max(1000) }).safeParse(form(fd));
  if (!v.success) return { error: "Describe how it was resolved." };
  const { error } = await s.db.from("shipment_exceptions").update({ resolved_at: new Date().toISOString(), resolution: v.data.resolution }).eq("id", v.data.id);
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: "shipment.exception_resolved", entityType: "shipment", entityId: v.data.shipment_id });
  await s.db.rpc("refresh_system_tasks", { p_force: true });
  return done(`/admin/shipments/${v.data.shipment_id}`, "Exception resolved.");
}

export async function setShipmentStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  const v = z.object({ id: uuid, to: z.enum(["completed", "cancelled"]), confirm: z.string().optional() }).safeParse(form(fd));
  if (!v.success) return { error: "Invalid change." };
  if (v.data.to === "cancelled" && v.data.confirm !== "on") return { error: "Confirm the cancellation first." };
  const { data: sh } = await s.db.from("shipments").select("status").eq("id", v.data.id).single();
  if (v.data.to === "completed" && sh?.status !== "delivered") return { error: "Only delivered shipments can be completed." };
  if (v.data.to === "cancelled" && ["delivered", "completed", "cancelled"].includes(sh?.status ?? "")) return { error: "Delivered or completed shipments cannot be cancelled." };
  const patch = v.data.to === "completed" ? { status: "completed", completed_at: new Date().toISOString() } : { status: "cancelled", cancelled_at: new Date().toISOString() };
  const { error } = await s.db.from("shipments").update(patch).eq("id", v.data.id);
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: `shipment.${v.data.to}`, entityType: "shipment", entityId: v.data.id });
  return done(`/admin/shipments/${v.data.id}`, v.data.to === "completed" ? "Shipment completed." : "Shipment cancelled. It is excluded from revenue.");
}

// ---------------------------------------------------------------- Invoices (owners and admins)
export async function createInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  if (!(await operational())) return NOT_ACTIVE;
  let id: string;
  try {
    const v = z.object({ shipment_id: uuid, amount: money, notes: opt(1000) }).parse(form(fd));
    const { data: sh } = await s.db.from("shipments").select("shipper_id, status").eq("id", v.shipment_id).single();
    if (!sh || !["delivered", "completed"].includes(sh.status)) return { error: "Invoice delivered or completed shipments only." };
    const { data, error } = await s.db.from("invoices").insert({ shipper_id: sh.shipper_id, shipment_id: v.shipment_id, amount: v.amount, notes: v.notes, created_by: s.userId }).select("id").single();
    if (error) return { error: error.code === "23505" ? "This shipment already has an active invoice." : "Could not create the invoice." };
    id = data.id;
    await audit({ actorType: "admin", actorId: s.userId, action: "invoice.created", entityType: "invoice", entityId: id });
  } catch (e) { return fail(e); }
  redirect(`/admin/invoices/${id}`);
}

export async function issueInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const v = z.object({ id: uuid, issued_on: date, due_on: date }).safeParse(form(fd));
  if (!v.success || v.data.due_on < v.data.issued_on) return { error: "The due date must be on or after the issue date." };
  const { error } = await s.db.from("invoices").update({ status: "issued", issued_on: v.data.issued_on, due_on: v.data.due_on }).eq("id", v.data.id).eq("status", "draft");
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: "invoice.issued", entityType: "invoice", entityId: v.data.id });
  return done(`/admin/invoices/${v.data.id}`, "Invoice issued. Send it to the customer yourself, then record that it was sent.");
}

export async function markInvoiceSent(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const v = z.object({ id: uuid, confirm: z.string().optional() }).safeParse(form(fd));
  if (!v.success || v.data.confirm !== "on") return { error: "Confirm that you sent the invoice yourself." };
  const { error } = await s.db.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", v.data.id).eq("status", "issued");
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: "invoice.marked_sent", entityType: "invoice", entityId: v.data.id });
  return done(`/admin/invoices/${v.data.id}`, "Recorded as sent.");
}

export async function recordInvoicePayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const v = z.object({ invoice_id: uuid, amount: money, received_on: date, method: z.enum(["ach", "check", "wire", "card", "other"]), reference: opt(120) }).parse(form(fd));
    const { data: inv } = await s.db.from("invoices").select("amount, status").eq("id", v.invoice_id).single();
    const { data: pays } = await s.db.from("invoice_payments").select("amount").eq("invoice_id", v.invoice_id);
    const paidCents = (pays ?? []).reduce((a, p) => a + Math.round(Number(p.amount) * 100), 0);
    if (inv?.status !== "issued") return { error: "Payments can be recorded on issued invoices only." };
    if (paidCents + Math.round(Number(v.amount) * 100) > Math.round(Number(inv.amount) * 100)) return { error: "That payment is more than the remaining balance." };
    const { error } = await s.db.from("invoice_payments").insert({ ...v, recorded_by: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "invoice.payment_recorded", entityType: "invoice", entityId: v.invoice_id, metadata: { amount: v.amount } });
    return done(`/admin/invoices/${v.invoice_id}`, "Payment recorded.");
  } catch (e) { return fail(e); }
}

export async function voidInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const v = z.object({ id: uuid, confirm: z.string().optional() }).safeParse(form(fd));
  if (!v.success || v.data.confirm !== "on") return { error: "Confirm before voiding." };
  const { count } = await s.db.from("invoice_payments").select("id", { count: "exact", head: true }).eq("invoice_id", v.data.id);
  if ((count ?? 0) > 0) return { error: "Invoices with payments cannot be voided." };
  const { error } = await s.db.from("invoices").update({ status: "void" }).eq("id", v.data.id);
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: "invoice.voided", entityType: "invoice", entityId: v.data.id });
  return done(`/admin/invoices/${v.data.id}`, "Invoice voided. It no longer counts toward receivables.");
}

// ---------------------------------------------------------------- Carrier payables (owners and admins)
export async function createBill(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  if (!(await operational())) return NOT_ACTIVE;
  try {
    const v = z.object({ carrier_id: uuid, shipment_id: z.union([z.literal("").transform(() => null), uuid]).optional(), carrier_invoice_reference: opt(120), amount: money, received_on: date, due_on: date, notes: opt(1000) }).parse(form(fd));
    if (v.due_on < v.received_on) return { error: "The due date must be on or after the received date." };
    const { error } = await s.db.from("carrier_bills").insert(v);
    if (error) return { error: error.code === "23505" ? "This shipment already has an active carrier bill." : "Could not record the bill." };
    await audit({ actorType: "admin", actorId: s.userId, action: "carrier_bill.recorded", entityType: "carrier_lead", entityId: v.carrier_id });
    return done("/admin/payables", "Carrier bill recorded.");
  } catch (e) { return fail(e); }
}

export async function approveBill(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Invalid bill." };
  const { error } = await s.db.from("carrier_bills").update({ status: "approved", approved_by: s.userId, approved_at: new Date().toISOString() }).eq("id", id.data).eq("status", "received");
  if (error) return fail(error);
  await audit({ actorType: "admin", actorId: s.userId, action: "carrier_bill.approved", entityType: "carrier_bill", entityId: id.data });
  return done("/admin/payables", "Bill approved for payment.");
}

export async function recordCarrierPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const v = z.object({ bill_id: uuid, amount: money, paid_on: date, method: z.enum(["ach", "check", "quick_pay", "factoring", "other"]), reference: opt(120), confirm: z.string().optional() }).parse(form(fd));
    if (v.confirm !== "on") return { error: "Confirm that this payment was made outside this system." };
    const { data: bill } = await s.db.from("carrier_bills").select("amount, status").eq("id", v.bill_id).single();
    if (bill?.status !== "approved") return { error: "Approve the bill before recording a payment." };
    const { data: pays } = await s.db.from("carrier_payments").select("amount").eq("bill_id", v.bill_id);
    const paid = (pays ?? []).reduce((a, p) => a + Math.round(Number(p.amount) * 100), 0);
    if (paid + Math.round(Number(v.amount) * 100) > Math.round(Number(bill.amount) * 100)) return { error: "That payment is more than the remaining balance." };
    const { confirm: _c, ...row } = v; void _c;
    const { error } = await s.db.from("carrier_payments").insert({ ...row, recorded_by: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "carrier_bill.payment_recorded", entityType: "carrier_bill", entityId: v.bill_id, metadata: { amount: v.amount } });
    return done("/admin/payables", "Payment recorded.");
  } catch (e) { return fail(e); }
}

// ---------------------------------------------------------------- Operating expenses (allowed in prelaunch)
export async function createExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  try {
    const v = z.object({ category: z.enum(["software", "insurance", "licensing", "marketing", "professional_services", "office", "payroll", "other"]), description: z.string().trim().min(2).max(300), vendor: opt(160), amount: money, incurred_on: date }).parse(form(fd));
    const { error } = await s.db.from("operating_expenses").insert({ ...v, recorded_by: s.userId });
    if (error) throw error;
    await audit({ actorType: "admin", actorId: s.userId, action: "expense.recorded", metadata: { category: v.category, amount: v.amount } });
    return done("/admin/expenses", "Expense recorded.");
  } catch (e) { return fail(e); }
}
