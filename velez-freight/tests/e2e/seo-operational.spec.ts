// SEO in operating mode: operating wording and Service data appear only now, and Search Console
// data (from a local stand in) fills the SEO tab.
import { expect, test } from "@playwright/test";
import { OPERATIONAL, seedUsers, signIn } from "./helpers";

test.use({ baseURL: OPERATIONAL });
test.beforeAll(async () => seedUsers());

test("operating wording, Service structured data and quote CTAs appear once operating", async ({ page }) => {
  await page.goto("/contact");
  await expect(page).toHaveTitle("Contact a Maryland Freight Broker | Mary’s Logistics Group");
  await page.goto("/request-quote");
  await expect(page).toHaveTitle("Request a Freight Quote | Mary’s Logistics Group");
  await page.goto("/services/dedicated-transportation");
  await expect(page.getByText("Planned service")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Request a Freight Quote/ }).first()).toBeVisible();
  const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent || "{}")));
  const svc = ld.find((d) => d["@type"] === "Service");
  expect(svc).toMatchObject({ name: "Dedicated Transportation", url: `${OPERATIONAL}/services/dedicated-transportation`, provider: { "@id": `${OPERATIONAL}/#organization` } });
});

test("SEO tab shows Search Console clicks, impressions, queries, pages and sitemap status", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/insights?tab=seo");
  await expect(page.getByText("Connected to sc-domain:maryslogistics.test")).toBeVisible();
  await expect(page.locator("div.rounded-lg", { has: page.getByText("Clicks from Google search", { exact: true }) })).toContainText("9");
  await expect(page.locator("div.rounded-lg", { has: page.getByText("Impressions", { exact: true }) })).toContainText("150");
  await expect(page.getByRole("cell", { name: "maryland freight broker" })).toBeVisible();
  await expect(page.getByRole("link", { name: "/services/expedited-freight" })).toBeVisible();
  await expect(page.getByText(/Submitted 14, indexed 9/)).toBeVisible();
});
