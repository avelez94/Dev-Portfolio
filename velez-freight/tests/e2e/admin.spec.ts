import { expect, test, type Page } from "@playwright/test";
import { INACTIVE, OWNER, PRELAUNCH, resetRateLimits, seedUsers, sql } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => seedUsers());
test.beforeEach(async () => resetRateLimits());

async function signIn(page: Page, email = OWNER.email, password = OWNER.password) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (password === OWNER.password) await expect(page).toHaveURL(/\/admin$/);
}

test("admin routes redirect signed out visitors to sign in, with no public sign up", async ({ page }) => {
  for (const path of ["/admin", "/admin/inquiries", "/admin/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  await expect(page.getByText(/sign up/i)).toHaveCount(0);
  const robots = await page.request.get("/admin/login");
  expect(robots.headers()["x-robots-tag"]).toContain("noindex");
});

test("wrong password and deactivated accounts are refused", async ({ page }) => {
  await signIn(page, OWNER.email, "wrong password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email or password is incorrect.");
  await signIn(page, INACTIVE.email, INACTIVE.password);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("does not have dashboard access");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("owner signs in and works an inquiry: status, follow up, note, task, convert to prospect", async ({ page }) => {
  await sql(`insert into public.contact_inquiries (inquiry_type, name, email, company, message, privacy_ack) values ('shipper','Morgan Lane','morgan@example.test','Lane Distribution','We ship 20 pallets a week to Ohio.', true)`);
  await signIn(page);
  await expect(page.getByRole("heading", { name: /Welcome, Test/ })).toBeVisible();
  await expect(page.getByText("Prelaunch mode: quote intake off")).toBeVisible();

  await page.getByRole("link", { name: "Website Inquiries" }).click();
  await page.getByRole("link", { name: "Shipper", exact: true }).click();
  await expect(page).toHaveURL(/type=shipper/);
  await page.getByRole("row", { name: /Lane Distribution/ }).getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Lane Distribution" })).toBeVisible();

  await page.getByLabel("Status").selectOption("follow_up");
  await page.getByLabel("Follow up date").fill("2030-01-15");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.getByLabel("New note").fill("Called Morgan. Weekly Ohio lane, wants to talk after launch.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Called Morgan. Weekly Ohio lane")).toBeVisible();

  await page.getByLabel("Task").fill("Send launch update to Morgan");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Send launch update to Morgan")).toBeVisible();

  await page.getByRole("button", { name: "Create shipper prospect" }).click();
  await expect(page).toHaveURL(/\/admin\/shippers\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Company *")).toHaveValue("Lane Distribution");

  const [inq] = await sql<{ status: string; follow_up_date: Date }>("select status, follow_up_date from public.contact_inquiries where email = 'morgan@example.test'");
  expect(inq.status).toBe("follow_up");
  const audit = await sql<{ action: string }>("select action from public.audit_events where actor_id = $1 order by id", [OWNER.id]);
  expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["auth.signed_in", "contact_inquiries.updated", "crm_note.created", "follow_up_task.created", "shipper_prospect.created_from_inquiry"]));
});

test("shipper CRM: create a prospect and move it through the pipeline", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/shippers/new");
  await page.getByLabel("Company *").fill("Patapsco Paper Goods");
  await page.getByLabel("Industry").fill("Packaging");
  await page.getByLabel("Contact status").selectOption("researching");
  await page.getByRole("button", { name: "Create prospect" }).click();
  await expect(page.getByRole("heading", { name: "Patapsco Paper Goods" })).toBeVisible();
  await page.getByLabel("Contact status").selectOption("qualified");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/admin/shippers?status=qualified");
  await expect(page.getByRole("link", { name: "Patapsco Paper Goods" })).toBeVisible();
});

test("carrier leads: verification requires a recorded date", async ({ page }) => {
  await sql(`insert into public.carrier_leads (company_name, usdot_number, equipment) values ('Severn Freight Lines', '1234567', '{dry_van}')`);
  await signIn(page);
  await page.goto("/admin/carriers");
  await page.getByRole("link", { name: "Severn Freight Lines" }).click();
  await page.getByLabel("Verification status").selectOption("verified");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Record the date you verified/)).toBeVisible();
  await page.getByLabel("Verified on").fill("2026-11-01");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByRole("link", { name: /FMCSA SAFER/ })).toBeVisible();
});

test("settings: enabling operations requires typed confirmation and verification facts", async ({ page }) => {
  await sql("update public.business_settings set operations_enabled = false, authority_verified_on = null, mc_number = null where id = 1");
  await signIn(page);
  await page.goto("/admin/settings");
  await expect(page.getByText(/BROKER_AUTHORITY_ACTIVE.*false/)).toBeVisible();
  await page.getByLabel("Operations enabled (accept freight quote inquiries)").check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/type ENABLE OPERATIONS/)).toBeVisible();
  await page.getByLabel("To turn operations ON, type ENABLE OPERATIONS").fill("ENABLE OPERATIONS");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/Record the MC number and the date/)).toBeVisible();
  const [s] = await sql<{ operations_enabled: boolean }>("select operations_enabled from public.business_settings where id = 1");
  expect(s.operations_enabled).toBe(false);

  await page.reload();
  await page.getByLabel("Public business email").fill("hello@example.test");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/Settings saved/)).toBeVisible();
});

test("activity log lists events and sign out ends the session", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/activity");
  await expect(page.getByRole("cell", { name: "auth.signed_in" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
