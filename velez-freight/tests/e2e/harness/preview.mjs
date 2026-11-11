// LOCAL DEVELOPMENT PREVIEW ONLY. Starts the app against a throwaway local Postgres database
// through the test Supabase stand in, optionally loaded with the SYNTHETIC brokerage history.
// Refuses to run against anything but a local database.
//   node tests/e2e/harness/preview.mjs            empty prelaunch brokerage
//   node tests/e2e/harness/preview.mjs --synthetic  developed brokerage (operations enabled)
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { signJwt } from "./fake-supabase-jwt.mjs";
import { generateSyntheticBrokerage } from "../../fixtures/synthetic-brokerage.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const host = new URL(ADMIN_URL).hostname;
if (!["localhost", "127.0.0.1", "::1", ""].includes(host)) throw new Error("preview.mjs only runs against a local database");
const synthetic = process.argv.includes("--synthetic");
const DB = "vfg_preview";
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`);
const PORT = 54398;

const admin = new pg.Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`drop database if exists ${DB} with (force)`);
await admin.query(`create database ${DB}`);
await admin.end();
const db = new pg.Client({ connectionString: DB_URL });
await db.connect();
await db.query(readFileSync(`${root}tests/db/supabase-stub.sql`, "utf8"));
for (const f of readdirSync(`${root}supabase/migrations`).filter((f) => f.endsWith(".sql")).sort()) await db.query(readFileSync(`${root}supabase/migrations/${f}`, "utf8"));
const OWNER = { id: "aaaaaaaa-0000-4000-8000-000000000001", email: "owner@example.test", password: "correct horse battery staple" };
await db.query(`insert into auth.users (id, email) values ($1, $2)`, [OWNER.id, OWNER.email]);
await db.query(`update public.profiles set role = 'owner', is_active = true, full_name = 'Preview Owner' where id = $1`, [OWNER.id]);
if (synthetic) {
  await db.query(`update public.business_settings set operations_enabled = true, authority_verified_on = current_date, mc_number = '000000' where id = 1`);
  await db.query(generateSyntheticBrokerage().sql);
}
await db.end();

const env = { ...process.env, E2E_DATABASE_URL: DB_URL, FAKE_SUPABASE_PORT: String(PORT) };
const fake = spawn("node", ["tests/e2e/harness/fake-supabase.mjs"], { cwd: root, env, stdio: "inherit" });
await new Promise((r) => setTimeout(r, 800));
await fetch(`http://127.0.0.1:${PORT}/__seed`, { method: "POST", body: JSON.stringify({ users: [OWNER] }) });
const appEnv = {
  ...env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: signJwt({ role: "anon" }), SUPABASE_SERVICE_ROLE_KEY: signJwt({ role: "service_role" }),
  FORM_TOKEN_SECRET: "preview", BROKER_AUTHORITY_ACTIVE: synthetic ? "true" : "false", NEXT_DIST_DIR: ".next-preview",
};
console.log(`[preview] sign in at http://localhost:3300/admin/login as ${OWNER.email} / ${OWNER.password}`);
const app = spawn("npx", ["next", "dev", "--port", "3300"], { cwd: root, env: appEnv, stdio: "inherit" });
const stop = () => { fake.kill(); app.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
