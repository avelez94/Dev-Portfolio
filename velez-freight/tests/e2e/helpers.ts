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
export const STAFF = { id: "aaaaaaaa-0000-4000-8000-000000000003", email: "staff@example.test", password: "staff member passphrase" };

export async function seedUsers() {
  await sql(`insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6) on conflict do nothing`, [OWNER.id, OWNER.email, INACTIVE.id, INACTIVE.email, STAFF.id, STAFF.email]);
  await sql(`update public.profiles set role = 'owner', is_active = true, full_name = 'Test Owner' where id = $1`, [OWNER.id]);
  await sql(`update public.profiles set role = 'staff', is_active = true, full_name = 'Sam Staff' where id = $1`, [STAFF.id]);
  await fetch(`${process.env.FAKE_SUPABASE_URL}/__seed`, { method: "POST", body: JSON.stringify({ users: [OWNER, INACTIVE, STAFF] }) });
}

export async function signIn(page: Page, user: { email: string; password: string } = OWNER) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

/** Forms reject submissions made faster than a human could; give the token time to age. */
export async function humanPause(page: Page) {
  await page.waitForTimeout(450);
}
