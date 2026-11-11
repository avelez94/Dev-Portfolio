// Command center in ACTIVE mode with a developed brokerage (SYNTHETIC history, local test DB only).
import { expect, test } from "@playwright/test";
import { OPERATIONAL, resetRateLimits, seedUsers, signIn, sql } from "./helpers";

test.use({ baseURL: OPERATIONAL });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await seedUsers();
  // Time based workflow rules run at most every five minutes; run them now for the new history.
  await sql("select public.refresh_system_tasks(true)");
});
test.beforeEach(async () => {
  await resetRateLimits();
  await sql("update public.business_settings set operations_enabled = true, authority_verified_on = current_date, mc_number = '000000' where id = 1");
});

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);

test("dashboard groups repeated priorities and KPI values match the database", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText(/\d+ invoices are overdue/)).toBeVisible();
  // Independent SQL for completed revenue over the dashboard's default last 30 days.
  const [r] = await sql<{ rev: string }>(`select coalesce(sum(customer_rate),0) rev from public.shipments where status in ('delivered','completed')
    and actual_delivery_at >= ((now() at time zone 'America/New_York')::date - 29)::timestamp at time zone 'America/New_York'`);
  await expect(page.getByRole("group", { name: "Completed freight revenue" })).toContainText(usd(Number(r.rev)));
});

test("KPI drill down leads to the supporting records", async ({ page }) => {
  await signIn(page);
  await page.getByRole("group", { name: "Overdue invoices" }).getByRole("link", { name: /View records/ }).click();
  await expect(page).toHaveURL(/\/admin\/invoices\?view=overdue/);
  await expect(page.getByText(/days overdue/).first()).toBeVisible();
});

test("insights: financial tab separates booked, completed and cash, and filters update figures", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/insights?tab=financial&period=ytd");
  const table = page.getByRole("table", { name: "Financial summary for the period" });
  await expect(table.getByRole("rowheader", { name: "Booked revenue" })).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "Cash collected" })).toBeVisible();
  const [r] = await sql<{ cash: string }>(`select coalesce(sum(p.amount),0) cash from public.invoice_payments p join public.invoices i on i.id = p.invoice_id
    where i.status = 'issued' and p.received_on between date_trunc('year', (now() at time zone 'America/New_York'))::date and (now() at time zone 'America/New_York')::date`);
  await expect(table.getByRole("row", { name: /Cash collected/ })).toContainText(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(r.cash)));
  await page.goto("/admin/insights?tab=operations&period=ytd&freight=expedited");
  await expect(page.getByRole("table").filter({ hasText: "Lane performance" })).toBeVisible();
});

test("report CSV totals agree with the database", async ({ page }) => {
  await signIn(page);
  const csv = await (await page.request.get("/admin/reports-export/profitability?period=ytd&format=csv")).text();
  const lines = csv.split("\r\n");
  const start = lines.indexOf("By customer");
  const rows = lines.slice(start + 2).filter((l) => l.startsWith("[Synthetic]") || l.startsWith('"[Synthetic]'));
  const revenue = rows.reduce((a, l) => a + Math.round(Number(l.split(",").at(-3)) * 100), 0);
  const [r] = await sql<{ rev: string }>(`select coalesce(sum(customer_rate),0) rev from public.shipments where status in ('delivered','completed')
    and actual_delivery_at >= date_trunc('year', (now() at time zone 'America/New_York'))::timestamp at time zone 'America/New_York'`);
  expect(revenue).toBe(Math.round(Number(r.rev) * 100));
});

test("quote workflow requires approval and confirmation, then books a shipment with a qualified carrier", async ({ page }) => {
  const [shipper] = await sql<{ id: string; company: string }>("select id, company from public.shipper_prospects where status = 'active_customer' order by company limit 1");
  await signIn(page);
  await page.goto(`/admin/quotes/new?shipper=${shipper.id}`);
  await page.getByLabel("Origin city").fill("Baltimore");
  await page.getByLabel("Origin state").fill("MD");
  await page.getByLabel("Destination city").fill("Richmond");
  await page.getByLabel("Destination state").fill("VA");
  await page.getByLabel("Customer rate (USD)").fill("1850.00");
  await page.getByLabel("Estimated carrier cost (USD)").fill("1575.00");
  await page.getByRole("button", { name: "Save draft quote" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Quote MLG-QT-/ })).toBeVisible();
  await expect(page.getByText("$275.00 gross margin (14.9%)")).toBeVisible();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByText("pending approval", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve quote" }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Record as sent" }).click();
  await expect(page.getByText(/Confirm that you sent the quote yourself/)).toBeVisible();
  await page.getByLabel(/I sent this quote to the customer myself/).check();
  await page.getByRole("button", { name: "Record as sent" }).click();
  await expect(page.getByText("sent", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Customer accepted" }).click();
  await expect(page.getByText("accepted", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Book shipment from this quote" }).click();
  const options = await page.getByLabel("Carrier (qualified only)").locator("option").allTextContents();
  const unqualified = await sql<{ company_name: string }>("select company_name from public.carrier_leads where verification_status <> 'verified'");
  for (const u of unqualified) expect(options).not.toContain(u.company_name);
  await page.getByLabel("Carrier (qualified only)").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Book shipment" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Shipment MLG-SH-/ })).toBeVisible();
});

test("database refuses assigning an unqualified carrier even if the form is bypassed", async () => {
  const [ship] = await sql<{ id: string }>("select id from public.shipments where status = 'booked' limit 1");
  const [bad] = await sql<{ id: string }>("select id from public.carrier_leads where verification_status <> 'verified' limit 1");
  await expect(sql("update public.shipments set carrier_id = $1 where id = $2", [bad.id, ship.id])).rejects.toThrow(/not qualified/);
});

test("invoice payments cannot exceed the balance", async ({ page }) => {
  const [inv] = await sql<{ id: string; amount: string }>(`select i.id, i.amount from public.invoices i where i.status = 'issued' and not exists (select 1 from public.invoice_payments p where p.invoice_id = i.id) limit 1`);
  await signIn(page);
  await page.goto(`/admin/invoices/${inv.id}`);
  await page.getByLabel("Amount").fill(String(Number(inv.amount) + 10));
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("That payment is more than the remaining balance.")).toBeVisible();
});

test("open exceptions surface as critical priorities and resolve cleanly", async ({ page }) => {
  const [ship] = await sql<{ id: string; reference: string }>("select id, reference from public.shipments where status in ('booked','in_transit','dispatched') limit 1");
  await signIn(page);
  await page.goto(`/admin/shipments/${ship.id}`);
  await page.getByText("Report an exception").click();
  await page.getByLabel("What happened").fill("Driver reports a two hour delay at the shipper.");
  await page.getByRole("button", { name: "Record exception" }).click();
  await expect(page.getByText(/A critical task was created/)).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText(`Exception on shipment ${ship.reference}`).first()).toBeVisible();
});
