import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Crawling rules. robots.txt is advice to well behaved crawlers, not security: private areas are
 * protected by server side sign in checks. Preview and development deployments on Vercel ask
 * crawlers to stay out entirely; production allows public pages and points to the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/api/", "/unsubscribe"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
