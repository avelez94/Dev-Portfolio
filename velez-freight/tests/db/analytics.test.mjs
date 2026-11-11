// Analytics accuracy: loads the synthetic developed brokerage, then compares every core metric
// from the SQL functions with an independent JavaScript calculation over the same rows.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateSyntheticBrokerage } from "../fixtures/synthetic-brokerage.mjs";
import { addDays, freshDatabase, nyDate, OWNER, STAFF, toCents } from "./helpers.mjs";

let h;
let fx;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const FROM = addDays(TODAY, -89);
const TO = TODAY;
const inPeriod = (iso) => iso && nyDate(iso) >= FROM && nyDate(iso) <= TO;

before(async () => {
  h = await freshDatabase(`vfg_analytics_${process.pid}`);
  fx = generateSyntheticBrokerage({ today: TODAY });
  await h.db.query(fx.sql);
});
after(async () => h?.drop());

const owner = (sql, params) => h.as("authenticated", OWNER, (db) => db.query(sql, params));
const fin = async (from = FROM, to = TO) => (await owner(`select public.analytics_financial($1, $2) as r`, [from, to])).rows[0].r;

test("fixture is clearly synthetic and substantial", () => {
  assert.ok(fx.data.shippers.every((s) => s.company.startsWith("[Synthetic]")));
  assert.ok(fx.data.shipments.length >= 100);
});

test("completed revenue, carrier cost and gross margin match an independent calculation", async () => {
  const done = fx.data.shipments.filter((s) => ["delivered", "completed"].includes(s.status) && inPeriod(s.actual_delivery_at));
  const eligible = done.filter((s) => s.carrier_cost !== null);
  const revenue = done.reduce((a, s) => a + s.customer_rate, 0);
  const cost = eligible.reduce((a, s) => a + s.carrier_cost, 0);
  const margin = eligible.reduce((a, s) => a + s.customer_rate - s.carrier_cost, 0);
  const r = await fin();
  assert.ok(done.length > 20, "period contains completed loads");
  assert.equal(r.completed_loads, done.length);
  assert.equal(r.eligible_loads, eligible.length);
  assert.equal(r.loads_missing_cost, done.length - eligible.length);
  assert.equal(toCents(r.completed_revenue), revenue);
  assert.equal(toCents(r.carrier_cost), cost);
  assert.equal(toCents(r.gross_margin), margin);
  assert.equal(toCents(r.eligible_revenue) - toCents(r.carrier_cost), toCents(r.gross_margin), "margin = revenue - carrier cost on the same loads");
});

test("cancelled shipments never count toward revenue or completed loads", async () => {
  const cancelled = fx.data.shipments.filter((s) => s.status === "cancelled");
  assert.ok(cancelled.length > 0);
  const r = await fin(addDays(TODAY, -365), TO);
  const allDone = fx.data.shipments.filter((s) => ["delivered", "completed"].includes(s.status));
  assert.equal(r.completed_loads, allDone.length);
  const booked = fx.data.shipments.filter((s) => s.status !== "cancelled" && nyDate(s.booked_at) >= addDays(TODAY, -365));
  assert.equal(toCents(r.booked_revenue), booked.reduce((a, s) => a + s.customer_rate, 0));
});

test("cash collected and carrier payments use payment dates, not invoice dates", async () => {
  const cash = fx.data.invoicePayments.filter((p) => p.received_on >= FROM && p.received_on <= TO).reduce((a, p) => a + p.amount, 0);
  const paid = fx.data.carrierPayments.filter((p) => p.paid_on >= FROM && p.paid_on <= TO).reduce((a, p) => a + p.amount, 0);
  const invoiced = fx.data.invoices.filter((i) => i.issued_on >= FROM && i.issued_on <= TO).reduce((a, i) => a + i.amount, 0);
  const r = await fin();
  assert.equal(toCents(r.cash_collected), cash);
  assert.equal(toCents(r.carrier_payments_made), paid);
  assert.equal(toCents(r.invoiced), invoiced);
  assert.notEqual(toCents(r.cash_collected), toCents(r.completed_revenue), "booked or completed revenue is not cash");
});

test("receivables aging buckets reconcile to the open balance", async () => {
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const i of fx.data.invoices.filter((x) => x.issued_on <= TO)) {
    const paid = fx.data.invoicePayments.filter((p) => p.invoice_id === i.id && p.received_on <= TO).reduce((a, p) => a + p.amount, 0);
    const bal = i.amount - paid;
    if (bal <= 0) continue;
    const late = Math.round((Date.parse(TO) - Date.parse(i.due_on)) / 86_400_000);
    buckets[late <= 0 ? "current" : late <= 30 ? "d1_30" : late <= 60 ? "d31_60" : late <= 90 ? "d61_90" : "d90_plus"] += bal;
  }
  const r = await fin();
  for (const k of Object.keys(buckets)) assert.equal(toCents(r.receivables_aging[k]), buckets[k], k);
  const total = Object.values(r.receivables_aging).reduce((a, v) => a + toCents(v), 0);
  assert.equal(total, toCents(r.receivables_open));
});

test("operating profit estimate is gross margin minus operating expenses", async () => {
  const r = await fin();
  const exp = fx.data.expenses.filter((e) => e.incurred_on >= FROM && e.incurred_on <= TO).reduce((a, e) => a + e.amount, 0);
  assert.equal(toCents(r.operating_expenses), exp);
});

test("pickup and delivery performance: missing or unverified timestamps are unknown, never on time", async () => {
  const done = fx.data.shipments.filter((s) => ["delivered", "completed"].includes(s.status) && inPeriod(s.actual_delivery_at));
  const cls = (actual, verified, end) => (!actual || !verified || !end ? "unknown" : Date.parse(actual) <= Date.parse(end) ? "on_time" : "late");
  const expect = { on_time: 0, late: 0, unknown: 0 };
  done.forEach((s) => expect[cls(s.actual_pickup_at, s.pickup_verified, s.pickup_window_end)]++);
  const r = (await owner(`select public.analytics_operations($1, $2) as r`, [FROM, TO])).rows[0].r;
  assert.deepEqual(r.pickup, expect);
  assert.ok(expect.unknown > 0, "fixture includes unverified pickups");
  assert.equal(r.completed, done.length);
});

test("historical funnel is built from stage events, not the latest status", async () => {
  const cohort = fx.data.shippers.filter((s) => inPeriod(s.created_at));
  const rank = { researching: 1, contact_identified: 2, contacted: 3, responded: 4, qualified: 5, potential_customer: 6, active_customer: 7 };
  const r = (await owner(`select public.analytics_sales($1, $2) as r`, [FROM, TO])).rows[0].r;
  for (const step of r.funnel) {
    const expected = cohort.filter((s) => Math.max(0, ...fx.data.stageEvents.filter((e) => e.shipper_id === s.id && e.to_status !== "lost").map((e) => rank[e.to_status])) >= rank[step.stage]).length;
    assert.equal(step.reached, expected, step.stage);
  }
  // A lost prospect still counts as having reached the stages it passed through.
  const lost = fx.data.shippers.find((s) => s.status === "lost");
  const passed = fx.data.stageEvents.filter((e) => e.shipper_id === lost.id && e.to_status === "contacted").length;
  assert.equal(passed, 1);
});

test("response rate counts only completed outreach as eligible", async () => {
  const outreach = fx.data.activities.filter((a) => a.direction === "outbound" && inPeriod(a.occurred_at));
  const eligible = outreach.filter((a) => ["completed", "left_message", "no_answer"].includes(a.outcome));
  const r = (await owner(`select public.analytics_sales($1, $2) as r`, [FROM, TO])).rows[0].r;
  assert.equal(r.outreach.total, outreach.length);
  assert.equal(r.outreach.eligible, eligible.length);
  assert.equal(r.outreach.answered, eligible.filter((a) => a.got_response).length);
});

test("revenue by customer sums to completed revenue and concentration is computed from it", async () => {
  const r = await fin();
  const sum = r.by_customer.reduce((a, c) => a + toCents(c.revenue), 0);
  assert.equal(sum, toCents(r.completed_revenue));
  const top3 = r.by_customer.slice(0, 3).reduce((a, c) => a + toCents(c.revenue), 0);
  assert.equal(Number(r.top3_share_pct), Math.round((1000 * top3) / sum) / 10);
});

test("trend buckets reconcile with the period totals", async () => {
  const t = (await owner(`select public.analytics_trends($1, $2, 'week') as r`, [FROM, TO])).rows[0].r;
  const r = await fin();
  // Weekly buckets can start before FROM, but only rows inside the period are counted.
  assert.equal(t.points.reduce((a, p) => a + toCents(p.revenue), 0), toCents(r.completed_revenue));
  assert.equal(t.points.reduce((a, p) => a + p.completed_loads, 0), r.completed_loads);
});

test("customer 360 metrics match the customer's shipments", async () => {
  const cust = fx.data.shippers.find((s) => s.status === "active_customer");
  const mine = fx.data.shipments.filter((s) => s.shipper_id === cust.id && ["delivered", "completed"].includes(s.status));
  const r = (await owner(`select public.analytics_customer($1) as r`, [cust.id])).rows[0].r;
  assert.equal(r.completed, mine.length);
  assert.equal(toCents(r.revenue), mine.reduce((a, s) => a + s.customer_rate, 0));
});

test("staff can see operations but not financial analytics", async () => {
  await assert.rejects(h.as("authenticated", STAFF, (db) => db.query(`select public.analytics_financial($1, $2)`, [FROM, TO])), /insufficient_privilege/);
  const t = await h.as("authenticated", STAFF, (db) => db.query(`select public.analytics_trends($1, $2, 'month') as r`, [FROM, TO]));
  assert.ok(t.rows[0].r.points.every((p) => p.revenue === null), "money is withheld from staff, not shown as zero");
  const inv = await h.as("authenticated", STAFF, (db) => db.query(`select count(*)::int n from public.invoices`));
  assert.equal(inv.rows[0].n, 0);
});

test("empty period returns zeros and unavailable ratios, never invented values", async () => {
  const r = await fin("2001-01-01", "2001-01-31");
  assert.equal(toCents(r.completed_revenue), 0);
  assert.equal(r.completed_loads, 0);
  assert.equal(r.top3_share_pct, null);
});

test("contact to customer time is never negative and only counts contact before the first paid delivery", async () => {
  const r = (await owner(`select public.analytics_contact_to_customer($1, $2) as r`, [addDays(TODAY, -365), TO])).rows[0].r;
  assert.equal(r.available, true);
  if (r.customers > 0) assert.ok(Number(r.avg_days) >= 0, `avg_days ${r.avg_days}`);
  const staff = await h.as("authenticated", STAFF, (db) => db.query(`select public.analytics_contact_to_customer($1, $2) as r`, [FROM, TO]));
  assert.equal(staff.rows[0].r.available, false, "payment based metric is unavailable to staff, not zero");
});
