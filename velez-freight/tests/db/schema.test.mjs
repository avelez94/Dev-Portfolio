// Database security tests. Applies the real migration to a throwaway local Postgres database
// with a minimal Supabase stand in (tests/db/supabase-stub.sql), then checks grants, RLS and
// server enforced rules as the anon, authenticated and service roles.
//
// Requires a local Postgres reachable as the "postgres" superuser. Configure with
// TEST_DATABASE_URL (default: postgres://postgres@localhost:5432/postgres via unix socket).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@%2Fvar%2Frun%2Fpostgresql/postgres";
const DB = `vfg_test_${process.pid}`;
const root = new URL("../../", import.meta.url);
let admin;
let db;

const STAFF = "11111111-1111-1111-1111-111111111111";
const OUTSIDER = "22222222-2222-2222-2222-222222222222";
const OWNER = "33333333-3333-3333-3333-333333333333";

/** Run fn inside a transaction as a given Postgres role and JWT subject, then roll back. */
async function as(role, sub, fn) {
  await db.query("begin");
  try {
    await db.query(`set local role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub ?? ""]);
    return await fn();
  } finally {
    await db.query("rollback");
  }
}
const migrations = () => readdirSync(new URL("supabase/migrations/", root)).filter((f) => f.endsWith(".sql")).sort();
const rollbacks = () => readdirSync(new URL("supabase/rollback/", root)).filter((f) => f.endsWith(".sql")).sort().reverse();
async function applyAll(client) {
  for (const f of migrations()) await client.query(readFileSync(new URL(`supabase/migrations/${f}`, root), "utf8"));
}
export { applyAll };
const denied = (p) => assert.rejects(p, /permission denied|row-level security|violates/);

before(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);
  db = new pg.Client({ connectionString: ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`) });
  await db.connect();
  await db.query(readFileSync(new URL("tests/db/supabase-stub.sql", root), "utf8"));
  await applyAll(db);
  // Users: an active staff member, an owner, and a signed in user who was never granted access.
  await db.query(`insert into auth.users (id, email) values ($1,'staff@example.test'),($2,'outsider@example.test'),($3,'owner@example.test')`, [STAFF, OUTSIDER, OWNER]);
  await db.query(`update public.profiles set is_active = true, role = 'staff' where id = $1`, [STAFF]);
  await db.query(`update public.profiles set is_active = true, role = 'owner' where id = $1`, [OWNER]);
  await db.query(`insert into public.contact_inquiries (inquiry_type, name, email, message) values ('general','Test Person','person@example.test','Hello there, testing')`);
});

after(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

test("new auth users get an inactive profile (invite only access)", async () => {
  const { rows } = await db.query(`select is_active, role from public.profiles where id = $1`, [OUTSIDER]);
  assert.equal(rows[0].is_active, false);
});

test("anon role has no access to any table", async () => {
  for (const t of ["contact_inquiries", "quote_inquiries", "shipper_prospects", "carrier_leads", "business_settings", "profiles", "audit_events", "crm_notes", "follow_up_tasks", "submission_rate_limits"]) {
    await as("anon", null, () => denied(db.query(`select * from public.${t} limit 1`)));
  }
  await as("anon", null, () => denied(db.query(`insert into public.contact_inquiries (inquiry_type,name,email) values ('general','x','x@example.test')`)));
});

test("anon cannot call the rate limit function directly", async () => {
  await as("anon", null, () => denied(db.query(`select public.check_rate_limit(repeat('a',64),'contact',5,60)`)));
});

test("signed in user without an active staff profile sees no rows", async () => {
  await as("authenticated", OUTSIDER, async () => {
    const { rows } = await db.query(`select * from public.contact_inquiries`);
    assert.equal(rows.length, 0);
    const s = await db.query(`select * from public.business_settings`);
    assert.equal(s.rows.length, 0);
  });
});

test("signed in outsider cannot create CRM records", async () => {
  await as("authenticated", OUTSIDER, () => denied(db.query(`insert into public.shipper_prospects (company) values ('Acme')`)));
});

test("active staff can read inquiries and manage CRM records", async () => {
  await as("authenticated", STAFF, async () => {
    const { rows } = await db.query(`select name from public.contact_inquiries`);
    assert.equal(rows.length, 1);
    const ins = await db.query(`insert into public.shipper_prospects (company, status) values ('Acme Manufacturing','researching') returning id`);
    assert.ok(ins.rows[0].id);
    await db.query(`update public.shipper_prospects set status = 'contacted' where id = $1`, [ins.rows[0].id]);
  });
});

test("staff cannot insert public inquiries directly (server only path)", async () => {
  await as("authenticated", STAFF, () => denied(db.query(`insert into public.contact_inquiries (inquiry_type,name,email) values ('general','x','x@example.test')`)));
});

test("staff cannot delete records; admins can", async () => {
  await as("authenticated", STAFF, async () => {
    const ins = await db.query(`insert into public.shipper_prospects (company) values ('Delete Me') returning id`);
    const del = await db.query(`delete from public.shipper_prospects where id = $1`, [ins.rows[0].id]);
    assert.equal(del.rowCount, 0, "RLS should silently filter the delete for staff");
  });
  await as("authenticated", OWNER, async () => {
    const ins = await db.query(`insert into public.shipper_prospects (company) values ('Delete Me') returning id`);
    const del = await db.query(`delete from public.shipper_prospects where id = $1`, [ins.rows[0].id]);
    assert.equal(del.rowCount, 1);
  });
});

test("staff cannot change business settings; owners can", async () => {
  await as("authenticated", STAFF, async () => {
    const r = await db.query(`update public.business_settings set status_message = 'x' where id = 1`);
    assert.equal(r.rowCount, 0);
  });
  await as("authenticated", OWNER, async () => {
    const r = await db.query(`update public.business_settings set status_message = 'Hello' where id = 1`);
    assert.equal(r.rowCount, 1);
  });
});

test("credentials: verified needs evidence, only verified can be public, EIN stays private", async () => {
  await assert.rejects(db.query(`update public.regulatory_credentials set value = '123456', status = 'verified' where kind = 'mc_number'`), /credential_verified_has_evidence/);
  await assert.rejects(db.query(`update public.regulatory_credentials set value = '123456', status = 'entered', show_publicly = true where kind = 'mc_number'`), /credential_public_only_when_verified/);
  await assert.rejects(db.query(`update public.regulatory_credentials set value = 'MC123' where kind = 'mc_number'`), /credential_numbers_format/);
  await assert.rejects(db.query(`update public.regulatory_credentials set value = '12', status = 'verified', verified_on = current_date, verification_source = 'IRS letter', show_publicly = true where kind = 'ein'`), /credential_ein_private/);
  await as("authenticated", STAFF, async () => {
    const { rows } = await db.query(`select kind from public.regulatory_credentials`);
    assert.ok(rows.length >= 10 && !rows.some((r) => r.kind === "ein"), "staff never see the EIN row");
    const r = await db.query(`update public.regulatory_credentials set value = '999' where kind = 'usdot_number'`);
    assert.equal(r.rowCount, 0, "staff cannot change credentials");
  });
});

test("credentials: changes are logged append only and MC and USDOT stay in step with settings", async () => {
  await as("authenticated", OWNER, async () => {
    await db.query(`update public.regulatory_credentials set value = '765432', status = 'entered' where kind = 'mc_number'`);
    await db.query(`update public.regulatory_credentials set status = 'verified', verified_on = current_date, verification_source = 'FMCSA licensing and insurance' where kind = 'mc_number'`);
    const { rows: events } = await db.query(`select action, from_status, to_status, actor from public.credential_events e join public.regulatory_credentials c on c.id = e.credential_id where c.kind = 'mc_number' order by e.id`);
    assert.deepEqual(events.slice(-2).map((e) => [e.action, e.from_status, e.to_status]), [["status_changed", "not_entered", "entered"], ["status_changed", "entered", "verified"]]);
    assert.equal(events.at(-1).actor, OWNER);
  });
  await db.query(`update public.regulatory_credentials set value = '765432', status = 'entered' where kind = 'mc_number'`);
  assert.equal((await db.query(`select mc_number from public.business_settings where id = 1`)).rows[0].mc_number, "765432");
  await assert.rejects(db.query(`update public.credential_events set to_status = 'x'`), /append only/);
  await assert.rejects(db.query(`delete from public.credential_events`), /append only/);
  await db.query(`update public.regulatory_credentials set status = 'rejected' where kind = 'mc_number'`);
  assert.equal((await db.query(`select mc_number from public.business_settings where id = 1`)).rows[0].mc_number, null);
  await db.query(`update public.regulatory_credentials set value = null, status = 'not_entered', verified_on = null, verification_source = null where kind = 'mc_number'`);
  const { rows: ein } = await db.query(`update public.regulatory_credentials set value = '12 3456789', status = 'entered' where kind = 'ein' returning id`);
  const { rows: einEvents } = await db.query(`select value_after from public.credential_events where credential_id = $1`, [ein[0].id]);
  assert.ok(einEvents.every((e) => e.value_after === null), "the EIN is never copied into history");
});

test("website text versions are append only and editable by admins only", async () => {
  await as("authenticated", STAFF, () => denied(db.query(`insert into public.site_content (key, value) values ('hero.body1', 'x')`)));
  await as("authenticated", OWNER, async () => {
    await db.query(`insert into public.site_content (key, value) values ('hero.body1', 'New text')`);
    await db.query(`insert into public.site_content_versions (key, version, value) values ('hero.body1', 1, 'New text')`);
    await assert.rejects(db.query(`update public.site_content_versions set value = 'tampered'`), /append only|permission denied/);
  });
  await db.query(`insert into public.site_content_versions (key, version, value) values ('hero.body2', 1, 'Text')`);
  await assert.rejects(db.query(`update public.site_content_versions set value = 'tampered'`), /append only/);
});

/** Expects a statement to fail inside an open transaction without aborting the rest of it. */
async function rejectsIn(q, params, re) {
  await db.query("savepoint expect_fail");
  await assert.rejects(db.query(q, params), re);
  await db.query("rollback to savepoint expect_fail");
}

test("outreach: nobody signed in can mark a message sent; sent needs provider proof; only admins approve", async () => {
  await as("authenticated", STAFF, async () => {
    const { rows: [m] } = await db.query(`insert into public.outreach_messages (to_email, subject, body, status) values ('a@example.test', 'Hi', 'Body', 'draft') returning id`);
    await rejectsIn(`update public.outreach_messages set status = 'sent', provider_message_id = 'x', sent_at = now() where id = $1`, [m.id], /server only|row-level security|violates/);
    await rejectsIn(`update public.outreach_messages set status = 'approved', approved_by = $2, approved_at = now() where id = $1`, [m.id, STAFF], /only owners and admins/);
    await rejectsIn(`update public.outreach_messages set delivery_status = 'delivered' where id = $1`, [m.id], /server only/);
  });
  await as("authenticated", OWNER, async () => {
    const { rows: [m] } = await db.query(`insert into public.outreach_messages (to_email, subject, body, status) values ('b@example.test', 'Hi', 'Body', 'pending_approval') returning id`);
    const r = await db.query(`update public.outreach_messages set status = 'approved', approved_by = $2, approved_at = now() where id = $1`, [m.id, OWNER]);
    assert.equal(r.rowCount, 1);
    await rejectsIn(`update public.outreach_messages set status = 'sending' where id = $1`, [m.id], /server only|row-level security|violates/);
  });
  // Even the server cannot record "sent" without the provider's message id.
  const { rows: [m] } = await db.query(`insert into public.outreach_messages (to_email, subject, body, status, approved_by, approved_at) values ('c@example.test', 'Hi', 'Body', 'approved', $1, now()) returning id`, [OWNER]);
  await assert.rejects(db.query(`update public.outreach_messages set status = 'sent', sent_at = now() where id = $1`, [m.id]), /outreach_sent_has_proof/);
  await db.query(`update public.outreach_messages set status = 'sent', sent_at = now(), provider_message_id = 'prov-1' where id = $1`, [m.id]);
  await assert.rejects(db.query(`insert into public.email_events (event_type) values ('x') returning id`).then(() => db.query(`update public.email_events set event_type = 'y'`)), /append only/);
});

test("outreach: template edits keep versions; suppressions are admin managed", async () => {
  const { rows: [t] } = await db.query(`select id, version from public.email_templates where name = 'Introduction to a shipper'`);
  assert.equal(t.version, 1);
  await db.query(`update public.email_templates set body = body || ' Edited.', version = 2 where id = $1`, [t.id]);
  const { rows: versions } = await db.query(`select version from public.email_template_versions where template_id = $1 order by version`, [t.id]);
  assert.deepEqual(versions.map((v) => v.version), [1, 2]);
  const { rows: gated } = await db.query(`select name from public.email_templates where requires_operational order by name`);
  assert.deepEqual(gated.map((g) => g.name), ["Launch announcement", "Quote follow up", "Shipment update"]);
  await as("authenticated", STAFF, () => denied(db.query(`insert into public.email_suppressions (email, reason) values ('x@example.test', 'manual')`)));
  await assert.rejects(db.query(`insert into public.email_suppressions (email, reason) values ('Upper@Example.test', 'manual')`), /check/);
});

test("staff cannot change their own role or activate profiles", async () => {
  await as("authenticated", STAFF, () => denied(db.query(`update public.profiles set role = 'owner' where id = $1`, [STAFF])));
});

test("audit log is append only, even for the service role", async () => {
  await db.query(`insert into public.audit_events (actor_type, action) values ('system','test.event')`);
  await assert.rejects(db.query(`update public.audit_events set action = 'tampered'`), /append only/);
  await assert.rejects(db.query(`delete from public.audit_events`), /append only/);
  await as("authenticated", STAFF, async () => {
    const { rows } = await db.query(`select * from public.audit_events`);
    assert.equal(rows.length, 0, "only owners and admins can read the audit log");
  });
  await as("authenticated", OWNER, async () => {
    const { rows } = await db.query(`select * from public.audit_events`);
    assert.ok(rows.length >= 1);
  });
});

const quote = `insert into public.quote_inquiries (pickup_address, delivery_address, pickup_date, freight_description, commodity, weight_lbs, equipment, company_name, contact_name, email, phone)
  values ('Baltimore, MD','Richmond, VA', current_date + 3, 'Ten pallets of boxed parts', 'Auto parts', 8000, 'dry_van', 'Acme', 'Pat', 'pat@example.test', '410 555 0100')`;

test("database refuses quote inquiries while operations are disabled", async () => {
  await as("service_role", null, () => assert.rejects(db.query(quote), /not accepted while operations are disabled/));
});

test("operations cannot be enabled without a recorded verification date", async () => {
  await assert.rejects(db.query(`update public.business_settings set operations_enabled = true where id = 1`), /operations_need_verification/);
});

test("quote inquiries are accepted once operations are enabled and verified", async () => {
  await db.query("begin");
  try {
    await db.query(`update public.business_settings set operations_enabled = true, authority_verified_on = current_date where id = 1`);
    await db.query("set local role service_role");
    const { rows } = await db.query(quote + " returning reference, status");
    assert.match(rows[0].reference, /^MLG-Q-[A-F0-9]{8}$/);
    assert.equal(rows[0].status, "pending_review");
  } finally {
    await db.query("rollback");
  }
});

test("rate limiter allows up to the limit and then refuses", async () => {
  await as("service_role", null, async () => {
    const key = "b".repeat(64);
    const results = [];
    for (let i = 0; i < 4; i++) {
      const { rows } = await db.query(`select public.check_rate_limit($1,'contact',3,3600) as ok`, [key]);
      results.push(rows[0].ok);
    }
    assert.deepEqual(results, [true, true, true, false]);
  });
});

test("input constraints reject malformed data at the database", async () => {
  await as("service_role", null, async () => {
    await assert.rejects(db.query(`insert into public.contact_inquiries (inquiry_type,name,email) values ('general','x','not-an-email')`), /check constraint/);
  });
  await as("service_role", null, async () => {
    await assert.rejects(db.query(`insert into public.carrier_leads (company_name, mc_number) values ('X','MC123')`), /check constraint/);
  });
  await as("service_role", null, async () => {
    await assert.rejects(db.query(`insert into public.contact_inquiries (inquiry_type,name,email) values ('sales','x','x@example.test')`), /check constraint/);
  });
});

test("rollback scripts remove every object cleanly", async () => {
  const name = `${DB}_rb`;
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  const c = new pg.Client({ connectionString: ADMIN_URL.replace(/\/[^/]*$/, `/${name}`) });
  await c.connect();
  try {
    await c.query(readFileSync(new URL("tests/db/supabase-stub.sql", root), "utf8"));
    await applyAll(c);
    for (const f of rollbacks()) await c.query(readFileSync(new URL(`supabase/rollback/${f}`, root), "utf8"));
    const { rows } = await c.query(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
    assert.equal(rows[0].n, 0);
  } finally {
    await c.end();
    await admin.query(`drop database if exists ${name}`);
  }
});
