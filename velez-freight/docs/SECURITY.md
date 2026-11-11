# Security model

| Layer | Control |
| --- | --- |
| Browser | Only the public Supabase URL and anon key are shipped. The anon role has **no** table or function privileges. |
| Public forms | Next.js server actions validate with Zod, check a signed time token (blocks instant bot posts and replays), a honeypot field, and a per connection rate limit stored as a salted SHA 256 hash (no raw IPs stored). Writes use the service role on the server only. |
| Quote intake | Refused unless `BROKER_AUTHORITY_ACTIVE=true` **and** the dashboard switch is on. Enforced in the server action and again by a database trigger. Enabling the switch requires a typed confirmation, an MC number and a verification date. |
| Admin access | Supabase Auth email and password. Invite only: no sign up page; new auth users get an inactive profile. `requireStaff()` verifies the session with the Auth server on every page and action. |
| Database | RLS on every table. Staff can read and update CRM data; only owners and admins can delete records, change settings or read the audit log. Profiles cannot be changed by their owners. |
| Audit | `audit_events` is append only (a trigger blocks update and delete, even for the service role). Sign ins, failed sign ins, submissions and changes are recorded. |
| Headers | HSTS, X Frame Options DENY, nosniff, strict referrer policy, restrictive permissions policy. Admin pages are `noindex` and `no-store`. |
| Financial records | Invoices, payments, carrier bills, carrier payments, operating expenses and the audit log are readable by owners and admins only (RLS). Financial analytics functions refuse other roles rather than returning zeros. |
| Brokerage gates | Quotes, shipments, invoices and carrier bills cannot be inserted while operations are disabled (database trigger), in addition to server checks. Carrier assignment is refused by the database unless the qualification rule passes. |
| Evidence and history | Stage history, carrier verification evidence and shipment events are append only. |
| Exports | Report exports require a staff session, enforce admin only reports on the server, are never cached, contain no bank data, neutralize spreadsheet formulas, and are written to the audit log. URLs carry only dates and record IDs. |
| Scheduled reports | The schedule table has a check constraint that keeps every schedule disabled until delivery is approved. |
| Document files | Private Supabase storage bucket `documents` with no storage policies: only the server can read or write. Uploads use a one time signed URL issued after the session and record are checked; files get random names under their record's folder; the server verifies the stored type, size and location before saving the record, and removes the file if saving fails. Downloads go through `/admin/documents/<id>`, which re checks access, logs the download and redirects to a link valid for one minute. W9 files open for owners and admins only. PDF and photos only, 15 MB maximum. |
| Launch preview | `/admin/preview` renders the public pages in the launch state for owners and admins only. `requireAdmin()` runs in the layout and again in every page render; a request scoped flag (set only after that check) changes the operating status for that render alone. Preview forms call a server action that re checks the admin session, validates with the public schemas and writes nothing. Pages are `noindex` and `no-store`. The public site's own gates are unchanged. |
| Regulatory credentials | Entered and verified are separate states. Verified needs a value, a date and a source (database constraint). Only verified credentials can be shown publicly, and only while operating; the EIN can never be public and is hidden from staff by RLS. Every change is logged in an append only history; evidence files are owner and admin only. Enabling operations requires a verified MC number. |
| Website text | Editable slots fall back to the approved defaults. Every save and restore is an append only version. Only owners and admins can edit. |
| Outreach email | Nothing can be sent unless all gates pass on the server at the moment of sending: provider key, a sending domain verified with the provider, a sender on that domain, a mailing address, signed unsubscribe links, the owner's typed approval, per message approval by an owner or admin, a final confirmation, the daily limit, and the do not email list. A message is claimed atomically and sent with an idempotency key. The database refuses `sent` without the provider's message id and refuses any delivery field written by a signed in user. |
| Unsubscribe | HMAC signed links (no expiry, as the law requires them to keep working) and RFC 8058 one click. Unsubscribes, bounces and complaints are permanent from the dashboard. |
| Delivery webhook | `/api/webhooks/resend` accepts only Svix signed requests within five minutes and stores each event once. Opens and clicks are not tracked. |
| Agents | All agents start disabled. AI agents cannot be enabled (database trigger) until an AI provider is approved. The one available agent is rules based and read only; enabling it needs a typed confirmation and runs are owner and admin only. |
| Sensitive data | Forms warn against and do not request SSNs, bank details, tax forms or documents. Carrier onboarding documents belong in a separate secure workflow. |

## Supabase project settings to apply

1. Authentication > Sign In / Providers: **disable "Allow new users to sign up"**.
2. Authentication > URL Configuration: Site URL = production URL; add
   `https://<domain>/admin/auth/callback` to Redirect URLs.
3. Authentication > Email: use a custom SMTP sender before launch.
4. Enable leaked password protection and set a minimum password length of 12.
5. Run the database advisors (Security Advisor) after applying migrations.

## Production project status (applied 2026-11-11)

* All migrations applied to project `mjdrehxyaweamzfqolib`. A fingerprint of functions,
  columns, constraints, policies, triggers, indexes, grants and RLS flags matched a local
  database built from these files exactly.
* Background job `vfg_refresh_system_tasks` runs every 15 minutes; `vfg_cron_history_cleanup`
  trims job history daily. (The `vfg_` prefix on internal function and job names predates the
  rebrand; they are internal identifiers and are intentionally unchanged.)
* Security Advisor: `carrier_qualification` was changed to run with the caller's rights
  (migration `20261113000200`). Remaining notices are intentional: `is_staff()` and
  `is_admin()` only report on the signed in user and must be callable for RLS;
  `refresh_system_tasks` refuses anyone who is not active staff; `submission_rate_limits` and
  `system_jobs` have no policies so only the server and the database itself can use them.
* No data has been inserted. Operations remain disabled.

## Tests

* `npm run test:db`: 47 tests against the real migrations on Postgres (grants, RLS, gates, carrier qualification, task generation and deduplication, immutable history, and metric accuracy against an independent calculation).
* `npm run test:e2e`: Playwright flows against production builds, with a test only Supabase stand in that executes queries under the caller's Postgres role so RLS is exercised.
