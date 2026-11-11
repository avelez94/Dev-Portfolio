// Command center in PRELAUNCH mode with an empty brokerage (no synthetic data).
import { expect, test } from "@playwright/test";
import { INACTIVE, OWNER, PRELAUNCH, STAFF, resetRateLimits, seedUsers, signIn, sql } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => seedUsers());
test.beforeEach(async () => resetRateLimits());

test("signed out visitors are redirected and there is no public sign up", async ({ page }) => {
  for (const path of ["/admin", "/admin/insights", "/admin/settings", "/admin/reports"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  await expect(page.getByText(/sign up/i)).toHaveCount(0);
  expect((await page.request.get("/admin/login")).headers()["x-robots-tag"]).toContain("noindex");
  const exp = await page.request.get("/admin/reports-export/receivables?format=csv", { maxRedirects: 0 });
  expect([307, 401]).toContain(exp.status());
});

test("wrong password and deactivated accounts are refused", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email or password is incorrect.");
  await page.getByLabel("Email").fill(INACTIVE.email);
  await page.getByLabel("Password").fill(INACTIVE.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("does not have dashboard access");
});

test("empty brokerage: dashboard shows prelaunch mode, honest zeros and gated modules", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Test.");
  await expect(page.getByText("Prelaunch mode.", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("You are all caught up.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Total shipper prospects" })).toContainText("0");
  await expect(page.getByText("Completed freight revenue")).toHaveCount(0);
  await page.goto("/admin/quotes");
  await expect(page.getByText("Quotes are not available yet")).toBeVisible();
  await page.goto("/admin/insights?tab=operations");
  await expect(page.getByText("Freight operations analytics")).toBeVisible();
});

test("a website inquiry becomes a priority; reviewing it closes the task automatically", async ({ page }) => {
  await sql(`insert into public.contact_inquiries (inquiry_type, name, email, company, message, privacy_ack) values ('shipper','Morgan Lane','morgan@example.test','Lane Distribution','We ship 20 pallets a week to Ohio.', true)`);
  await signIn(page);
  const item = page.getByRole("listitem").filter({ hasText: "Review new shipper inquiry from Lane Distribution" });
  await expect(item).toBeVisible();
  await expect(item.getByText("Next step:")).toBeVisible();
  await item.getByRole("link", { name: /Open record/ }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Freight Inquiries");
  await page.getByLabel("Status").selectOption("in_review");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const [t] = await sql<{ status: string; resolution: string }>("select status, resolution from public.follow_up_tasks where title like 'Review new shipper inquiry from Lane%'");
  expect(t).toEqual({ status: "done", resolution: "auto_resolved" });
  await page.getByRole("button", { name: "Create shipper prospect" }).click();
  await expect(page).toHaveURL(/\/admin\/shippers\/[0-9a-f-]{36}$/);
});

test("shipper 360: log an activity with a follow up, change stage, all without leaving the profile", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/shippers/new");
  await page.getByLabel("Company *").fill("Patapsco Paper Goods");
  await page.getByLabel("Industry category").selectOption("manufacturing");
  await page.getByLabel("Lead source").selectOption("referral");
  await page.getByRole("button", { name: "Create prospect" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Patapsco Paper Goods" })).toBeVisible();

  const future = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Summary", { exact: true }).fill("Spoke with the logistics manager about weekly Ohio loads.");
  await page.getByLabel("They responded meaningfully").check();
  await page.getByLabel("Schedule next follow up (optional)").fill(future);
  await page.getByRole("button", { name: "Save activity" }).click();
  await expect(page.getByText("Activity recorded and follow up scheduled.")).toBeVisible();
  await expect(page.getByText("Spoke with the logistics manager")).toBeVisible();
  await expect(page.getByText("Follow up with Patapsco Paper Goods").first()).toBeVisible();

  await page.getByLabel("Move to stage").selectOption("lost");
  await page.getByRole("button", { name: "Update stage" }).click();
  await expect(page.getByText(/Add a short reason/)).toBeVisible();
  await page.getByLabel("Move to stage").selectOption("contacted");
  await page.getByRole("button", { name: "Update stage" }).click();
  await expect(page.getByText("Stage updated and recorded in history.")).toBeVisible();
  const ev = await sql<{ to_status: string }>("select e.to_status from public.prospect_stage_events e join public.shipper_prospects p on p.id = e.shipper_id where p.company = 'Patapsco Paper Goods' order by e.id");
  expect(ev.map((e) => e.to_status)).toEqual(["researching", "contacted"]);
  const tasks = await sql("select 1 from public.follow_up_tasks where dedupe_key like 'prospect_follow_up:%' and title = 'Follow up with Patapsco Paper Goods'");
  expect(tasks.length).toBe(1);
});

test("global search finds records with Ctrl K and opens them", async ({ page }) => {
  await signIn(page);
  const box = page.getByRole("combobox", { name: /Search shippers/ });
  // The shortcut works once the page has hydrated; retry until it does.
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(box).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(box).toBeFocused();
  await box.fill("Patapsco");
  await expect(page.getByRole("listbox", { name: "Results" }).getByRole("option").first()).toContainText("Patapsco Paper Goods");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Patapsco Paper Goods" })).toBeVisible();
});

test("task center: complete with undo, snooze, and views", async ({ page }) => {
  await sql(`insert into public.follow_up_tasks (title, due_date, category, priority_tier) values ('Call the insurance agent', current_date, 'admin', 5), ('Renew domain', current_date, 'admin', 5)`);
  await signIn(page);
  await page.goto("/admin/tasks?view=today");
  const call = page.getByRole("listitem").filter({ hasText: "Call the insurance agent" });
  await call.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Marked done.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Reopened.")).toBeVisible();
  expect((await sql<{ status: string }>("select status from public.follow_up_tasks where title = 'Call the insurance agent'"))[0].status).toBe("open");
  const renew = page.getByRole("listitem").filter({ hasText: "Renew domain" });
  await renew.getByLabel(/Snooze Renew domain/).selectOption("3");
  await expect(page.getByText("Snoozed 3 days.")).toBeVisible();
  await page.goto("/admin/tasks?view=today");
  await expect(page.getByText("Renew domain")).toHaveCount(0);
  await page.goto("/admin/tasks?view=upcoming");
  await expect(page.getByText("Renew domain", { exact: true })).toBeVisible();
});

test("carrier verification requires recorded evidence before Verified", async ({ page }) => {
  await sql(`insert into public.carrier_leads (company_name, usdot_number, equipment, source) values ('Severn Freight Lines', '1234567', '{dry_van}', 'manual')`);
  await signIn(page);
  await page.goto("/admin/carriers");
  await page.getByRole("link", { name: "Severn Freight Lines" }).click();
  await expect(page.getByText("Not yet qualified for assignment.")).toBeVisible();
  await page.getByText("Edit carrier details and status").click();
  await page.getByLabel("Verification status").selectOption("verified");
  await page.getByLabel("Verified on").fill("2026-11-01");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/passing authority check from the last 30 days/).first()).toBeVisible();
  for (const check of ["authority", "insurance"]) {
    await page.getByLabel("Check", { exact: true }).selectOption(check);
    await page.getByLabel("Source").fill(check === "authority" ? "FMCSA SAFER snapshot" : "Certificate of insurance");
    await page.getByRole("button", { name: "Record check" }).click();
    await expect(page.getByText("Verification check recorded.")).toBeVisible();
  }
  const edit = page.locator("details").filter({ hasText: "Edit carrier details and status" });
  if ((await edit.getAttribute("open")) === null) await page.getByText("Edit carrier details and status").click();
  await page.getByLabel("Insurance expires on").fill("2027-06-30");
  await page.getByLabel("Broker carrier agreement signed on").fill("2026-11-01");
  await page.getByLabel("Verification status").selectOption("verified");
  await page.getByLabel("Verified on").fill("2026-11-01");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Qualified for assignment today.")).toBeVisible();
});

test("insights and reports: sales funnel, CSV and real PDF exports, audited", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/insights?tab=sales");
  await expect(page.getByRole("heading", { name: "Sales funnel" })).toBeVisible();
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Sales Pipeline" })).toBeVisible();
  const csv = await page.request.get("/admin/reports-export/sales-pipeline?period=30d&format=csv");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain("Sales Pipeline");
  expect(text).toContain("Funnel (prospects created in the period)");
  const pdf = await page.request.get("/admin/reports-export/executive-summary?period=30d&format=pdf");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2000);
  const audit = await sql("select 1 from public.audit_events where action = 'report.exported'");
  expect(audit.length).toBeGreaterThanOrEqual(2);
});

test("staff accounts cannot reach financial records or admin only exports", async ({ page }) => {
  await signIn(page, STAFF);
  await expect(page.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Invoices" })).toHaveCount(0);
  await page.goto("/admin/invoices");
  await expect(page).toHaveURL(/\/admin\?denied=1/);
  await expect(page.getByRole("alert").filter({ hasText: "requires owner or admin" })).toBeVisible();
  const r = await page.request.get("/admin/reports-export/receivables?format=csv");
  expect(r.status()).toBe(403);
  await page.goto("/admin/insights?tab=financial");
  await expect(page.getByRole("link", { name: "Financial Performance" })).toHaveCount(0);
});

test("settings and website content: operations need confirmation; content saves", async ({ page }) => {
  await sql("update public.business_settings set operations_enabled = false, authority_verified_on = null, mc_number = null where id = 1");
  await signIn(page);
  await page.goto("/admin/settings");
  await expect(page.getByText(/BROKER_AUTHORITY_ACTIVE.*false/)).toBeVisible();
  await page.getByLabel("Operations enabled (accept freight quote inquiries)").check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/type ENABLE OPERATIONS/)).toBeVisible();
  await expect(page.getByLabel("Operations enabled (accept freight quote inquiries)")).toBeChecked();
  await page.getByLabel("To turn operations ON, type ENABLE OPERATIONS").fill("ENABLE OPERATIONS");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/Record the MC number and the date/)).toBeVisible();
  expect((await sql<{ operations_enabled: boolean }>("select operations_enabled from public.business_settings where id = 1"))[0].operations_enabled).toBe(false);
  await page.goto("/admin/content");
  await page.getByLabel("Public business email").fill("hello@example.test");
  await page.getByRole("button", { name: "Save website content" }).click();
  await expect(page.getByText(/Saved. Public pages refresh/)).toBeVisible();
});

test("notifications, audit log and sign out", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/notifications?show=all");
  await expect(page.getByText(/New shipper inquiry from Lane Distribution/)).toBeVisible();
  await page.goto("/admin/activity");
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.getByRole("cell", { name: "auth.signed_in" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("documents: files upload privately, open through an audited link, W9 is owner or admin only", async ({ page, browser }) => {
  const [c] = await sql<{ id: string }>(`insert into public.carrier_leads (company_name, source) values ('Patapsco Haulers', 'manual') returning id`);
  await signIn(page);
  await page.goto(`/admin/carriers/${c.id}`);
  const pdf = Buffer.from("%PDF-1.4\n% test certificate of insurance\n%%EOF\n");
  // Wrong file types are refused before anything is uploaded.
  await page.locator("#d-type").selectOption("insurance_certificate");
  await page.locator("#d-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await page.getByRole("button", { name: "Save document" }).click();
  await expect(page.getByText("Upload a PDF or a photo (JPG, PNG, WEBP or HEIC).")).toBeVisible();
  // A PDF uploads, is recorded with its real size, and downloads through the app.
  await page.locator("#d-ref").fill("Policy 55-1209");
  await page.locator("#d-file").setInputFiles({ name: "coi 2027.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByRole("button", { name: "Save document" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
  const [doc] = await sql<{ id: string; storage_path: string; file_size: number; file_name: string }>(`select id, storage_path, file_size, file_name from public.documents where entity_id = $1 and doc_type = 'insurance_certificate'`, [c.id]);
  expect(doc.storage_path).toMatch(new RegExp(`^carrier_lead/${c.id}/[0-9a-f-]{36}\\.pdf$`));
  expect(doc.file_size).toBe(pdf.length);
  expect(doc.file_name).toBe("coi 2027.pdf");
  await expect(page.getByRole("link", { name: /Download Insurance certificate, coi 2027\.pdf/ })).toBeVisible();
  const res = await page.request.get(`/admin/documents/${doc.id}`);
  expect(res.status()).toBe(200);
  expect(Buffer.from(await res.body()).equals(pdf)).toBe(true);
  const [opened] = await sql<{ n: number }>(`select count(*)::int n from public.audit_events where action = 'document.opened' and metadata->>'document_id' = $1`, [doc.id]);
  expect(opened.n).toBe(1);
  // Signed out requests get nothing.
  const anon = await browser.newContext({ baseURL: PRELAUNCH });
  const out = await anon.request.get(`/admin/documents/${doc.id}`, { maxRedirects: 0 });
  expect(out.status()).toBe(307);
  expect(out.headers().location).toContain("/admin/login");
  await anon.close();
  // W9 files: uploaded by the owner, hidden from staff, refused on direct request.
  await page.locator("#d-type").selectOption("w9");
  await page.locator("#d-file").setInputFiles({ name: "w9.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByRole("button", { name: "Save document" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
  const [w9] = await sql<{ id: string }>(`select id from public.documents where entity_id = $1 and doc_type = 'w9'`, [c.id]);
  const staff = await browser.newContext({ baseURL: PRELAUNCH });
  const sp = await staff.newPage();
  await signIn(sp, STAFF);
  await sp.goto(`/admin/carriers/${c.id}`);
  await expect(sp.getByText("Owner or admin only")).toBeVisible();
  expect((await sp.request.get(`/admin/documents/${w9.id}`, { maxRedirects: 0 })).status()).toBe(403);
  expect((await sp.request.get(`/admin/documents/${doc.id}`)).status()).toBe(200);
  await staff.close();
});

test("axe: main dashboard screens have no WCAG A/AA violations", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await signIn(page);
  const [sh] = await sql<{ id: string }>("select id from public.shipper_prospects limit 1");
  const [ca] = await sql<{ id: string }>("select id from public.carrier_leads order by created_at limit 1");
  for (const path of ["/admin", "/admin/tasks", "/admin/shippers", `/admin/shippers/${sh.id}`, `/admin/carriers/${ca.id}`, "/admin/insights?tab=sales", "/admin/reports", "/admin/settings"]) {
    await page.goto(path);
    await page.waitForTimeout(1200);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
  }
});

test("phone width: dashboard uses the navigation drawer and does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const dialog = page.getByRole("dialog", { name: "Navigation" });
  await expect(async () => {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(dialog.getByRole("link", { name: "Shippers" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
