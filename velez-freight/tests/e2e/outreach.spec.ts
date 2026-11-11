// Email and Outreach Center against a local stand in for the email provider (no real email).
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PRELAUNCH, STAFF, resetRateLimits, seedUsers, signIn, sql } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.describe.configure({ mode: "serial" });

const FAKE = process.env.FAKE_SUPABASE_URL ?? "http://127.0.0.1:54399";
type Sent = { id: string; to: string[]; subject: string; html: string; text: string; headers: Record<string, string>; idempotencyKey: string };
const sentEmails = async (): Promise<Sent[]> => (await fetch(`${FAKE}/__resend/sent`)).json();
let shipperId = "";
let contactId = "";

test.beforeAll(async () => {
  await seedUsers();
  await fetch(`${FAKE}/__resend/reset`, { method: "POST" });
  await sql(`update public.business_settings set outreach_sending_approved = false, sender_domain = null, sender_domain_status = 'unknown', mailing_address = null where id = 1`);
  const [p] = await sql<{ id: string }>(`insert into public.shipper_prospects (company, contact_name, email, status, source) values ('Harbor Outreach Supply', 'Robin Harbor', 'robin@harbor.test', 'contact_identified', 'research') returning id`);
  shipperId = p.id;
  const [c] = await sql<{ id: string }>(`insert into public.shipper_contacts (shipper_id, name, email, is_primary) values ($1, 'Casey Morgan', 'casey@harbor.test', true) returning id`, [shipperId]);
  contactId = c.id;
});
test.beforeEach(async ({ page }) => {
  await resetRateLimits();
  page.on("dialog", (d) => d.accept());
});
test.afterAll(async () => {
  await sql(`update public.business_settings set outreach_sending_approved = false, sender_domain = null, sender_domain_status = 'unknown', mailing_address = null where id = 1`);
});

test("owner adds a sender; staff drafts from a template and submits for approval", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/admin/outreach/setup");
  await page.locator("summary", { hasText: "Add a sender" }).click();
  await page.getByLabel("Name shown to recipients").fill("Alante Velez");
  await page.getByLabel("Sender email (on your verified domain)").fill("alante@marys-logistics.test");
  await page.getByLabel("Title (optional)").fill("Founder & CEO");
  await page.getByLabel("Default sender").check();
  await page.getByRole("button", { name: "Add sender" }).click();
  await expect(page.getByText("Sender saved.")).toBeVisible();

  const staff = await (await browser.newContext()).newPage();
  await signIn(staff, STAFF);
  await staff.goto(`/admin/outreach/compose`);
  await expect(staff.locator("#cp-template option", { hasText: "Launch announcement" })).toHaveCount(0);
  await staff.goto(`/admin/outreach/compose?to=contact:${contactId}`);
  const tpl = await sql<{ id: string }>(`select id from public.email_templates where name = 'Introduction to a shipper'`);
  await staff.goto(`/admin/outreach/compose?to=contact:${contactId}&template=${tpl[0].id}`);
  await expect(staff.getByLabel("Subject")).toHaveValue("Introducing {{business.name}}");
  await expect(staff.frameLocator("iframe[title='Email preview']").locator("body")).toContainText("Hi Casey,");
  await expect(staff.frameLocator("iframe[title='Email preview']").locator("body")).toContainText("Harbor Outreach Supply");
  await staff.getByLabel("Submit for approval").check();
  await staff.getByRole("button", { name: "Save" }).click();
  await expect(staff).toHaveURL(/\/admin\/outreach\/[0-9a-f-]{36}$/);
  await expect(staff.getByText("Waiting for approval").first()).toBeVisible();
  await expect(staff.getByRole("button", { name: "Approve this email" })).toHaveCount(0);
  await expect(staff.getByText("An owner or admin reviews and approves")).toBeVisible();
});

test("approval does not send; sending stays blocked until every gate passes", async ({ page }) => {
  const [m] = await sql<{ id: string }>(`select id from public.outreach_messages where to_email = 'casey@harbor.test' order by created_at desc limit 1`);
  await signIn(page);
  await page.goto(`/admin/outreach/${m.id}`);
  await page.getByRole("button", { name: "Approve this email" }).click();
  await expect(page.getByText(/Approved by Test Owner. It has not been sent./)).toBeVisible();
  await expect(page.getByText("Sending is off. Complete these first:")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send now" })).toHaveCount(0);
  expect(await sentEmails()).toHaveLength(0);

  // Sending setup: domain, typed approval, mailing address.
  await page.goto("/admin/outreach/setup");
  await page.getByLabel("Sending domain").fill("marys-logistics.test");
  await page.getByLabel(/Sending approved/).check();
  await page.getByRole("button", { name: "Save sending controls" }).click();
  await expect(page.getByText("To approve sending, type APPROVE SENDING")).toBeVisible();
  await page.getByLabel("To approve sending, type APPROVE SENDING").fill("APPROVE SENDING");
  await page.getByRole("button", { name: "Save sending controls" }).click();
  await expect(page.getByText(/Sending is approved/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Check domain status with the provider" }).click();
  await expect(page.getByText("Domain status: verified.")).toBeVisible();

  await page.goto(`/admin/outreach/${m.id}`);
  await expect(page.getByText("Sending is off. Complete these first:")).toBeVisible();
  await expect(page.getByText("Mailing address for the email footer")).toBeVisible();
  await page.goto("/admin/settings?tab=profile");
  await page.getByLabel(/Mailing address for email footers/).fill("PO Box 100\nBaltimore, MD 21201");
  await page.getByRole("button", { name: "Save business identity" }).click();
  await expect(page.getByText("Business identity saved.")).toBeVisible();
});

test("sending: confirmation required, provider proof recorded, CRM updated, footer and unsubscribe present", async ({ page }) => {
  const [m] = await sql<{ id: string; reference: string }>(`select id, reference from public.outreach_messages where to_email = 'casey@harbor.test' order by created_at desc limit 1`);
  await signIn(page);
  await page.goto(`/admin/outreach/${m.id}`);
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText("Tick the box to confirm")).toBeVisible();
  expect(await sentEmails()).toHaveLength(0);
  await page.getByLabel(/I want to send this email to casey@harbor.test now/).check();
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/The email provider accepted the message/).first()).toBeVisible();

  const sent = await sentEmails();
  expect(sent).toHaveLength(1);
  expect(sent[0].to[0]).toContain("casey@harbor.test");
  expect(sent[0].subject).toBe("Introducing Mary’s Logistics Group");
  expect(sent[0].idempotencyKey).toBe(`outreach-${m.id}`);
  expect(sent[0].headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  for (const part of [sent[0].html, sent[0].text]) {
    expect(part).toContain("Baltimore, MD 21201");
    expect(part).toContain("/unsubscribe?t=");
  }
  expect(sent[0].text).toContain("Founder & CEO");

  const [row] = await sql<{ status: string; provider_message_id: string; sent_at: string }>(`select status, provider_message_id, sent_at from public.outreach_messages where id = $1`, [m.id]);
  expect(row.status).toBe("sent");
  expect(row.provider_message_id).toBe(sent[0].id);
  const acts = await sql<{ summary: string }>(`select summary from public.crm_activities where shipper_id = $1 and activity_type = 'email'`, [shipperId]);
  expect(acts.map((a) => a.summary).join(" ")).toContain(m.reference);
  await page.goto(`/admin/shippers/${shipperId}`);
  await expect(page.getByRole("link", { name: /Introducing Mary’s Logistics Group/ })).toBeVisible();
  // A sent message cannot be sent again.
  await page.goto(`/admin/outreach/${m.id}`);
  await expect(page.getByRole("button", { name: "Send now" })).toHaveCount(0);
});

test("unsubscribe link works and blocks future email to that address", async ({ page }) => {
  const sent = await sentEmails();
  const link = sent[0].text.match(/https?:\/\/\S+\/unsubscribe\?t=\S+/)![0].replace(/^https?:\/\/[^/]+/, "");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: /Unsubscribe from/ })).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("heading", { name: "You are unsubscribed" })).toBeVisible();
  expect(await sql(`select 1 from public.email_suppressions where email = 'casey@harbor.test' and reason = 'unsubscribed'`)).toHaveLength(1);
  await page.goto("/unsubscribe?t=forged.token");
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();

  const [sender] = await sql<{ id: string }>(`select id from public.sender_identities limit 1`);
  const [m] = await sql<{ id: string }>(`insert into public.outreach_messages (shipper_id, shipper_contact_id, to_email, to_name, subject, body, sender_id, status) values ($1, $2, 'casey@harbor.test', 'Casey Morgan', 'Again', 'Hi {{contact.first_name}}', $3, 'pending_approval') returning id`, [shipperId, contactId, sender.id]);
  await signIn(page);
  await page.goto(`/admin/outreach/${m.id}`);
  await expect(page.getByText(/on the do not email list \(unsubscribed\)/).first()).toBeVisible();
  await page.getByRole("button", { name: "Approve this email" }).click();
  await expect(page.getByText(/on the do not email list/).last()).toBeVisible();
  expect((await sql<{ status: string }>(`select status from public.outreach_messages where id = $1`, [m.id]))[0].status).toBe("pending_approval");
});

test("delivery webhook: only signed events count; a bounce suppresses the address", async ({ request }) => {
  const [m] = await sql<{ provider_message_id: string }>(`select provider_message_id from public.outreach_messages where status = 'sent' limit 1`);
  const body = JSON.stringify({ type: "email.bounced", created_at: new Date().toISOString(), data: { email_id: m.provider_message_id, bounce: { message: "Mailbox does not exist" } } });
  const id = "msg_e2e_1";
  const ts = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from((process.env.RESEND_WEBHOOK_SECRET ?? "").replace(/^whsec_/, ""), "base64");
  const sig = `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
  const bad = await request.post("/api/webhooks/resend", { data: body, headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": ts, "svix-signature": "v1,AAAA" } });
  expect(bad.status()).toBe(401);
  const ok = await request.post("/api/webhooks/resend", { data: body, headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": ts, "svix-signature": sig } });
  expect(ok.status()).toBe(200);
  const again = await request.post("/api/webhooks/resend", { data: body, headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": ts, "svix-signature": sig } });
  expect(await again.json()).toMatchObject({ duplicate: true });
  const [row] = await sql<{ delivery_status: string; status: string }>(`select delivery_status, status from public.outreach_messages where provider_message_id = $1`, [m.provider_message_id]);
  expect(row).toEqual({ delivery_status: "bounced", status: "sent" });
  expect(await sql(`select 1 from public.email_events where provider_event_id = $1`, [id])).toHaveLength(1);
});

test("provider failure is recorded as not sent; missing details and launch templates block approval", async ({ page }) => {
  const [sender] = await sql<{ id: string }>(`select id from public.sender_identities limit 1`);
  const [owner] = await sql<{ id: string }>(`select id from public.profiles where role = 'owner' limit 1`);
  const [f] = await sql<{ id: string }>(`insert into public.outreach_messages (shipper_id, to_email, subject, body, sender_id, status, approved_by, approved_at) values ($1, 'fail@harbor.test', 'Hello', 'Hello there', $2, 'approved', $3, now()) returning id`, [shipperId, sender.id, owner.id]);
  await signIn(page);
  await page.goto(`/admin/outreach/${f.id}`);
  await page.getByLabel(/I want to send this email/).check();
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The recipient was rejected" })).toContainText("Not sent.");
  const [row] = await sql<{ status: string; provider_message_id: string | null; sent_at: string | null }>(`select status, provider_message_id, sent_at from public.outreach_messages where id = $1`, [f.id]);
  expect(row).toEqual({ status: "failed", provider_message_id: null, sent_at: null });

  const [blank] = await sql<{ id: string }>(`insert into public.outreach_messages (shipper_id, to_email, subject, body, sender_id, status) values ($1, 'new@harbor.test', 'Hi', 'Hi {{contact.first_name}}, regards {{sender.name}}', $2, 'pending_approval') returning id`, [shipperId, sender.id]);
  await page.goto(`/admin/outreach/${blank.id}`);
  await expect(page.getByText(/Missing information for: contact.first_name/)).toBeVisible();

  const [launch] = await sql<{ id: string }>(`select id from public.email_templates where name = 'Launch announcement'`);
  const [l] = await sql<{ id: string }>(`insert into public.outreach_messages (shipper_id, to_email, to_name, subject, body, sender_id, template_id, status) values ($1, 'robin@harbor.test', 'Robin Harbor', 'News', 'Hi {{contact.first_name}}', $2, $3, 'pending_approval') returning id`, [shipperId, sender.id, launch.id]);
  await page.goto(`/admin/outreach/${l.id}`);
  await expect(page.getByText(/can only be used once brokerage operations are enabled/).first()).toBeVisible();
  expect(await sentEmails()).toHaveLength(1);
});

test("templates: edits create versions; staff cannot change templates or sending setup", async ({ page, browser }) => {
  const [t] = await sql<{ id: string }>(`select id from public.email_templates where name = 'Relationship check in'`);
  await signIn(page);
  await page.goto(`/admin/outreach/templates/${t.id}`);
  await page.getByLabel("Subject").fill("Checking in from {{business.name}} this month");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText("Template saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Version 2").first()).toBeVisible();
  expect(await sql(`select version from public.email_template_versions where template_id = $1`, [t.id])).toHaveLength(2);

  const staff = await (await browser.newContext()).newPage();
  await signIn(staff, STAFF);
  await staff.goto(`/admin/outreach/templates/${t.id}`);
  await expect(staff.getByLabel("Template name")).toBeDisabled();
  await staff.goto("/admin/outreach/setup");
  await expect(staff.getByLabel("Sending domain")).toBeDisabled();
  await staff.goto("/admin/outreach/templates/new");
  await expect(staff).toHaveURL(/denied=1/);
});
