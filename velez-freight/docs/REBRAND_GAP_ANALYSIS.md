# Rebrand: Velez Freight Group to Mary’s Logistics Group

## Audit (before changes)

A repository search for Velez, Velez Freight, Velez Freight Group, VFG, velez-freight-group,
old logo files, signatures, copyright, metadata and alt text found about 60 references in
source code plus logos, metadata, tests, docs and database identifiers. The live database held
no records containing the old name (one account and one audit entry).

## Classification and decision

| Where | Class | Decision |
| --- | --- | --- |
| Page copy, headings, CTAs, FAQs, forms, confirmations, footer, header, alt text | Current display | Rewritten sentence by sentence |
| Page titles, descriptions, Open Graph, X card, structured data, manifest, favicon, social image | Current display | Replaced |
| Logo files and component | Current display | New logo system traced from the supplied artwork; old files archived in `brand-source/archive/velez-freight-group/` |
| Dashboard header, title, sidebar, welcome line, prelaunch notice | Current display | Rebranded; navigation and features unchanged |
| PDF and CSV reports, export file names | Current templates | New name, logo symbol in PDF header, company line in CSV |
| Email notification template | Current template | New name; sender stays configurable (`NOTIFY_EMAIL_FROM`) and must be on a verified domain |
| AI architecture | Configuration | Shared brand context added; no behavior change, nothing enabled |
| Legal name (`legalName` constant, "LLC confirmed" toggle) | Legal identity | Replaced by a configurable legal entity name that shows only after it is confirmed; the earlier confirmation is reset because it applied to the old name |
| Record references `VFG-…` | Historical identifiers | Existing references unchanged; new records use `MLG-` |
| Internal SQL names (`vfg_today`, `vfg_day_start`, cron job names), repository folder `velez-freight`, Vercel project `velez-freight-group`, domain `velez-freight-group.vercel.app` | External or internal identifiers | Unchanged on purpose: renaming would break hosting, scheduled jobs or links. Not visible to visitors |
| Audit log, timestamps, financial amounts, auth accounts | Immutable history | Untouched |
| Migration history and rollback scripts | History | Unchanged |

## What was added

* `src/config/brand.ts`: public brand, intended legal name, previous name, reference prefix.
* Settings > Business identity: legal entity name and confirmation, trademark clearance status,
  broker authority status, private business address, website domain, operational status.
* Settings > Launch checklist: Maryland name approval, registered LLC name, federal trademark
  clearance, common law review, domain, FMCSA records, surety bond, banking, insurance, legal
  template review. Progress also shows on the dashboard in prelaunch mode.
* Safety: operations cannot be enabled unless broker authority status is recorded as active, in
  addition to the existing MC number, verification date, typed confirmation and the
  `BROKER_AUTHORITY_ACTIVE` deployment switch.
* Migration `20261114000100_business_identity.sql` (additive, reversible).

## Domain migration plan (when a domain is chosen)

1. Register the domain; record it in Settings > Business identity.
2. Vercel: add the domain to the project, set it as primary, keep
   `velez-freight-group.vercel.app` redirecting to it (Vercel redirects automatically when the
   new domain is primary). SSL is issued by Vercel.
3. DNS: add the records Vercel shows (A or CNAME) at the registrar.
4. Vercel environment: set `NEXT_PUBLIC_SITE_URL` to `https://<domain>` and redeploy (canonical
   URLs, sitemap, structured data and email links follow it).
5. Supabase Auth: Site URL `https://<domain>`; add `https://<domain>/admin/auth/callback` to
   Redirect URLs; keep the old one until the switch is confirmed, then remove it.
6. Resend: verify the domain (SPF, DKIM records), then set `NOTIFY_EMAIL_FROM` to an address on
   it.
7. Make the site public (custom domains are outside Vercel Authentication by default).
8. Search Console: add the property and submit `https://<domain>/sitemap.xml`.

## Requires owner approval before deployment

1. Apply migration `20261114000100_business_identity.sql` to the live Supabase project.
2. Deploy the rebranded site to production.
3. Any domain purchase, DNS change or Vercel project rename.
