// Workflow rules: prelaunch gates, carrier qualification, task generation and deduplication,
// overdue logic, stage history, notifications and disabled report schedules.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID as randomId } from "node:crypto";
import { addDays, freshDatabase, OWNER, STAFF } from "./helpers.mjs";

let h;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
before(async () => { h = await freshDatabase(`vfg_workflow_${process.pid}`); });
after(async () => h?.drop());

const sh = async () => (await h.db.query(`insert into public.shipper_prospects (company, status) values ('Acme Test Co', 'researching') returning id`)).rows[0].id;
const carrier = async (verified = true) => {
  const id = (await h.db.query(`insert into public.carrier_leads (company_name, verification_status, insurance_expires_on, agreement_signed_on, source)
    values ('Test Carrier', $1, $2, $3, 'manual') returning id`, [verified ? "verified" : "unverified", addDays(TODAY, 120), verified ? TODAY : null])).rows[0].id;
  if (verified) {
    await h.db.query(`insert into public.carrier_verifications (carrier_id, check_type, result, source) values ($1, 'authority', 'pass', 'FMCSA test'), ($1, 'insurance', 'pass', 'COI test')`, [id]);
  }
  return id;
};
const enableOps = (on) => h.db.query(`update public.business_settings set operations_enabled = $1, authority_verified_on = current_date, mc_number = '1' where id = 1`, [on]);
const shipmentSql = `insert into public.shipments (shipper_id, carrier_id, freight_type, equipment, origin_city, origin_state, dest_city, dest_state, customer_rate, carrier_cost)
  values ($1, $2, 'general', 'dry_van', 'Baltimore', 'MD', 'Richmond', 'VA', 1500, 1300) returning id`;

test("prelaunch: quotes, shipments, invoices and carrier bills are refused by the database", async () => {
  await enableOps(false);
  const s = await sh();
  await assert.rejects(h.db.query(shipmentSql, [s, null]), /prelaunch/);
  await assert.rejects(h.db.query(`insert into public.quotes (shipper_id, freight_type, equipment, origin_city, origin_state, dest_city, dest_state, customer_rate, estimated_carrier_cost)
    values ($1, 'general', 'dry_van', 'A', 'MD', 'B', 'VA', 1, 1)`, [s]), /prelaunch/);
  await assert.rejects(h.db.query(`insert into public.invoices (shipper_id, amount) values ($1, 10)`, [s]), /prelaunch/);
  // Expenses and CRM work are allowed before launch.
  await h.db.query(`insert into public.operating_expenses (category, description, amount, incurred_on) values ('licensing', 'Broker bond premium', 1200, current_date)`);
});

test("carrier qualification: unverified carriers cannot be assigned to a shipment", async () => {
  await enableOps(true);
  const s = await sh();
  const bad = await carrier(false);
  await assert.rejects(h.db.query(shipmentSql, [s, bad]), /not qualified/);
  const good = await carrier(true);
  const { rows } = await h.db.query(shipmentSql, [s, good]);
  assert.ok(rows[0].id);
  const q = (await h.db.query(`select public.carrier_qualification($1) as q`, [bad])).rows[0].q;
  assert.equal(q.qualified, false);
  assert.equal(q.authority_current, false);
});

test("carrier qualification follows access rules: staff see the result, other signed in accounts see nothing", async () => {
  await enableOps(true);
  const good = await carrier(true);
  const outsider = "44444444-4444-4444-4444-444444444444";
  await h.db.query(`insert into auth.users (id, email) values ($1, 'outsider@example.test') on conflict do nothing`, [outsider]);
  const check = (who) => h.as("authenticated", who, async (db) => (await db.query(`select public.carrier_qualification($1) as q`, [good])).rows[0].q);
  assert.equal((await check(STAFF)).qualified, true);
  const hidden = await check(outsider);
  assert.equal(hidden.qualified, false);
  assert.equal(hidden.authority_current, false);
  // Staff can still assign the qualified carrier through the database trigger.
  const s = await sh();
  const id = await h.as("authenticated", STAFF, async (db) => (await db.query(shipmentSql, [s, good])).rows[0].id);
  assert.ok(id);
});

test("carrier qualification: an authority check older than 30 days is not current", async () => {
  const id = (await h.db.query(`insert into public.carrier_leads (company_name, verification_status, insurance_expires_on, agreement_signed_on) values ('Stale Check Co', 'verified', $1, $2) returning id`, [addDays(TODAY, 90), TODAY])).rows[0].id;
  await h.db.query(`insert into public.carrier_verifications (carrier_id, check_type, result, source, checked_on) values ($1, 'authority', 'pass', 'FMCSA', $2), ($1, 'insurance', 'pass', 'COI', $2)`, [id, addDays(TODAY, -45)]);
  const q = (await h.db.query(`select public.carrier_qualification($1) as q`, [id])).rows[0].q;
  assert.equal(q.qualified, false);
});

test("shipment events set verified pickup and delivery facts; events are append only", async () => {
  const s = await sh();
  const c = await carrier(true);
  const id = (await h.db.query(shipmentSql, [s, c])).rows[0].id;
  await h.db.query(`insert into public.shipment_events (shipment_id, event_type, occurred_at, verified, source) values ($1, 'picked_up', now() - interval '1 day', true, 'driver call')`, [id]);
  await h.db.query(`insert into public.shipment_events (shipment_id, event_type, occurred_at, verified, source) values ($1, 'delivered', now(), false, 'customer email')`, [id]);
  const row = (await h.db.query(`select status, pickup_verified, delivery_verified from public.shipments where id = $1`, [id])).rows[0];
  assert.deepEqual(row, { status: "delivered", pickup_verified: true, delivery_verified: false });
  await assert.rejects(h.db.query(`update public.shipment_events set verified = true where shipment_id = $1`, [id]), /append only/);
});

test("stage changes are recorded as immutable history", async () => {
  const s = await sh();
  await h.as("authenticated", STAFF, (db) => db.query(`update public.shipper_prospects set status = 'contacted' where id = $1`, [s]), true);
  const ev = (await h.db.query(`select from_status, to_status, changed_by from public.prospect_stage_events where shipper_id = $1 order by id`, [s])).rows;
  assert.deepEqual(ev.map((e) => [e.from_status, e.to_status]), [[null, "researching"], ["researching", "contacted"]]);
  assert.equal(ev[1].changed_by, STAFF);
  await assert.rejects(h.db.query(`update public.prospect_stage_events set to_status = 'active_customer' where shipper_id = $1`, [s]), /append only/);
});

test("a new website inquiry creates exactly one review task; reviewing it resolves the task", async () => {
  const { rows } = await h.db.query(`insert into public.contact_inquiries (inquiry_type, name, email, message) values ('shipper', 'Pat', 'pat@example.test', 'Need help with freight') returning id`);
  const tasks = (await h.db.query(`select * from public.follow_up_tasks where entity_id = $1`, [rows[0].id])).rows;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].category, "inquiry_review");
  assert.equal(tasks[0].priority_tier, 3);
  await h.db.query(`update public.contact_inquiries set status = 'in_review' where id = $1`, [rows[0].id]);
  const after = (await h.db.query(`select status, resolution from public.follow_up_tasks where entity_id = $1`, [rows[0].id])).rows[0];
  assert.deepEqual(after, { status: "done", resolution: "auto_resolved" });
  const notes = (await h.db.query(`select count(*)::int n from public.notifications where link = $1`, [`/admin/inquiries/contact/${rows[0].id}`])).rows[0].n;
  assert.equal(notes, 1);
});

test("system task refresh is idempotent and does not recreate dismissed tasks", async () => {
  const s = await sh();
  await h.db.query(`update public.shipper_prospects set next_follow_up = $2 where id = $1`, [s, addDays(TODAY, -2)]);
  await h.db.query(`select public.refresh_system_tasks(true)`);
  await h.db.query(`select public.refresh_system_tasks(true)`);
  const key = `prospect_follow_up:${s}:${addDays(TODAY, -2)}`;
  let rows = (await h.db.query(`select id, status from public.follow_up_tasks where dedupe_key = $1`, [key])).rows;
  assert.equal(rows.length, 1, "no duplicates");
  await h.db.query(`update public.follow_up_tasks set status = 'done', resolution = 'completed', completed_at = now() where id = $1`, [rows[0].id]);
  await h.db.query(`select public.refresh_system_tasks(true)`);
  rows = (await h.db.query(`select id from public.follow_up_tasks where dedupe_key = $1`, [key])).rows;
  assert.equal(rows.length, 1, "completed task is not recreated");
  // Rescheduling creates a new follow up for the new date.
  await h.db.query(`update public.shipper_prospects set next_follow_up = $2 where id = $1`, [s, TODAY]);
  await h.db.query(`select public.refresh_system_tasks(true)`);
  assert.equal((await h.db.query(`select count(*)::int n from public.follow_up_tasks where entity_id = $1 and source = 'system'`, [s])).rows[0].n, 2);
});

test("refresh is throttled unless forced", async () => {
  await h.db.query(`select public.refresh_system_tasks(true)`);
  const { rows } = await h.db.query(`select public.refresh_system_tasks(false) as n`);
  assert.equal(rows[0].n, 0);
});

test("overdue invoice creates a financial risk task that auto resolves when paid", async () => {
  await enableOps(true);
  const s = await sh();
  const inv = (await h.db.query(`insert into public.invoices (shipper_id, status, issued_on, due_on, amount) values ($1, 'issued', $2, $3, 2000) returning id`, [s, addDays(TODAY, -45), addDays(TODAY, -15)])).rows[0].id;
  await h.db.query(`select public.refresh_system_tasks(true)`);
  const t = (await h.db.query(`select priority_tier, status, title from public.follow_up_tasks where entity_id = $1`, [inv])).rows;
  assert.equal(t.length, 1);
  assert.equal(t[0].priority_tier, 2);
  assert.match(t[0].title, /15 days overdue/);
  await h.db.query(`insert into public.invoice_payments (invoice_id, amount, received_on, method) values ($1, 2000, current_date, 'ach')`, [inv]);
  await h.db.query(`select public.refresh_system_tasks(true)`);
  const after = (await h.db.query(`select status, resolution from public.follow_up_tasks where entity_id = $1`, [inv])).rows[0];
  assert.deepEqual(after, { status: "done", resolution: "auto_resolved" });
});

test("open shipment exceptions are critical priorities", async () => {
  const s = await sh();
  const c = await carrier(true);
  const id = (await h.db.query(shipmentSql, [s, c])).rows[0].id;
  await h.db.query(`insert into public.shipment_exceptions (shipment_id, exception_type, description) values ($1, 'damage', 'Pallet damaged')`, [id]);
  await h.db.query(`select public.refresh_system_tasks(true)`);
  const t = (await h.db.query(`select priority_tier from public.follow_up_tasks where entity_id = $1 and category = 'shipment'`, [id])).rows;
  assert.equal(t[0].priority_tier, 1);
});

test("completing a recurring task schedules the next one", async () => {
  const id = (await h.db.query(`insert into public.follow_up_tasks (title, due_date, recurrence, category) values ('Weekly pipeline review', $1, 'weekly', 'admin') returning id`, [TODAY])).rows[0].id;
  await h.db.query(`update public.follow_up_tasks set status = 'done', resolution = 'completed', completed_at = now() where id = $1`, [id]);
  const next = (await h.db.query(`select due_date::text from public.follow_up_tasks where title = 'Weekly pipeline review' and status = 'open'`)).rows;
  assert.deepEqual(next, [{ due_date: addDays(TODAY, 7) }]);
});

test("report schedules cannot be enabled until delivery is approved", async () => {
  await assert.rejects(h.db.query(`insert into public.report_schedules (report_key, cadence, enabled) values ('executive', 'weekly', true)`), /check constraint/);
});

test("staff cannot read or write financial tables, and cannot call refresh as anon", async () => {
  await h.as("authenticated", STAFF, async (db) => {
    assert.equal((await db.query(`select count(*)::int n from public.operating_expenses`)).rows[0].n, 0);
    await assert.rejects(db.query(`insert into public.operating_expenses (category, description, amount, incurred_on) values ('other', 'x', 1, current_date)`), /row-level security/);
  });
  await assert.rejects(h.as("anon", null, (db) => db.query(`select public.refresh_system_tasks(true)`)), /permission denied/);
  await h.as("authenticated", OWNER, async (db) => {
    assert.ok((await db.query(`select count(*)::int n from public.operating_expenses`)).rows[0].n >= 1);
  });
});

test("document files must live under their own record's folder with a random name", async () => {
  const c = await carrier(false);
  const other = await carrier(false);
  const id = "0b5a2c3e-1f2d-4c5b-8a9e-112233445566";
  const ins = (path, extra = {}) => h.db.query(
    `insert into public.documents (entity_type, entity_id, doc_type, storage_path, file_name, file_size, content_type)
     values ('carrier_lead', $1, 'insurance_certificate', $2, $3, $4, $5) returning id`,
    [c, path, extra.name ?? "coi.pdf", extra.size ?? 1000, extra.type ?? "application/pdf"]);
  assert.ok((await ins(`carrier_lead/${c}/${id}.pdf`)).rows[0].id);
  await assert.rejects(ins(`carrier_lead/${other}/${randomId()}.pdf`), /documents_storage_path_format/);
  await assert.rejects(ins(`carrier_lead/${c}/coi-final.pdf`), /documents_storage_path_format/);
  await assert.rejects(ins(`carrier_lead/${c}/${randomId()}.exe`), /documents_storage_path_format/);
  await assert.rejects(ins(`carrier_lead/${c}/${randomId()}.pdf`, { type: "text/html" }), /content_type/);
  await assert.rejects(ins(`carrier_lead/${c}/${id}.pdf`), /documents_storage_path_idx|duplicate/);
  // A record without a file stays valid; a file without its details does not.
  await h.db.query(`insert into public.documents (entity_type, entity_id, doc_type) values ('carrier_lead', $1, 'w9')`, [c]);
  await assert.rejects(h.db.query(`insert into public.documents (entity_type, entity_id, doc_type, storage_path) values ('carrier_lead', $1, 'w9', $2)`, [c, `carrier_lead/${c}/${randomId()}.pdf`]), /documents_file_details/);
});
