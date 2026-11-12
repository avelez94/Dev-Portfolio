# SEO audit (before changes), 2026-11-12

Method: a local production build (`next build` and `next start`, site URL set to the current
production address) crawled page by page; Lighthouse 13.6 (simulated mobile, local machine);
Vercel project settings read through the Vercel API. The live site could not be fetched from the
build machine directly because its network blocks vercel.app; the protection setting was read
from the project configuration instead.

## Priority 1: blocks search visibility

| Finding | Evidence | Fix |
| --- | --- | --- |
| The whole production site requires a Vercel login | Project setting `ssoProtection: all_except_custom_domains`; every vercel.app address of the project is behind Vercel Authentication | Intentional for prelaunch. Indexing starts when a custom domain is connected (custom domains are excluded from this protection) and you approve publication. Keep the vercel.app addresses protected so they never compete with the real domain |
| No custom domain yet; canonical, sitemap and Open Graph URLs use `velez-freight-group.vercel.app` (old name in the address) | `NEXT_PUBLIC_SITE_URL` in Vercel; canonical tags on every page | Switch `NEXT_PUBLIC_SITE_URL` when the domain is connected (see the migration checklist) |

## Priority 2: on page and technical

| Finding | Evidence | Fix |
| --- | --- | --- |
| Homepage has no canonical tag | Crawl: `canon: None` on `/` | Add |
| Every page shares the homepage's social title; no `og:url` | Crawl: identical `og:title` on all pages, `og:url` missing | Per page Open Graph and X metadata |
| Three meta descriptions are longer than search results show (about 155 to 160 characters) | Home 163, Services 170, Our Story 178 | Rewrite |
| Titles are generic and carry little search language | "Contact", "For Shippers", "Freight Services" | Descriptive titles with natural terms (freight brokerage, Maryland, expedited, dedicated) |
| No dedicated service pages: the three services live as sections of one page and homepage cards link to `#anchors` | `/services#expedited` | Create three service pages with real, useful content and link to them |
| Structured data: Organization only; no WebSite, no BreadcrumbList | Crawl: `['Organization']` on every page | Add WebSite (home) and BreadcrumbList (inner pages); enrich Organization (id, description, logo, social profiles when set) |
| 404 page outputs two `<title>` tags and no navigation back into the site | `/nonexistent-page` | Branded not found page |
| Sitemap lacks the future service pages and has no last modified dates | `/sitemap.xml` | Include all indexable pages with dates |
| Preview deployments would serve `Allow: /` if ever made public | `robots.ts` has no environment check | Disallow everything outside production |

## Priority 3: performance (Lighthouse, simulated mobile, local)

| Page | Performance | LCP | TBT | CLS | Accessibility, Best practices, SEO |
| --- | --- | --- | --- | --- | --- |
| Home | 53 | 4.7 s | 2,760 ms | 0 | 100, 100, 100 |
| Services | 83 | 4.7 s | 60 ms | 0 | 100, 100, 100 |
| Shippers | 83 | 4.8 s | 50 ms | 0 | 100, 100, 100 |
| Contact | 77 | 4.9 s | 250 ms | 0 | 100, 100, 100 |
| Our Story | 80 | 5.3 s | 60 ms | 0 | 100, 100, 100 |

The largest element on every page is the hero photo. It is preloaded, but on the homepage it
fades in from fully transparent, which postpones the moment the browser counts it as painted. The
homepage spends about 3 seconds in style and layout (simulated slow phone), versus 0.06 seconds
on Services; the difference is the layered, blended hero animating over a full screen photo.
These are lab figures from one machine, not field data from real visitors.

## Already in good shape (verified)

* Server rendered HTML for all public pages; static pages regenerate every minute.
* Exactly one H1 per page and a logical H2 and H3 order.
* All 20 content images have alt text; decorative images use empty alt; images are served as
  AVIF or WebP at responsive sizes.
* robots.txt blocks `/admin`, `/api/` and `/unsubscribe`; admin pages send `X-Robots-Tag: noindex`
  and `no-store`; `/admin` and `/admin/preview` require a server checked login (robots.txt is not
  relied on for security).
* Unsubscribe page is `noindex`; unknown pages return 404 with `noindex`.
* No broken internal links (every internal link returned 200).
* No old brand in visible text, titles or descriptions; "Velez" appears only in the temporary
  vercel.app address and in the founder's name.
* No FAQ structured data (correct: it is not needed).
* No analytics or Search Console verification installed yet.
* Accessibility 100 on all tested pages; no layout shift.

## After changes (2026-11-12, same method)

| Page | Performance | LCP | TBT | CLS | Accessibility, Best practices, SEO |
| --- | --- | --- | --- | --- | --- |
| Home | 76 (was 53) | 4.8 s | 310 ms (was 2,760) | 0 | 100, 100, 100 |
| Services | 83 | 4.7 s | 60 ms | 0 | 100, 100, 100 |
| Expedited Freight (new) | 90 | 3.6 s | 50 ms | 0 | 100, 100, 100 |
| Shippers | 89 (was 83) | 3.8 s | 40 ms | 0 | 100, 100, 100 |
| Contact | 79 | 4.8 s | 220 ms | 0 | 100, 100, 100 |
| Our Story | 79 | 5.4 s | 100 ms | 0 | 100, 100, 100 |

Lab results from a local machine with simulated slow 4G and a slowed CPU; they vary a few points
between runs and are not real visitor (field) measurements. Not preloading the serif font was
tried and reverted: it improved the homepage LCP slightly but introduced small layout shifts.

Fixed: homepage canonical; per page Open Graph and X metadata; descriptive titles; description
lengths; three service pages with breadcrumbs; WebSite and BreadcrumbList data; richer
Organization data; sitemap with every indexable page and review dates; preview deployments kept
out of search; branded 404 with one title; hero photo painted immediately.
