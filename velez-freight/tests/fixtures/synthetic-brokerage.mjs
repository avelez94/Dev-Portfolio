// SYNTHETIC TEST DATA ONLY. Never load into production.
// Deterministic "developed brokerage" history (about six months) used by the database tests
// and the operational end to end phase. Every company name starts with "[Synthetic]".
// It also exposes the generated rows so tests can compute expected metrics independently of SQL.


export const SYNTHETIC_PREFIX = "[Synthetic]";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Deterministic UUIDs so expected values are reproducible.
function uuidFrom(r) {
  const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const dateOnly = (ms) => new Date(ms).toISOString().slice(0, 10);
/** Noon UTC on a calendar day: always the same date in America/New_York. */
const noonUtc = (d) => Date.parse(`${d}T16:00:00Z`);
const cents = (n) => Math.round(n * 100);
const money = (c) => (c / 100).toFixed(2);
const q = (v) => (v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const LANES = [
  ["Baltimore", "MD", "Richmond", "VA"], ["Baltimore", "MD", "Columbus", "OH"], ["Hagerstown", "MD", "Harrisburg", "PA"],
  ["Frederick", "MD", "Charlotte", "NC"], ["Jessup", "MD", "Newark", "NJ"], ["Baltimore", "MD", "Atlanta", "GA"],
  ["Columbia", "MD", "Pittsburgh", "PA"], ["Salisbury", "MD", "Norfolk", "VA"],
];
const INDUSTRIES = ["manufacturing", "distribution", "automotive", "industrial", "retail", "food_beverage", "construction", "other"];
const SOURCES = ["research", "website", "referral", "inbound_inquiry", "manual", "other"];
const STAGES = ["researching", "contact_identified", "contacted", "responded", "qualified", "potential_customer", "active_customer"];

export function generateSyntheticBrokerage({ seed = 20261112, today = new Date().toISOString().slice(0, 10) } = {}) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (lo, hi) => lo + r() * (hi - lo);
  const todayMs = noonUtc(today);
  const data = { shippers: [], stageEvents: [], carriers: [], verifications: [], quotes: [], shipments: [], exceptions: [], documents: [], invoices: [], invoicePayments: [], bills: [], carrierPayments: [], expenses: [], activities: [], tasks: [] };

  // Shippers: 14 with a realistic spread of pipeline stages.
  const names = ["Ridgeway Manufacturing", "Chesapeake Components", "Patapsco Paper Goods", "Harbor Supply Co", "Severn Industrial", "Blue Crab Foods",
    "Monocacy Auto Parts", "Antietam Building Supply", "Gunpowder Distribution", "Catoctin Retail Group", "Bay Bridge Fasteners", "Susquehanna Steel",
    "Piedmont Packaging", "Tidewater Beverages"];
  names.forEach((n, i) => {
    const createdMs = todayMs - Math.floor(between(20, 200)) * DAY;
    const finalRank = i < 6 ? 7 : i < 8 ? 6 : i < 10 ? 5 : i < 12 ? 3 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
    const lost = i === 13;
    const id = uuidFrom(r);
    const status = lost ? "lost" : STAGES[finalRank - 1];
    const s = { id, company: `${SYNTHETIC_PREFIX} ${n}`, status, source: SOURCES[i % SOURCES.length], industry_category: INDUSTRIES[i % INDUSTRIES.length], created_at: iso(createdMs) };
    data.shippers.push(s);
    let t = createdMs;
    let prev = null;
    for (let k = 1; k <= (lost ? 3 : finalRank); k++) {
      data.stageEvents.push({ shipper_id: id, from_status: prev, to_status: STAGES[k - 1], changed_at: iso(t) });
      prev = STAGES[k - 1];
      t += Math.floor(between(2, 12)) * DAY;
      if (t > todayMs) t = todayMs - DAY;
    }
    if (lost) data.stageEvents.push({ shipper_id: id, from_status: prev, to_status: "lost", changed_at: iso(Math.min(t, todayMs - DAY)) });
    s.customerSince = finalRank === 7 ? data.stageEvents.filter((e) => e.shipper_id === id).at(-1).changed_at : null;
  });

  // Outreach activities over the last 120 days
  for (let i = 0; i < 160; i++) {
    const sh = pick(data.shippers);
    const type = pick(["call", "call", "email", "email", "email", "meeting", "text"]);
    const outcome = pick(["completed", "completed", "completed", "left_message", "no_answer", "bounced"]);
    data.activities.push({ id: uuidFrom(r), shipper_id: sh.id, activity_type: type, direction: r() < 0.85 ? "outbound" : "inbound", outcome,
      got_response: outcome === "completed" && r() < 0.55, occurred_at: iso(todayMs - Math.floor(between(0, 120)) * DAY - Math.floor(between(0, 8)) * 3_600_000),
      summary: `Synthetic ${type} log` });
  }

  // Carriers: 8, of which 6 fully qualified.
  ["Severn Freight Lines", "Blue Ridge Haulers", "Patuxent Logistics", "Old Line Transport", "Chesapeake Carriers", "Catoctin Express", "Allegheny Movers", "Eastern Shore Trucking"].forEach((n, i) => {
    const id = uuidFrom(r);
    const qualified = i < 6;
    data.carriers.push({ id, company_name: `${SYNTHETIC_PREFIX} ${n}`, verification_status: qualified ? "verified" : "unverified", verified_on: qualified ? dateOnly(todayMs - 10 * DAY) : null,
      insurance_expires_on: qualified ? dateOnly(todayMs + (i === 0 ? 20 : 200) * DAY) : null, agreement_signed_on: qualified ? dateOnly(todayMs - 150 * DAY) : null,
      mc_number: String(900000 + i), usdot_number: String(3900000 + i), equipment: [pick(["dry_van", "reefer", "flatbed", "box_truck", "sprinter"])], qualified });
    if (qualified) {
      data.verifications.push({ carrier_id: id, check_type: "authority", result: "pass", source: "FMCSA SAFER snapshot (synthetic)", checked_on: dateOnly(todayMs - 5 * DAY) });
      data.verifications.push({ carrier_id: id, check_type: "insurance", result: "pass", source: "Certificate of insurance (synthetic)", checked_on: dateOnly(todayMs - 5 * DAY) });
    }
  });
  const qualifiedCarriers = data.carriers.filter((c) => c.qualified);
  const customers = data.shippers.filter((s) => s.customerSince);

  // Shipments over the last 180 days
  for (let i = 0; i < 130; i++) {
    const sh = pick(customers);
    const lane = pick(LANES);
    const carrier = pick(qualifiedCarriers);
    const freight = r() < 0.25 ? "expedited" : r() < 0.35 ? "dedicated" : "general";
    const bookedMs = todayMs - Math.floor(between(1, 180)) * DAY;
    const pickupStart = bookedMs + Math.floor(between(1, 4)) * DAY;
    const pickupEnd = pickupStart + 4 * 3_600_000;
    const deliveryStart = pickupStart + Math.floor(between(1, 3)) * DAY;
    const deliveryEnd = deliveryStart + 6 * 3_600_000;
    const rate = cents(between(900, 4600) * (freight === "expedited" ? 1.35 : 1));
    const marginPct = freight === "expedited" ? between(0.15, 0.22) : between(0.1, 0.17);
    const cost = Math.round(rate * (1 - marginPct));
    const cancelled = i % 23 === 7;
    const s = { id: uuidFrom(r), shipper_id: sh.id, carrier_id: carrier.id, freight_type: freight, equipment: carrier.equipment[0], origin_city: lane[0], origin_state: lane[1], dest_city: lane[2], dest_state: lane[3],
      booked_at: iso(bookedMs), pickup_window_start: iso(pickupStart), pickup_window_end: iso(pickupEnd), delivery_window_start: iso(deliveryStart), delivery_window_end: iso(deliveryEnd),
      customer_rate: rate, carrier_cost: i % 41 === 5 ? null : cost, status: "booked", actual_pickup_at: null, pickup_verified: false, actual_delivery_at: null, delivery_verified: false, cancelled_at: null };
    if (cancelled) { s.status = "cancelled"; s.cancelled_at = iso(bookedMs + DAY / 2); }
    else if (deliveryEnd < todayMs) {
      const lateP = r() < 0.12; const lateD = r() < 0.15;
      s.actual_pickup_at = iso(lateP ? pickupEnd + 3 * 3_600_000 : pickupStart + 3_600_000);
      s.pickup_verified = r() > 0.08;
      s.actual_delivery_at = iso(lateD ? deliveryEnd + 5 * 3_600_000 : deliveryStart + 2 * 3_600_000);
      s.delivery_verified = r() > 0.08;
      s.status = Date.parse(s.actual_delivery_at) < todayMs - 7 * DAY ? "completed" : "delivered";
      if (r() < 0.9 || s.status === "completed") data.documents.push({ entity_id: s.id, doc_type: "pod", received_at: iso(Date.parse(s.actual_delivery_at) + Math.floor(between(2, 40)) * 3_600_000) });
      if (r() < 0.08) data.exceptions.push({ id: uuidFrom(r), shipment_id: s.id, exception_type: pick(["delivery_delay", "damage", "shortage", "documentation"]), description: "Synthetic exception", opened_at: s.actual_delivery_at, resolved_at: iso(Date.parse(s.actual_delivery_at) + DAY) });
    } else if (pickupStart < todayMs) { s.status = "in_transit"; s.actual_pickup_at = iso(pickupStart + 3_600_000); s.pickup_verified = true; }
    data.shipments.push(s);
  }
  // Two open exceptions on in transit loads (critical priorities)
  data.shipments.filter((s) => s.status === "in_transit").slice(0, 2).forEach((s) =>
    data.exceptions.push({ id: uuidFrom(r), shipment_id: s.id, exception_type: "delivery_delay", description: "Synthetic: carrier reports traffic delay", opened_at: iso(todayMs - 3_600_000), resolved_at: null }));

  // Invoices (net 30) and payments; carrier bills (due 15 days) and payments
  for (const s of data.shipments.filter((x) => x.actual_delivery_at)) {
    const deliveredMs = Date.parse(s.actual_delivery_at);
    const issuedMs = deliveredMs + DAY;
    if (issuedMs > todayMs) continue;
    const inv = { id: uuidFrom(r), shipper_id: s.shipper_id, shipment_id: s.id, issued_on: dateOnly(issuedMs), due_on: dateOnly(issuedMs + 30 * DAY), amount: s.customer_rate };
    data.invoices.push(inv);
    const payAfter = Math.floor(between(15, 55));
    if (issuedMs + payAfter * DAY < todayMs && r() < 0.9) {
      const partial = r() < 0.1;
      data.invoicePayments.push({ invoice_id: inv.id, amount: partial ? Math.round(inv.amount / 2) : inv.amount, received_on: dateOnly(issuedMs + payAfter * DAY), method: "ach" });
    }
    if (s.carrier_cost !== null) {
      const bill = { id: uuidFrom(r), carrier_id: s.carrier_id, shipment_id: s.id, received_on: dateOnly(deliveredMs + 2 * DAY), due_on: dateOnly(deliveredMs + 17 * DAY), amount: s.carrier_cost };
      if (deliveredMs + 2 * DAY <= todayMs) {
        data.bills.push(bill);
        if (deliveredMs + 14 * DAY < todayMs) data.carrierPayments.push({ bill_id: bill.id, amount: bill.amount, paid_on: dateOnly(deliveredMs + 14 * DAY), method: "ach" });
      }
    }
  }

  // Quotes
  for (let i = 0; i < 70; i++) {
    const sh = pick(data.shippers.filter((x) => x.status !== "lost"));
    const lane = pick(LANES);
    const createdMs = todayMs - Math.floor(between(0, 150)) * DAY;
    const status = pick(["accepted", "accepted", "declined", "expired", "sent", "pending_approval", "draft"]);
    const rate = cents(between(1000, 5000));
    const sentMs = ["accepted", "declined", "expired", "sent"].includes(status) ? createdMs + DAY / 4 : null;
    data.quotes.push({ id: uuidFrom(r), shipper_id: sh.id, status, freight_type: pick(["expedited", "general", "dedicated"]), equipment: "dry_van", origin_city: lane[0], origin_state: lane[1], dest_city: lane[2], dest_state: lane[3],
      customer_rate: rate, estimated_carrier_cost: Math.round(rate * 0.86), created_at: iso(createdMs), sent_at: sentMs ? iso(sentMs) : null,
      decided_at: ["accepted", "declined", "expired"].includes(status) ? iso(createdMs + 2 * DAY) : null });
  }

  // Operating expenses: monthly software and insurance, occasional marketing
  for (let m = 0; m < 6; m++) {
    const d = dateOnly(todayMs - (m * 30 + 3) * DAY);
    data.expenses.push({ category: "software", description: "Synthetic TMS and CRM subscriptions", amount: 18900, incurred_on: d });
    data.expenses.push({ category: "insurance", description: "Synthetic contingent cargo insurance", amount: 42500, incurred_on: d });
    if (m % 2 === 0) data.expenses.push({ category: "marketing", description: "Synthetic trade association dues", amount: 25000, incurred_on: d });
  }

  // A few manual follow ups (overdue and upcoming)
  data.tasks.push({ title: "Synthetic: send capability overview", due_date: dateOnly(todayMs - 2 * DAY), category: "follow_up", entity_id: data.shippers[9].id });
  data.tasks.push({ title: "Synthetic: confirm Q3 shipping forecast", due_date: dateOnly(todayMs + 3 * DAY), category: "follow_up", entity_id: data.shippers[2].id });

  return { data, sql: toSql(data), today };
}

function toSql(d) {
  const lines = [
    "-- SYNTHETIC TEST DATA. Generated by tests/fixtures/synthetic-brokerage.mjs. Never load into production.",
    "set session_replication_role = replica; -- historical rows with explicit timestamps; triggers re-run below",
  ];
  const ins = (table, rows, cols) => {
    if (!rows.length) return;
    lines.push(`insert into public.${table} (${cols.join(", ")}) values\n${rows.map((r) => `(${cols.map((c) => q(r[c])).join(", ")})`).join(",\n")};`);
  };
  ins("shipper_prospects", d.shippers.map((s) => ({ ...s, source: s.source })), ["id", "company", "status", "source", "industry_category", "created_at"]);
  ins("prospect_stage_events", d.stageEvents, ["shipper_id", "from_status", "to_status", "changed_at"]);
  ins("crm_activities", d.activities, ["id", "shipper_id", "activity_type", "direction", "outcome", "got_response", "occurred_at", "summary"]);
  lines.push(`insert into public.carrier_leads (id, company_name, verification_status, verified_on, insurance_expires_on, agreement_signed_on, mc_number, usdot_number, equipment, source) values\n${d.carriers
    .map((c) => `(${[c.id, c.company_name, c.verification_status, c.verified_on, c.insurance_expires_on, c.agreement_signed_on, c.mc_number, c.usdot_number].map(q).join(", ")}, array[${c.equipment.map(q).join(",")}]::text[], 'manual')`).join(",\n")};`);
  ins("carrier_verifications", d.verifications, ["carrier_id", "check_type", "result", "source", "checked_on"]);
  ins("quotes", d.quotes.map((x) => ({ ...x, customer_rate: money(x.customer_rate), estimated_carrier_cost: money(x.estimated_carrier_cost) })),
    ["id", "shipper_id", "status", "freight_type", "equipment", "origin_city", "origin_state", "dest_city", "dest_state", "customer_rate", "estimated_carrier_cost", "created_at", "sent_at", "decided_at"]);
  ins("shipments", d.shipments.map((x) => ({ ...x, customer_rate: money(x.customer_rate), carrier_cost: x.carrier_cost === null ? null : money(x.carrier_cost) })),
    ["id", "shipper_id", "carrier_id", "status", "freight_type", "equipment", "origin_city", "origin_state", "dest_city", "dest_state", "booked_at", "pickup_window_start", "pickup_window_end",
      "delivery_window_start", "delivery_window_end", "actual_pickup_at", "pickup_verified", "actual_delivery_at", "delivery_verified", "customer_rate", "carrier_cost", "cancelled_at"]);
  ins("shipment_exceptions", d.exceptions, ["id", "shipment_id", "exception_type", "description", "opened_at", "resolved_at"]);
  ins("documents", d.documents.map((x) => ({ ...x, entity_type: "shipment" })), ["entity_type", "entity_id", "doc_type", "received_at"]);
  ins("invoices", d.invoices.map((x) => ({ ...x, amount: money(x.amount), status: "issued" })), ["id", "shipper_id", "shipment_id", "status", "issued_on", "due_on", "amount"]);
  ins("invoice_payments", d.invoicePayments.map((x) => ({ ...x, amount: money(x.amount) })), ["invoice_id", "amount", "received_on", "method"]);
  ins("carrier_bills", d.bills.map((x) => ({ ...x, amount: money(x.amount), status: "approved" })), ["id", "carrier_id", "shipment_id", "status", "received_on", "due_on", "amount"]);
  ins("carrier_payments", d.carrierPayments.map((x) => ({ ...x, amount: money(x.amount) })), ["bill_id", "amount", "paid_on", "method"]);
  ins("operating_expenses", d.expenses.map((x) => ({ ...x, amount: money(x.amount) })), ["category", "description", "amount", "incurred_on"]);
  ins("follow_up_tasks", d.tasks.map((t) => ({ ...t, entity_type: "shipper_prospect" })), ["title", "due_date", "category", "entity_type", "entity_id"]);
  lines.push("set session_replication_role = origin;");
  return lines.join("\n");
}

