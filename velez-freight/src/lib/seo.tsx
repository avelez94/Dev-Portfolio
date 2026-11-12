import type { Metadata } from "next";
import { site } from "@/config/site";
import { SEO, type SeoKey } from "@/config/seo";

const OG_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630, alt: `${site.name} logo and tagline beside a truck on a highway at dusk` };

/** Absolute URL on the canonical site address (NEXT_PUBLIC_SITE_URL). */
export const absoluteUrl = (path: string) => `${site.url.replace(/\/$/, "")}${path === "/" ? "" : path}`;

/**
 * Page metadata from the SEO inventory: title, description, canonical, Open Graph and X card.
 * Operating wording is used only when the site is operating, so search snippets never claim
 * services are available before broker authority is verified.
 */
export function pageMetadata(key: SeoKey, operational: boolean, extra: Partial<Metadata> = {}): Metadata {
  const p = SEO[key] as (typeof SEO)[SeoKey] & { title?: string; absoluteTitle?: string; operational?: { title?: string; absoluteTitle?: string; description?: string } };
  const op = operational ? p.operational ?? {} : {};
  const absolute = op.absoluteTitle ?? p.absoluteTitle;
  const pageTitle = op.title ?? p.title;
  const fullTitle = absolute ?? `${pageTitle} | ${site.name}`;
  const description = op.description ?? p.description;
  return {
    title: absolute ? { absolute } : pageTitle,
    description,
    alternates: { canonical: p.path },
    openGraph: { type: "website", siteName: site.name, locale: "en_US", url: p.path, title: fullTitle, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [OG_IMAGE.url] },
    ...extra,
  };
}

/** Serializes structured data safely for an inline script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export const ORG_ID = () => `${absoluteUrl("/")}/#organization`;

export function breadcrumbData(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function websiteData() {
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": `${absoluteUrl("/")}/#website`, name: site.name, url: absoluteUrl("/"), publisher: { "@id": ORG_ID() }, inLanguage: "en-US" };
}
