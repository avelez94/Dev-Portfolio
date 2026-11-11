import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const root = new URL("../../", import.meta.url);
export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
export const OWNER = "33333333-3333-3333-3333-333333333333";
export const STAFF = "11111111-1111-1111-1111-111111111111";

/** Creates a throwaway database with the Supabase stand in and every migration applied. */
export async function freshDatabase(name) {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  const db = new pg.Client({ connectionString: ADMIN_URL.replace(/\/[^/]*$/, `/${name}`) });
  await db.connect();
  await db.query(readFileSync(new URL("tests/db/supabase-stub.sql", root), "utf8"));
  for (const f of readdirSync(new URL("supabase/migrations/", root)).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(new URL(`supabase/migrations/${f}`, root), "utf8"));
  }
  await db.query(`insert into auth.users (id, email) values ($1, 'owner@example.test'), ($2, 'staff@example.test')`, [OWNER, STAFF]);
  await db.query(`update public.profiles set is_active = true, role = 'owner' where id = $1`, [OWNER]);
  await db.query(`update public.profiles set is_active = true, role = 'staff' where id = $1`, [STAFF]);
  const drop = async () => {
    await db.end();
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  };
  /** Runs fn as a role and JWT subject inside a transaction that is rolled back (or committed). */
  const as = async (role, sub, fn, commit = false) => {
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub ?? ""]);
      const out = await fn(db);
      await db.query(commit ? "commit" : "rollback");
      return out;
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  };
  return { db, drop, as };
}

/** Calendar date of an instant in the business time zone. */
export function nyDate(isoString) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(isoString));
}
export const toCents = (v) => Math.round(Number(v) * 100);
export function addDays(d, n) {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
