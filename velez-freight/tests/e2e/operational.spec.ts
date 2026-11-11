import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { humanPause, OPERATIONAL, resetRateLimits, sql } from "./helpers";

test.use({ baseURL: OPERATIONAL });
test.beforeEach(async () => {
  await resetRateLimits();
  await sql("update public.business_settings set operations_enabled = true, authority_verified_on = current_date, mc_number = '000000' where id = 1");
});

const inFiveDays = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);

async function fillWizard(page: import("@playwright/test").Page) {
  await page.goto("/");
  const quick = page.getByRole("form", { name: "Quick freight inquiry" });
  await quick.getByRole("button", { name: /Request a Quote/ }).click();
  await expect(quick.getByText("Enter a pickup city, state or ZIP.")).toBeVisible();
  await quick.getByLabel("Pickup location").fill("Baltimore, MD 21230");
  await quick.getByLabel("Delivery location").fill("Richmond, VA");
  await quick.getByLabel("Shipment type").selectOption("dry_van");
  await quick.getByLabel("Est. weight (lbs)").fill("8000");
  await quick.getByLabel("Desired pickup date").fill(inFiveDays);
  await quick.getByRole("button", { name: /Request a Quote/ }).click();
  await expect(page).toHaveURL(/\/request-quote\?/);

  await expect(page.getByLabel("Pickup location")).toHaveValue("Baltimore, MD 21230");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Freight details" })).toBeFocused();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Freight description is required.")).toBeVisible();
  await page.getByLabel("Freight description").fill("Twelve pallets of boxed replacement parts");
  await page.getByLabel("Commodity").fill("Auto parts");
  await expect(page.getByLabel("Total weight (lbs)")).toHaveValue("8000");
  await page.getByLabel("Number of pallets or pieces").fill("12");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Company name").fill("Chesapeake Components");
  await page.getByLabel("Contact name").fill("Riley Planner");
  await page.getByLabel("Business email").fill("riley@example.test");
  await page.getByLabel("Phone number").fill("443 555 0110");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Review and submit" })).toBeVisible();
  await expect(page.getByText("Chesapeake Components")).toBeVisible();
  await page.getByRole("checkbox").check();
  await humanPause(page);
}

test("operational mode: quick quote leads into the multi step inquiry, stored for manual review", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Request a Freight Quote/ }).first()).toBeVisible();
  await expect(page.getByText("Mary’s Logistics Group is preparing to launch.")).toHaveCount(0);
  await fillWizard(page);
  await page.getByRole("button", { name: /Submit Freight Inquiry/ }).click();
  await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Thank you for contacting Mary’s Logistics Group. Your request has been received and will be reviewed. Submitting an inquiry does not confirm transportation availability, pricing, or booking.");
  const [row] = await sql<{ status: string; weight_lbs: number; piece_count: number }>("select status, weight_lbs, piece_count from public.quote_inquiries where email = 'riley@example.test'");
  expect(row).toEqual({ status: "pending_review", weight_lbs: 8000, piece_count: 12 });
});

test("server enforced gate: if operations are switched off, a submission from an open page is refused", async ({ page }) => {
  await fillWizard(page);
  await sql("update public.business_settings set operations_enabled = false where id = 1");
  await page.getByRole("button", { name: /Submit Freight Inquiry/ }).click();
  await expect(page.getByRole("form", { name: "Freight inquiry" }).getByRole("alert")).toContainText("not arranging transportation yet");
  expect((await sql("select 1 from public.quote_inquiries where email = 'riley@example.test'")).length).toBe(1);
});

test("axe: operational request quote wizard", async ({ page }) => {
  await page.goto(`${OPERATIONAL}/request-quote`);
  await page.waitForTimeout(1200);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
