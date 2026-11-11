// Agents: all off by default; AI agents cannot be enabled; the rules based brief runs on demand.
import { expect, test } from "@playwright/test";
import { PRELAUNCH, STAFF, resetRateLimits, seedUsers, signIn, sql } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => seedUsers());
test.beforeEach(async () => resetRateLimits());
test.afterAll(async () => sql(`update public.agent_definitions set status = 'disabled'`));

test("every agent starts off; AI agents show as not connected and cannot be enabled", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/agents");
  await expect(page.getByText("On", { exact: true })).toHaveCount(0);
  await expect(page.getByText("AI, not connected")).toHaveCount(4);
  await expect(page.getByText(/Stays off until you approve an AI provider/).first()).toBeVisible();
  expect((await sql<{ n: number }>(`select count(*)::int n from public.agent_definitions where status = 'enabled'`))[0].n).toBe(0);
});

test("executive brief: typed confirmation to enable, then a factual brief from real counts", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/agents");
  const card = page.locator("li", { has: page.getByRole("heading", { name: "Executive Insights" }) });
  await card.getByRole("button", { name: "Enable" }).click();
  await expect(card.getByText("To enable this agent, type ENABLE AGENT.")).toBeVisible();
  await card.getByLabel("To enable, type ENABLE AGENT").fill("ENABLE AGENT");
  await card.getByRole("button", { name: "Enable" }).click();
  await expect(card.getByRole("button", { name: "Run now" })).toBeVisible();
  await card.getByRole("button", { name: "Run now" }).click();
  await expect(page.getByRole("heading", { name: /Executive brief/ })).toBeVisible();
  const [counts] = await sql<{ n: number }>(`select count(*)::int n from public.shipper_prospects where created_at >= now() - interval '7 days'`);
  await expect(page.getByText(new RegExp(`${counts.n} shippers? added in the last 7 days`))).toBeVisible();
  await expect(page.getByText(/Prelaunch: brokerage operations are off/)).toBeVisible();
  const [run] = await sql<{ status: string; output: { sections: unknown[] } }>(`select status, output from public.agent_runs order by started_at desc limit 1`);
  expect(run.status).toBe("succeeded");
  expect(run.output.sections.length).toBe(5);
});

test("staff can read what agents do but cannot enable them or see runs", async ({ page }) => {
  await signIn(page, STAFF);
  await page.goto("/admin/agents");
  await expect(page.getByRole("heading", { name: "Executive Insights" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run now" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enable" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Executive brief/ })).toHaveCount(0);
});
