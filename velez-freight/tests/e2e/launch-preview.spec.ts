// Authenticated launch preview, tested against the PRELAUNCH build: the preview renders the launch
// state for administrators only, simulates submissions, and never changes the public website.
import { expect, test } from "@playwright/test";
import { PRELAUNCH, STAFF, resetRateLimits, seedUsers, signIn, sql } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => seedUsers());
test.beforeEach(async () => resetRateLimits());

const count = async (table: string) => Number((await sql<{ n: string }>(`select count(*)::text as n from public.${table}`))[0].n);

test("signed out visitors and staff members cannot open the preview", async ({ page }) => {
  for (const path of ["/admin/preview", "/admin/preview/request-quote"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  await signIn(page, STAFF);
  await page.goto("/admin/preview");
  await expect(page).toHaveURL(/\/admin\?denied=1$/);
  await expect(page.getByRole("region", { name: "Launch preview" })).toHaveCount(0);
});

test("administrators see the launch state, clearly labeled and not indexed", async ({ page }) => {
  await signIn(page);
  const res = await page.goto("/admin/preview");
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  expect(res?.headers()["cache-control"]).toContain("no-store");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("region", { name: "Launch preview" })).toContainText("simulation only");
  await expect(page.getByRole("link", { name: /Request a Freight Quote/ }).first()).toBeVisible();
  await expect(page.getByText("Let’s Stay Connected")).toHaveCount(0);
  await expect(page.locator("[data-preview-credential]").first()).toContainText("MC [pending verification]");

  // The public website, in the same signed in browser, is still in prelaunch mode.
  await page.goto("/");
  await expect(page.getByText("Let’s Stay Connected")).toBeVisible();
  await expect(page.locator("[data-preview-credential]")).toHaveCount(0);
  await page.goto("/request-quote");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tell Us About Your Business");
});

test("links stay inside the preview", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/preview");
  await page.getByRole("banner").getByRole("link", { name: "Shippers", exact: false }).first().click();
  await expect(page).toHaveURL(/\/admin\/preview\/shippers$/);
  await expect(page.getByRole("region", { name: "Launch preview" })).toBeVisible();
  await page.getByRole("link", { name: /Request a Freight Quote/ }).last().click();
  await expect(page).toHaveURL(/\/admin\/preview\/request-quote$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tell Us About Your Freight");
});

test("preview submissions are validated but never saved or sent", async ({ page }) => {
  await signIn(page); // signing in writes its own audit entry, so count after it
  const before = { contact: await count("contact_inquiries"), quote: await count("quote_inquiries"), notes: await count("notifications"), audit: await count("audit_events") };
  await page.goto("/admin/preview/contact");
  await page.getByRole("button", { name: /Send Your Message/ }).click();
  await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Name").fill("Preview Person");
  await page.getByLabel("Business email").fill("preview@example.test");
  await page.getByLabel("Message").fill("Checking how the contact form will behave at launch.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Send Your Message/ }).click();
  await expect(page.getByText(/Reference PREVIEW-[0-9A-F]{6}/)).toBeVisible();
  await expect(page.getByText(/was not saved, sent, or shared/)).toBeVisible();

  expect(await count("contact_inquiries")).toBe(before.contact);
  expect(await count("quote_inquiries")).toBe(before.quote);
  expect(await count("notifications")).toBe(before.notes);
  expect(await count("audit_events")).toBe(before.audit);
  expect(await sql("select 1 from public.contact_inquiries where email = 'preview@example.test'")).toHaveLength(0);
});
