import type { MetadataRoute } from "next";
import { site } from "@/config/site";

const routes = ["", "/services", "/shippers", "/carriers", "/our-story", "/contact", "/request-quote", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((r) => ({ url: `${site.url}${r}`, changeFrequency: "monthly", priority: r === "" ? 1 : 0.7 }));
}
