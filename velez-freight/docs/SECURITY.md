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
| Sensitive data | Forms warn against and do not request SSNs, bank details, tax forms or documents. Carrier onboarding documents belong in a separate secure workflow. |

## Supabase project settings to apply

1. Authentication > Sign In / Providers: **disable "Allow new users to sign up"**.
2. Authentication > URL Configuration: Site URL = production URL; add
   `https://<domain>/admin/auth/callback` to Redirect URLs.
3. Authentication > Email: use a custom SMTP sender before launch.
4. Enable leaked password protection and set a minimum password length of 12.
5. Run the database advisors (Security Advisor) after applying the migration.

## Tests

* `npm run test:db`: 45 tests against the real migrations on Postgres (grants, RLS, gates, carrier qualification, task generation and deduplication, immutable history, and metric accuracy against an independent calculation).
* `npm run test:e2e`: Playwright flows against production builds, with a test only Supabase stand in that executes queries under the caller's Postgres role so RLS is exercised.
