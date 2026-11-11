// Business Settings Center (prelaunch build): credentials, activation gate, contact and hours,
// display preferences, and versioned website text.
import { expect, test, type Page } from "@playwright/test";
import { PRELAUNCH, STAFF, resetRateLimits, seedUsers, signIn, sql } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => seedUsers());
test.beforeEach(async ({ page }) => {
  await resetRateLimits();
  page.on("dialog", (d) => d.accept());
});
test.afterAll(async () => {
  await sql(`update public.regulatory_credentials set value = null, status = 'not_entered', verified_on = null, verification_source = null, show_publicly = false`);
  await sql(`update public.business_settings set operations_enabled = false, broker_authority_status = 'not_filed', authority_verified_on = null, business_hours = '{}', after_hours_support = 'none', after_hours_verified = false,
    display_prefs = '{"show_email": true, "show_phone": true, "show_hours": false, "show_credentials": true, "show_social": false}' where id = 1`);
  await sql(`delete from public.site_content`);
});

async function openCredential(page: Page, label: string) {
  await page.goto("/admin/settings?tab=compliance");
  const item = page.locator("li", { has: page.locator("summary", { hasText: label }) }).first();
  await item.locator("summary").click();
  return item;
}

test("a credential is verified only with evidence, and only verified ones can be public", async ({ page }) => {
  await signIn(page);
  let mc = await openCredential(page, "MC number");
  await mc.getByLabel("MC number", { exact: true }).fill("MC 765432");
  await mc.getByLabel("Status").selectOption("verified");
  await mc.getByRole("button", { name: "Save MC number" }).click();
  await expect(mc.getByText(/record the date it was checked and where/)).toBeVisible();

  await mc.getByLabel("Status").selectOption("entered");
  await mc.getByLabel(/Show on the website/).check();
  await mc.getByRole("button", { name: "Save MC number" }).click();
  await expect(mc.getByText("Only verified credentials can be shown on the website.")).toBeVisible();

  await mc.getByLabel(/Show on the website/).uncheck();
  await mc.getByRole("button", { name: "Save MC number" }).click();
  await expect(mc.getByText("MC number saved.")).toBeVisible();
  expect((await sql<{ mc_number: string }>("select mc_number from public.business_settings where id = 1"))[0].mc_number).toBe("765432");

  mc = await openCredential(page, "MC number");
  await mc.getByLabel("Status").selectOption("verified");
  await mc.getByLabel("Verified on").fill(new Date().toISOString().slice(0, 10));
  await mc.getByLabel("Where it was verified").fill("FMCSA licensing and insurance record");
  await mc.getByLabel(/Show on the website/).check();
  await mc.getByRole("button", { name: "Save MC number" }).click();
  await expect(mc.getByText("MC number saved as verified.")).toBeVisible();

  const events = await sql<{ action: string; to_status: string }>(`select e.action, e.to_status from public.credential_events e join public.regulatory_credentials c on c.id = e.credential_id where c.kind = 'mc_number' order by e.id`);
  expect(events.map((e) => e.to_status)).toEqual(expect.arrayContaining(["entered", "verified"]));
  mc = await openCredential(page, "MC number");
  await expect(mc.getByText(/Status: Entered, not verified to Verified/)).toBeVisible();

  // Prelaunch: verified and selected, but not shown publicly until operating.
  await page.goto("/");
  await expect(page.locator("footer")).not.toContainText("765432");
  // The launch preview shows it where it will appear.
  await page.goto("/admin/preview");
  await expect(page.locator("[data-preview-credential]").first()).toContainText("MC 765432");
});

test("operations stay off until the MC number is verified, not just entered", async ({ page }) => {
  await sql(`update public.regulatory_credentials set status = 'entered', show_publicly = false where kind = 'mc_number'`);
  await sql(`update public.business_settings set broker_authority_status = 'active', authority_verified_on = current_date where id = 1`);
  await signIn(page);
  await page.goto("/admin/settings?tab=compliance");
  await page.getByLabel("Operations enabled (accept freight quote inquiries)").check();
  await page.getByLabel("To turn operations ON, type ENABLE OPERATIONS").fill("ENABLE OPERATIONS");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/Verify the MC number in Regulatory & Compliance/)).toBeVisible();
  expect((await sql<{ operations_enabled: boolean }>("select operations_enabled from public.business_settings where id = 1"))[0].operations_enabled).toBe(false);
  await sql(`update public.business_settings set broker_authority_status = 'not_filed', authority_verified_on = null where id = 1`);
});

test("staff can view credentials but never the EIN, and cannot change them", async ({ page }) => {
  await sql(`update public.regulatory_credentials set value = '123456789', status = 'entered' where kind = 'ein'`);
  await signIn(page, STAFF);
  await page.goto("/admin/settings?tab=compliance");
  await expect(page.getByText("You can view these settings.").first()).toBeVisible();
  await expect(page.locator("summary", { hasText: "MC number" })).toBeVisible();
  await expect(page.getByText("Employer Identification Number")).toHaveCount(0);
  await expect(page.getByText("123456789")).toHaveCount(0);
  await sql(`update public.regulatory_credentials set value = null, status = 'not_entered' where kind = 'ein'`);
});

test("business hours and after hours support appear only as configured and verified", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/settings?tab=contact");
  await page.getByLabel("Monday opening time").fill("08:00");
  await page.getByLabel("Monday closing time").fill("17:00");
  await page.getByLabel("After hours availability").selectOption("around_the_clock");
  await page.getByRole("button", { name: "Save contact and support" }).click();
  await expect(page.getByText("Contact and support details saved.")).toBeVisible();

  await page.goto("/admin/settings?tab=website");
  await page.getByLabel("Show business hours on the Contact page").check();
  await page.getByRole("button", { name: "Save display preferences" }).click();
  await expect(page.getByText(/Display preferences saved/)).toBeVisible();

  await expect.poll(async () => { await page.goto("/contact"); return page.locator("main").innerText(); }, { timeout: 15000 }).toContain("8 am to 5 pm");
  // Around the clock support was selected but not confirmed as staffed: not promised anywhere.
  await expect(page.locator("[data-business-hours]")).not.toContainText(/24\/7|around the clock/i);

  await page.goto("/admin/settings?tab=contact");
  await page.getByLabel(/around the clock support is actually staffed/).check();
  await page.getByRole("button", { name: "Save contact and support" }).click();
  await expect(page.getByText("Contact and support details saved.")).toBeVisible();
  await expect.poll(async () => { await page.goto("/contact"); return page.locator("[data-business-hours]").innerText(); }, { timeout: 15000 }).toContain("Around the clock (24/7) support");
});

test("page text: edits publish, every version is kept, and any version can be restored", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/content");
  const box = page.getByLabel(/Home: Hero, first paragraph/);
  const original = await box.inputValue();
  await box.fill("We listen first, then plan every shipment around what matters to you.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(box).toHaveValue(original);

  await box.fill("We listen first, then plan every shipment around what matters to you.");
  await page.getByRole("button", { name: "Save page text" }).click();
  await expect(page.getByText(/Saved 1 section/)).toBeVisible();
  await expect.poll(async () => { await page.goto("/"); return page.locator("main").innerText(); }, { timeout: 15000 }).toContain("We listen first, then plan every shipment");

  await page.goto("/admin/content");
  await page.getByLabel(/Home: Hero, first paragraph/).fill("");
  await page.getByRole("button", { name: "Save page text" }).click();
  await expect(page.getByText(/Saved 1 section/)).toBeVisible();
  const versions = await sql<{ version: number; value: string | null }>(`select version, value from public.site_content_versions where key = 'hero.body1' order by version`);
  expect(versions.map((v) => v.value === null)).toEqual([false, true]);

  await page.goto("/admin/content");
  await page.getByText(/Version history/).click();
  await page.locator("li", { hasText: "version 1" }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Restored version 1.")).toBeVisible();
  expect((await sql<{ value: string }>(`select value from public.site_content where key = 'hero.body1'`))[0].value).toContain("We listen first");
  expect(await sql(`select 1 from public.site_content_versions where key = 'hero.body1' and restored_from is not null`)).toHaveLength(1);
});
