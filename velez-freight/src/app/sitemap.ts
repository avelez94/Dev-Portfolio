import type { MetadataRoute } from "next";
import { SEO, type PageSeo } from "@/config/seo";
import { SERVICE_PAGES } from "@/config/service-pages";
import { getSettings } from "@/lib/data/settings";
import { absoluteUrl } from "@/lib/seo";

// Rebuilt at most hourly so a service switched off in Website Content leaves the sitemap.
export const revalidate = 3600;

/** Every indexable public page, on the canonical address. Private and utility routes are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  const hidden = new Set(SERVICE_PAGES.filter((s) => !settings.services[s.slug]).map((s) => s.route));
  return (Object.values(SEO) as PageSeo[])
    .filter((p) => p.index && !hidden.has(p.path))
    .map((p) => ({ url: absoluteUrl(p.path), lastModified: p.updated }));
}
