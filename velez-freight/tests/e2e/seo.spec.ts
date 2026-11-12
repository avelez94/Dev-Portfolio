// Technical SEO on the prelaunch build: metadata, structured data, crawl rules, compliance with
// the launch controls, and privacy minded inquiry attribution.
import { expect, test, type Page } from "@playwright/test";
import { PRELAUNCH, resetRateLimits, seedUsers, signIn, sql, humanPause } from "./helpers";

test.use({ baseURL: PRELAUNCH });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => seedUsers());
test.beforeEach(async () => resetRateLimits());

const PAGES = ["/", "/services", "/services/expedited-freight", "/services/dedicated-transportation", "/services/general-freight-coordination", "/shippers", "/carriers", "/our-story", "/contact", "/request-quote", "/privacy", "/terms"];

async function head(page: Page) {
  return page.evaluate(() => ({
    titles: [...document.querySelectorAll("head title")].map((t) => t.textContent),
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? "",
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "",
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
    h1: document.querySelectorAll("h1").length,
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent || "{}")),
  }));
}

test("every public page has one unique title, a description, a canonical URL and one H1", async ({ page }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    const h = await head(page);
    expect(h.titles, path).toHaveLength(1);
    expect(h.titles[0]!.length, `${path} title length`).toBeLessThanOrEqual(65);
    expect(h.description.length, `${path} description length`).toBeGreaterThan(50);
    expect(h.description.length, `${path} description length`).toBeLessThanOrEqual(160);
    expect(h.canonical, path).toBe(`${PRELAUNCH}${path === "/" ? "" : path}`);
    expect(h.ogUrl, path).toBe(h.canonical);
    expect(h.ogTitle, path).toBe(h.titles[0]);
    expect(h.robots, path).not.toContain("noindex");
    expect(h.h1, path).toBe(1);
    titles.add(h.titles[0]!);
    descriptions.add(h.description);
    // No dashes in printed metadata (owner preference) and no old brand.
    expect(`${h.titles[0]} ${h.description}`, path).not.toMatch(/[–—]| - |velez freight|vfg/i);
  }
  expect(titles.size).toBe(PAGES.length);
  expect(descriptions.size).toBe(PAGES.length);
});

test("structured data: Organization everywhere, WebSite on home, breadcrumbs on service pages, nothing invented", async ({ page }) => {
  await page.goto("/");
  let ld = (await head(page)).ld;
  const org = ld.find((d) => d["@type"] === "Organization")!;
  expect(org).toMatchObject({ name: "Mary’s Logistics Group", url: PRELAUNCH, address: { addressRegion: "MD", addressCountry: "US" } });
  expect(org.logo.url).toBe(`${PRELAUNCH}/brand/mlg-logo-stacked.png`);
  expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|review|award|streetAddress|foundingDate|FAQPage|hasCredential/i);
  expect(ld.some((d) => d["@type"] === "WebSite")).toBe(true);
  expect((await page.request.get(`${PRELAUNCH}/brand/mlg-logo-stacked.png`)).status()).toBe(200);

  await page.goto("/services/expedited-freight");
  ld = (await head(page)).ld;
  const crumbs = ld.find((d) => d["@type"] === "BreadcrumbList")!;
  expect(crumbs.itemListElement.map((i: { name: string; item: string; position: number }) => [i.position, i.name, i.item])).toEqual([
    [1, "Home", PRELAUNCH], [2, "Services", `${PRELAUNCH}/services`], [3, "Expedited Freight", `${PRELAUNCH}/services/expedited-freight`],
  ]);
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Expedited Freight");
  // Prelaunch: no Service entity (it would present the service as available).
  expect(ld.some((d) => d["@type"] === "Service")).toBe(false);
  expect(ld.some((d) => d["@type"] === "WebSite")).toBe(false);
});

test("service pages keep the prelaunch restrictions and link to each other", async ({ page }) => {
  for (const path of ["/services/expedited-freight", "/services/dedicated-transportation", "/services/general-freight-coordination"]) {
    await page.goto(path);
    await expect(page.getByText("Planned service").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Request a Freight Quote/ })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/now arranging|accepting freight|licensed broker|we are authorized/i);
    await expect(page.getByRole("heading", { name: "Related services" })).toBeVisible();
  }
  await page.goto("/");
  await page.getByRole("link", { name: /Expedited Freight/ }).first().click();
  await expect(page).toHaveURL(/\/services\/expedited-freight$/);
});

test("sitemap, robots, 404 and private routes", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of PAGES) expect(sitemap).toContain(`<loc>${PRELAUNCH}${path === "/" ? "" : path}</loc>`);
  expect(sitemap).not.toMatch(/admin|unsubscribe|api\//);
  expect(sitemap).toContain("<lastmod>");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain(`Sitemap: ${PRELAUNCH}/sitemap.xml`);
  expect(robots).not.toMatch(/Disallow: \/\s*$/m);

  const missing = await page.goto("/no-such-page");
  expect(missing?.status()).toBe(404);
  const h = await head(page);
  expect(h.titles).toEqual(["Page not found | Mary’s Logistics Group"]);
  expect(h.robots).toContain("noindex");
  await expect(page.getByRole("link", { name: "Freight services" })).toBeVisible();

  for (const path of ["/admin", "/admin/preview", "/admin/insights?tab=seo"]) {
    const r = await request.get(path, { maxRedirects: 0 });
    expect(r.headers()["x-robots-tag"], path).toContain("noindex");
  }
  // Signed out: the admin preview of the service pages redirects to sign in.
  await page.goto("/admin/preview/services/expedited-freight");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("an inquiry records only the landing page, channel and search engine; the SEO tab shows it", async ({ page }) => {
  await page.goto("/services/expedited-freight", { referer: "https://www.google.com/" });
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Search Visitor");
  await page.getByLabel("Business email").fill("search.visitor@example.test");
  await page.getByLabel("Message").fill("We found you through search and ship pallets weekly.");
  await page.getByRole("checkbox").check();
  await humanPause(page);
  await page.getByRole("button", { name: /Send Your Message/ }).click();
  await expect(page.getByText(/Message received/)).toBeVisible();
  const [inq] = await sql<{ id: string }>(`select id from public.contact_inquiries where email = 'search.visitor@example.test'`);
  await expect.poll(async () => (await sql(`select landing_page, traffic_channel, search_engine, inquiry_type from public.inquiry_attribution where inquiry_id = $1`, [inq.id]))[0])
    .toEqual({ landing_page: "/services/expedited-freight", traffic_channel: "organic_search", search_engine: "google", inquiry_type: "general" });

  await signIn(page);
  await page.goto("/admin/insights?tab=seo");
  await expect(page.getByText("Not connected. Needed for search queries")).toBeVisible();
  await expect(page.getByText(/Using the temporary address|Search engines are pointed to/)).toBeVisible();
  await expect(page.locator("div.rounded-lg", { has: page.getByText("From search engines", { exact: true }) })).toContainText("1");
  await expect(page.getByText("Clicks from Google search")).toHaveCount(0);
});
