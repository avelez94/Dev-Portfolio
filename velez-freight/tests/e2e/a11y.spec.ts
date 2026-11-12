import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PRELAUNCH } from "./helpers";

// Automated WCAG 2.2 A/AA checks with axe-core. Automated scans catch roughly a third to half of
// issues; they do not replace manual screen reader and keyboard review.
const pages = ["/", "/services", "/services/expedited-freight", "/services/dedicated-transportation", "/services/general-freight-coordination", "/shippers", "/carriers", "/our-story", "/contact", "/request-quote", "/privacy", "/terms", "/admin/login"];

for (const path of pages) {
  test(`axe: ${path} has no WCAG A/AA violations (prelaunch)`, async ({ page }) => {
    await page.goto(`${PRELAUNCH}${path}`);
    await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((e) => e.classList.add("is-visible")));
    await page.waitForTimeout(1200); // let entrance animations and reveals settle so colors are final
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}
