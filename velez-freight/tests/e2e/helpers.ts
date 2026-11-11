import pg from "pg";
import type { Page } from "@playwright/test";

export const PRELAUNCH = process.env.E2E_PRELAUNCH_URL ?? "http://localhost:3101";
export const OPERATIONAL = process.env.E2E_OPERATIONAL_URL ?? "http://localhost:3102";

let client: pg.Client | null = null;
export async function db() {
  if (!client) {
    client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
    await client.connect();
  }
  return client;
}
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return (await (await db()).query(text, params)).rows as T[];
}
export async function resetRateLimits() {
  await sql("delete from public.submission_rate_limits");
}

export const OWNER = { id: "aaaaaaaa-0000-4000-8000-000000000001", email: "owner@example.test", password: "correct horse battery staple" };
export const INACTIVE = { id: "aaaaaaaa-0000-4000-8000-000000000002", email: "former@example.test", password: "another long passphrase" };

export async function seedUsers() {
  await sql(`insert into auth.users (id, email) values ($1, $2), ($3, $4) on conflict do nothing`, [OWNER.id, OWNER.email, INACTIVE.id, INACTIVE.email]);
  await sql(`update public.profiles set role = 'owner', is_active = true, full_name = 'Test Owner' where id = $1`, [OWNER.id]);
  await fetch(`${process.env.FAKE_SUPABASE_URL}/__seed`, { method: "POST", body: JSON.stringify({ users: [OWNER, INACTIVE] }) });
}

/** Forms reject submissions made faster than a human could; give the token time to age. */
export async function humanPause(page: Page) {
  await page.waitForTimeout(450);
}
