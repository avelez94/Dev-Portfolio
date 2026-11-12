# SEO strategy and runbook

Goal: help business shippers who could become customers find Mary’s Logistics Group, without
overstating what the company does or when it starts. Nothing here guarantees rankings.

## 1. Keyword strategy

No keyword research tool or Search Console data was available, so **no search volume or
difficulty figures are claimed**. The terms below come from how shippers describe the need and
how the industry names the services. Once Search Console is connected, replace guesses with the
queries that actually produce impressions (Insights, Search & SEO tab).

| Intent | Example searches (unverified) | Page |
| --- | --- | --- |
| Find a brokerage near them | Maryland freight broker, freight brokerage Maryland, freight broker Baltimore | Home, Contact |
| Understand services | freight brokerage services, freight broker for small business | Services |
| Urgent freight | expedited freight, expedited trucking, time sensitive freight shipping | Expedited Freight |
| Exclusive or recurring capacity | dedicated transportation, dedicated truck, dedicated freight service | Dedicated Transportation |
| Everyday commercial freight | general freight shipping, palletized freight, full truckload broker, dry van freight | General Freight Coordination |
| Shipper fit | freight services for manufacturers, freight services for distributors, warehouse freight shipping | Shippers |
| Carriers looking for brokers | freight broker carrier setup, carrier partners Maryland | Carriers |
| Brand and trust | Mary’s Logistics Group, family owned freight broker | Our Story, Home |
| Quotes (operating only) | freight quote, freight shipping quote Maryland | Request a Quote |

Rules kept: one primary intent per page; no city by city pages; no services the company does not
offer (no warehousing, customs, LTL consolidation, ocean or air freight); no keyword stuffing.

## 2. Metadata inventory

Source of truth: `src/config/seo.ts`. Titles get " | Mary’s Logistics Group" automatically.

| Page | Title (prelaunch) | Operating title change | Description focus |
| --- | --- | --- | --- |
| `/` | Mary’s Logistics Group \| Maryland Freight Brokerage | same | Family owned Maryland brokerage; services; who it serves |
| `/services` | Freight Brokerage Services | same | Three services and how each works |
| `/services/expedited-freight` | Expedited Freight Coordination | same (description becomes active) | Time sensitive shipments |
| `/services/dedicated-transportation` | Dedicated Transportation Services | same (description becomes active) | Exclusive and recurring capacity |
| `/services/general-freight-coordination` | General Freight Coordination | same (description becomes active) | Palletized and commercial freight |
| `/shippers` | Freight Coordination for Shippers | same | Manufacturers, distributors, wholesalers, warehouses |
| `/carriers` | Carrier Partnerships | same | Authorized motor carriers |
| `/our-story` | Our Story and Founder | same | Named for Mary; founder |
| `/contact` | Contact Our Maryland Team | Contact a Maryland Freight Broker | Real person replies |
| `/request-quote` | Business Inquiry | Request a Freight Quote | Prelaunch: not yet arranging transportation |
| `/privacy`, `/terms` | Privacy Policy, Terms of Use | same | Policies |

Every page has a canonical URL, Open Graph and X metadata with its own title and URL, and the
shared 1200 by 630 social image. Service structured data and operating descriptions appear only
once operations are enabled.

## 3. Domain migration checklist

The planned domain is `maryslogisticsgroup.com`; it has **not** been purchased. Do these in order,
each with your approval:

1. Buy the domain. Decide apex (`maryslogisticsgroup.com`) or `www` as the primary; the other
   redirects to it.
2. Vercel > Project > Domains: add both, set the primary, let Vercel issue HTTPS certificates.
3. Registrar DNS: add the records Vercel shows. Wait for "Valid configuration".
4. Vercel environment: set `NEXT_PUBLIC_SITE_URL=https://<primary>`; redeploy. Canonical tags,
   sitemap, robots, Open Graph and structured data all follow it automatically.
5. Supabase Auth: Site URL and redirect URL `https://<primary>/admin/auth/callback`.
6. Test before announcing: home, a service page, `/sitemap.xml`, `/robots.txt`, a 404, `/admin`
   (must ask for sign in), and the canonical tag on several pages.
7. Old addresses: the `*.vercel.app` addresses were never public (Vercel Authentication), so
   search engines have nothing indexed there and no page by page redirect map is needed for SEO.
   Keep them protected so they never compete with the real domain. If you later want them to
   forward visitors, use a Vercel domain redirect that keeps the path (`/services` to
   `/services`), never a redirect of everything to the homepage.
8. Search Console: verify the Domain property (DNS TXT record), submit `/sitemap.xml`.
9. Analytics (if approved): configure for the new domain only.
10. Update public profiles (LinkedIn, directories) to the new URL.

Indexing begins only when you choose to publish the domain. While prelaunch, the site can be
public: every page already explains that services have not started.

## 4. Google Search Console setup (free)

1. Search Console: add a **Domain** property for the domain and verify with the DNS TXT record.
2. Submit `https://<domain>/sitemap.xml` under Sitemaps.
3. To show data in the dashboard (optional, read only):
   * Google Cloud console: create a project, enable the "Google Search Console API", create a
     service account, and create a JSON key.
   * Search Console > Settings > Users and permissions: add the service account email with
     **Restricted** permission.
   * Vercel environment (sensitive): `GSC_SITE_URL=sc-domain:<domain>`, `GSC_CLIENT_EMAIL`,
     `GSC_PRIVATE_KEY` (from the JSON key). Redeploy.
4. Insights > Search & SEO then shows clicks, impressions, click through rate, average position,
   top queries and pages, a daily trend, and sitemap indexing status. Data lags two to three days.

## 5. Analytics (decision needed)

Not installed. Options, both requiring your approval:

* **Vercel Web Analytics**: cookieless page views, no consent banner normally needed. Page views
  are included on the free plan; custom conversion events need a paid plan.
* **Google Analytics 4**: free, detailed, but sets cookies; a consent notice is advisable.

Conversions are already measured without either: each website inquiry records its landing page,
a broad channel (search, direct, referral, social, email) and the search engine name. No search
terms, full referrer, IP address or cookie is used, and the privacy policy says so.

## 6. Local and business listings

**Google Business Profile**: Google lists businesses that either serve customers in person at a
staffed location during stated hours, or travel to customers (service area businesses). A freight
brokerage run remotely, without customer visits, usually does **not** qualify. Do not use a
virtual office or mailbox address; that violates Google’s guidelines and risks suspension.
Create a profile only if you have an eligible staffed office customers can visit, and only after
operations begin. Bing Places applies similar rules.

Keep these consistent everywhere (name, website, phone, email, city or region):

* Website (Settings: Company Profile and Contact & Support)
* Maryland business records (SDAT) and, once granted, FMCSA registration
* LinkedIn company page; any industry association or directory you choose to join

Suggested description (adjust before use; no dashes):

> Mary’s Logistics Group is a family owned freight brokerage based in Maryland, named in honor of
> Mary and founded by Alante Velez. We are preparing to coordinate expedited freight, dedicated
> transportation, and general freight for manufacturers, distributors, wholesalers, and
> warehouses, working with qualified, authorized motor carriers and keeping shippers informed
> from pickup to delivery.

Operating version: replace "We are preparing to coordinate" with "We coordinate", only after
broker authority and filings are verified.

## 7. Content plan (each article reviewed by you before publishing)

| Article | Question it answers | Links to |
| --- | --- | --- |
| What Does a Freight Broker Do? | How brokers, carriers and shippers relate; what to expect | Services, Shippers |
| Expedited vs. Standard Freight | When paying for speed makes sense | Expedited Freight |
| How to Prepare a Shipment for a Freight Quote | The details that make a quote accurate | Request a Quote, General Freight |
| What Information Does a Freight Broker Need? | Checklist for a first conversation | Contact, Shippers |
| Choosing the Right Freight Equipment | Dry van, refrigerated, flatbed, box truck, van | General Freight |
| Understanding Freight Shipping Costs | What drives price (distance, equipment, timing, accessorials), without quoting rates | Services |

Publish slowly (one or two a month), written from real experience, with a named author and a
review date. Do not publish many short or automatically written pages. A `/resources` section
can be added when the first article is approved.

## 8. Remaining issues and next steps

* Site is not public yet (Vercel Authentication on vercel.app); needs the custom domain and your
  publishing approval.
* Search Console and analytics need your approval and accounts.
* Lab LCP on mobile is about 3.6 to 5.4 seconds under simulated slow 4G, mostly network time for
  fonts, CSS and JavaScript; field data (real visitors) is not available until the site is public.
* The homepage H1 is the approved slogan; the descriptive line above it now carries the
  "family owned freight brokerage in Maryland" wording.
* Articles in section 7 need your knowledge and review; none were published.
