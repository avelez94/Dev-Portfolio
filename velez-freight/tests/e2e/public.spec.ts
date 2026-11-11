import { expect, test } from "@playwright/test";
import { humanPause, PRELAUNCH, resetRateLimits, sql } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.beforeEach(async () => resetRateLimits());

test("homepage renders the approved hero and an honest prelaunch status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your freight.");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every mile.");
  await expect(page.getByText("We’re preparing to launch.", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a Freight Quote" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
});

test("every public route renders with its own title", async ({ page }) => {
  const routes: [string, RegExp][] = [
    ["/services", /Freight Services/], ["/shippers", /For Shippers/], ["/carriers", /Carrier Partnerships/], ["/our-story", /Our Story/],
    ["/contact", /Contact/], ["/request-quote", /Business Inquiry/], ["/privacy", /Privacy Policy/], ["/terms", /Terms of Use/],
  ];
  for (const [path, title] of routes) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page).toHaveTitle(title);
    expect(await page.getByRole("heading", { level: 1 }).count(), `${path} has one h1`).toBe(1);
  }
  expect((await page.goto("/no-such-page"))?.status()).toBe(404);
});

test("prelaunch request page offers a business inquiry, not a freight booking", async ({ page }) => {
  await page.goto("/request-quote");
  // The disclosure is still present, in the shorter contextual form.
  await expect(page.getByText("We’re not arranging shipments or providing quotes yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Freight Inquiry" })).toHaveCount(0);
  await expect(page.getByLabel("Inquiry type")).toHaveValue("shipper");
});

test("launch notification: validation, success with reference, and persistence", async ({ page }) => {
  await page.goto("/");
  const form = page.getByRole("form", { name: "Launch notification sign up" });
  await form.getByRole("button", { name: /Keep Me Posted/ }).click();
  await expect(form.getByText("Your name is required.")).toBeVisible();
  await expect(form.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");

  await form.getByLabel("Name").fill("Jordan Shipper");
  await form.getByLabel("Business email").fill("jordan@example.test");
  await form.getByLabel("Company").fill("Harbor Supply Co");
  await form.getByLabel("Typical freight").selectOption("dry_van");
  await form.getByRole("checkbox").check();
  await humanPause(page);
  await form.getByRole("button", { name: /Keep Me Posted/ }).click();
  await expect(form.getByRole("status")).toContainText(/Reference: MLG-C-[A-F0-9]{8}/);
  const rows = await sql<{ inquiry_type: string; company: string; status: string }>("select inquiry_type, company, status from public.contact_inquiries where email = 'jordan@example.test'");
  expect(rows).toEqual([{ inquiry_type: "launch_notification", company: "Harbor Supply Co", status: "new" }]);
});

test("contact form stores a general inquiry and writes an audit event", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Avery Contact");
  await page.getByLabel("Business email").fill("avery@example.test");
  await page.getByLabel("Phone number").fill("410 555 0199");
  await page.getByLabel("Message").fill("We would like to learn more about your plans.");
  await page.getByRole("checkbox").check();
  await humanPause(page);
  await page.getByRole("button", { name: /Send Your Message/ }).click();
  await expect(page.getByText(/Message received. Reference MLG-C-/)).toBeVisible();
  const [row] = await sql<{ id: string; inquiry_type: string }>("select id, inquiry_type from public.contact_inquiries where email = 'avery@example.test'");
  expect(row.inquiry_type).toBe("general");
  await expect.poll(async () => (await sql("select 1 from public.audit_events where entity_id = $1", [row.id])).length).toBe(1);
});

test("carrier inquiry creates a carrier lead linked to its inquiry", async ({ page }) => {
  await page.goto("/carriers");
  const form = page.getByRole("form", { name: "Carrier partnership inquiry" });
  await form.getByLabel("Company name").fill("Blue Ridge Haulers");
  await form.getByLabel("Contact name").fill("Sam Driver");
  await form.getByLabel("Email").fill("sam@example.test");
  await form.getByLabel("Phone").fill("301 555 0142");
  await form.getByLabel("MC number").fill("MC 123456");
  await form.getByLabel("USDOT number").fill("7654321");
  await form.getByLabel("Box truck").check();
  await form.getByLabel("Dry van").check();
  await form.getByLabel("Operating region or preferred lanes").fill("Mid Atlantic");
  await form.getByRole("checkbox", { name: /privacy notice/ }).check();
  await humanPause(page);
  await form.getByRole("button", { name: /Submit a Carrier Inquiry/ }).click();
  await expect(page.getByText(/Inquiry received. Reference MLG-C-/)).toBeVisible();
  const [lead] = await sql<{ id: string; mc_number: string; equipment: string[]; verification_status: string }>("select id, mc_number, equipment, verification_status from public.carrier_leads where email = 'sam@example.test'");
  expect(lead).toMatchObject({ mc_number: "123456", equipment: ["dry_van", "box_truck"], verification_status: "unverified" });
  const inq = await sql("select 1 from public.contact_inquiries where carrier_lead_id = $1 and inquiry_type = 'carrier'", [lead.id]);
  expect(inq.length).toBe(1);
});

test("spam protection: honeypot and instant submissions are refused and nothing is stored", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Bot");
  await page.getByLabel("Business email").fill("bot@example.test");
  await page.getByLabel("Message").fill("Buy cheap things now please");
  await page.getByRole("checkbox").check();
  await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => { el.value = "http://spam.example"; });
  await humanPause(page);
  await page.getByRole("button", { name: /Send Your Message/ }).click();
  await expect(page.getByRole("form", { name: "Contact form" }).getByRole("alert")).toContainText("could not accept");
  expect((await sql("select 1 from public.contact_inquiries where email = 'bot@example.test'")).length).toBe(0);
});

test("rate limiting stops repeated launch sign ups from one connection", async ({ page }) => {
  for (let i = 1; i <= 4; i++) {
    await page.goto("/");
    const form = page.getByRole("form", { name: "Launch notification sign up" });
    await form.getByLabel("Name").fill(`Repeat ${i}`);
    await form.getByLabel("Business email").fill(`repeat${i}@example.test`);
    await form.getByRole("checkbox").check();
    await humanPause(page);
    await form.getByRole("button", { name: /Keep Me Posted/ }).click();
    if (i <= 3) await expect(form.getByRole("status")).toContainText("Reference");
    else await expect(form.getByRole("alert")).toContainText("several submissions");
  }
  expect((await sql("select 1 from public.contact_inquiries where email like 'repeat%'")).length).toBe(3);
});

test("FAQ accordion works with the keyboard and exposes state", async ({ page }) => {
  await page.goto("/contact#faq");
  const trigger = page.getByRole("button", { name: "Do you provide 24/7 support?" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/around the clock operational support/)).toBeVisible();
});

test("mobile menu opens, traps focus, and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.click();
  const dialog = page.getByRole("dialog", { name: "Site menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Home", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test("SEO files and security headers are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toMatch(/Disallow: \/admin/);
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/our-story");
  const home = await request.get("/");
  expect(home.headers()["x-frame-options"]).toBe("DENY");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
});

test("no old brand name appears on any public page, in metadata or in the manifest", async ({ page }) => {
  for (const path of ["/", "/services", "/shippers", "/carriers", "/our-story", "/contact", "/request-quote", "/privacy", "/terms", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml"]) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(200);
    // The old brand only. "Velez" alone is the founder's surname and is expected on Our Story.
    expect(await res.text(), path).not.toMatch(/velez freight|velez-freight|vfg|freight group/i);
  }
  // Visible text never shows raw escape codes (for example a literal \u2019 instead of an apostrophe).
  for (const path of ["/", "/services", "/shippers", "/carriers", "/our-story", "/contact", "/request-quote", "/privacy", "/terms"]) {
    await page.goto(path);
    expect(await page.locator("body").innerText(), path).not.toMatch(/\\u[0-9a-fA-F]{4}/);
  }
  await page.goto("/");
  await expect(page).toHaveTitle("Mary’s Logistics Group | Freight Brokerage & Transportation Coordination");
  await expect(page.getByRole("link", { name: "Mary’s Logistics Group home" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why Choose Mary’s Logistics Group?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A Legacy That Moves Us Forward" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Haul With Mary’s Logistics Group" })).toBeVisible();
  // Structured data names the brand; a legal name appears only once confirmed in Settings.
  await expect.poll(async () => {
    await page.goto("/");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
    return [ld.name, ld.legalName ?? null];
  }, { timeout: 15000 }).toEqual(["Mary’s Logistics Group", null]);
});

test("our story: story, founder profile with headshot, and approach", async ({ page }) => {
  await page.goto("/our-story");
  await expect(page.getByRole("heading", { level: 2, name: "Named in honor of Mary" })).toBeVisible();
  const founder = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Alante Velez" }) });
  const photo = founder.getByRole("img", { name: "Alante Velez, Founder & CEO of Mary’s Logistics Group" });
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(founder.getByText("Founder & CEO", { exact: true })).toBeVisible();
  await expect(founder).toContainText("Her experience in the transportation industry began working alongside her father");
  for (const h of ["Transportation Experience", "Technology & Innovation", "Leadership & Relationships"]) {
    await expect(founder.getByRole("heading", { level: 3, name: h })).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 2, name: "How we work with you" })).toBeVisible();
  for (const h of ["Personalized service", "Clear communication", "Responsible carrier selection", "Organization", "Technology enabled operations"]) {
    await expect(page.getByRole("heading", { level: 3, name: h })).toBeVisible();
  }
  // Phone width: the profile fits without sideways scrolling.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("warmer homepage: new hero copy, friendly CTAs, one prelaunch notice, founder introduction", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("At Mary’s Logistics Group, relationships come first, and every shipment matters.")).toBeVisible();
  const talk = page.getByRole("link", { name: "Let’s Talk Freight" }).first();
  await expect(talk).toHaveAttribute("href", "/contact");
  // The full prelaunch notice appears once (the sitewide bar), not repeated down the page.
  expect(await page.getByText("Freight services begin once our broker registration is complete", { exact: false }).count()).toBe(1);
  await expect(page.getByRole("img", { name: "Alante Velez, Founder & CEO of Mary’s Logistics Group" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Meet Our Founder" })).toHaveAttribute("href", "/our-story");
  await expect(page.getByRole("heading", { level: 2, name: "Tell Us About Your Business." })).toBeVisible();
  // Nothing on the prelaunch homepage offers a quote or booking.
  await expect(page.getByRole("link", { name: /quote/i })).toHaveCount(0);
});

test("shippers page speaks to real shipper concerns, including unexpected issues", async ({ page }) => {
  await page.goto("/shippers");
  for (const h of ["You won’t be left waiting", "Straight answers, in plain language", "Your requirements, taken seriously", "Plans built around your schedule", "Coordination handled for you", "Carriers you can rely on", "When plans change, you’ll hear it from us first"]) {
    await expect(page.getByRole("heading", { level: 3, name: h })).toBeVisible();
  }
  await expect(page.getByText("This is how we will work once our broker registration is complete.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Let’s Talk Freight" })).toHaveAttribute("href", "/contact");
});
