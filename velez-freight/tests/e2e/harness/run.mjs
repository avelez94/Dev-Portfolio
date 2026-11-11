// End to end test orchestrator.
//  1. Creates a fresh local Postgres database with the real migration applied.
//  2. Starts the test only Supabase stand in (harness/fake-supabase.mjs).
//  3. Builds the app twice: prelaunch (BROKER_AUTHORITY_ACTIVE=false) and operational (true).
//  4. Starts both production servers and runs Playwright against them.
// Usage: npm run test:e2e   (set E2E_SKIP_BUILD=1 to reuse existing builds)
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { signJwt } from "./fake-supabase-jwt.mjs";
import { generateSyntheticBrokerage } from "../../fixtures/synthetic-brokerage.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const DB = "vfg_e2e";
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`);
const FAKE_PORT = 54399;
const procs = [];

const env = {
  ...process.env,
  E2E_DATABASE_URL: DB_URL,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${FAKE_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: signJwt({ role: "anon", iss: "e2e" }),
  SUPABASE_SERVICE_ROLE_KEY: signJwt({ role: "service_role", iss: "e2e" }),
  NEXT_PUBLIC_SITE_URL: "http://localhost:3101",
  FORM_TOKEN_SECRET: "e2e-form-secret",
  FORM_MIN_FILL_MS: "300",
  RATE_LIMIT_SALT: "e2e-salt",
  NEXT_TELEMETRY_DISABLED: "1",
};

function run(cmd, args, extra = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: { ...env, ...extra } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}
function start(cmd, args, extra = {}, label) {
  // detached: each server gets its own process group so the whole tree (npx > next) is stopped.
  const p = spawn(cmd, args, { cwd: root, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  p.stdout.on("data", (d) => process.env.E2E_VERBOSE && process.stdout.write(`[${label}] ${d}`));
  p.stderr.on("data", (d) => process.stderr.write(`[${label}] ${d}`));
  procs.push(p);
  return p;
}
function stop(p) {
  try { process.kill(-p.pid, "SIGTERM"); } catch {}
}
async function assertPortFree(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`);
    throw new Error(`port ${port} is already in use; stop the old server first`);
  } catch (e) {
    if (String(e.message).includes("already in use")) throw e;
  }
}
async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function main() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.query(`create database ${DB}`);
  await admin.end();
  await assertPortFree(FAKE_PORT);
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  await db.query(readFileSync(`${root}tests/db/supabase-stub.sql`, "utf8"));
  for (const f of readdirSync(`${root}supabase/migrations`).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(`${root}supabase/migrations/${f}`, "utf8"));
  }

  start("node", ["tests/e2e/harness/fake-supabase.mjs"], { FAKE_SUPABASE_PORT: String(FAKE_PORT) }, "supabase");
  await waitFor(`http://127.0.0.1:${FAKE_PORT}/rest/v1/`);

  // Phases run one after another with one build at a time. Keeping two production builds of the
  // same project side by side caused runtime regenerated pages to reference missing chunks.
  const phases = [
    { name: "prelaunch", broker: "false", ops: false, port: 3101, specs: ["public.spec.ts", "admin.spec.ts", "a11y.spec.ts", "launch-preview.spec.ts", "settings-center.spec.ts"] },
    { name: "operational", broker: "true", ops: true, port: 3102, specs: ["operational.spec.ts", "brokerage.spec.ts"], synthetic: true },
  ];
  const extraArgs = process.argv.slice(2);
  let status = 0;
  for (const phase of phases) {
    const wanted = extraArgs.filter((a) => a.endsWith(".spec.ts"));
    const specs = wanted.length ? phase.specs.filter((s) => wanted.includes(s)) : phase.specs;
    if (!specs.length) continue;
    const flags = extraArgs.filter((a) => !a.endsWith(".spec.ts"));
    const site = `http://localhost:${phase.port}`;
    const phaseEnv = { NEXT_DIST_DIR: ".next-e2e", BROKER_AUTHORITY_ACTIVE: phase.broker, NEXT_PUBLIC_SITE_URL: site };
    await db.query(phase.ops
      ? `update public.business_settings set operations_enabled = true, authority_verified_on = current_date, mc_number = '000000' where id = 1`
      : `update public.business_settings set operations_enabled = false where id = 1`);
    // The developed brokerage phase loads clearly labeled SYNTHETIC history into the local test database only.
    if (phase.synthetic) await db.query(generateSyntheticBrokerage().sql);
    console.log(`\n=== ${phase.name}: building ===`);
    if (!process.env.E2E_SKIP_BUILD) run("npx", ["next", "build"], phaseEnv);
    await assertPortFree(phase.port);
    const server = start("npx", ["next", "start", "-p", String(phase.port)], phaseEnv, phase.name);
    await waitFor(`${site}/`);
    console.log(`=== ${phase.name}: testing ${specs.join(", ")} ===`);
    const pw = spawnSync("npx", ["playwright", "test", "--trace", "off", ...specs, ...flags], { cwd: root, stdio: "inherit", env: { ...env, E2E_PRELAUNCH_URL: "http://localhost:3101", E2E_OPERATIONAL_URL: "http://localhost:3102", FAKE_SUPABASE_URL: `http://127.0.0.1:${FAKE_PORT}` } });
    status ||= pw.status ?? 1;
    stop(server);
    await new Promise((r) => setTimeout(r, 1500));
  }
  await db.end();
  return status;
}

let code = 1;
try {
  code = await main();
} catch (e) {
  console.error(e);
} finally {
  procs.forEach(stop);
}
process.exit(code);
