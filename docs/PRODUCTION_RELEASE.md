# Production release, October 29

Preview and production share one Supabase database, so all release testing is done on production with clearly labeled test records and your own email. No synthetic seeding, race tests, outage simulations, or destructive tests run against this database. All of those ran only on a local copy (PostgreSQL 16 + PostgREST 12).

## Status (final, October 29)

| Step | Result |
|---|---|
| Code on production (`main` = `5f74966`) | **Live.** Vercel Production deployment succeeded; alantevelez.com serves the new site and dark admin. |
| Backup | Confirmed: physical backup Oct 29, 06:21 UTC. |
| Read only precheck | Done. No booking conflicts, text status column, no status constraint. |
| `20261028_terms_version.sql` | Applied and verified. No historical document stamped. |
| `20261028_intake_flow.sql` | Applied and verified. Existing leads unchanged. |
| `20261029_document_brand_version.sql` | Applied and verified. No existing invoice stamped. |
| `20261029_booking_integrity.sql` | Applied and verified (two unique indexes, created_at default now()). |
| `20261029_server_role_grants.sql` | Applied and verified (server key full rights on 16 tables; admin 403s on pricing and invoice_milestones fixed). |
| `20261029_lock_down_private_tables.sql` | Applied and verified: RLS on, 0 policies, 0 public grants on 16 tables, row counts unchanged; public key refused (401); trades still open; admin all 200; dog walking and TBR2026 working. |
| Admin uses protected routes | Verified: no browser requests to Supabase; data route returns Unauthorized when signed out. |
| Public pages, pricing guide, old routes, admin login, document link protection | Verified on production. |
| Inquiry, questionnaire, booking, emails, Zoom, TEST proposal after the migrations | **Not verified.** Owner's earlier tests ran before the migrations and were deleted. |
| Test records | Deleted: 2 inquiries, 1 booking (Nov 2 10:30 EST), 1 client from the morning tests. |
| Not touched | `payments` table (another app, still readable with the public key); August "Test" client and SOWs; ownership clause. |

## 1. Backup (before any migration)

In Supabase, open Database, then Backups.
- **Pro plan or higher:** confirm a daily backup from the last 24 hours is listed. If point in time recovery is on, note the current time; you can restore to just before step 3.
- **Free plan (no managed backups):** take one yourself. In Project Settings, then Database, copy the connection string, then run:
  `pg_dump "<connection string>" --no-owner --format=custom --file=alantevelez-2026-10-29.dump`
  Keep the file somewhere safe.

Don't continue until one of these is confirmed.

## 2. Read only precheck

In the SQL editor, run and save the output of:
1. `supabase/audit/20261029_release_precheck.sql` (record counts, columns, types, booking conflicts, status values)
2. `supabase/audit/20261029_access_audit.sql` (current access rules, kept as a record)

Stop and send me the output if any of these happen:
- section 4 returns rows (duplicate bookings);
- `bookings.status` is not `text`;
- section 7 shows a status check constraint.

## 3. Migrations 1 to 4

Run each file in the SQL editor, in this order. Each one only adds columns or indexes, keeps all existing rows, and is safe to run again.

1. `supabase/migrations/20261028_terms_version.sql`
2. `supabase/migrations/20261028_intake_flow.sql`
3. `supabase/migrations/20261029_document_brand_version.sql`
4. `supabase/migrations/20261029_booking_integrity.sql`

Then run the precheck again. Record counts must match step 2.

**If one fails:** stop and send me the error. Anything that already ran in that file only added a column or index, which the site tolerates, and every statement is safe to rerun once the cause is fixed. The site keeps working meanwhile.

## 4. Live checks (test records only)

Use your own address with a `+test` tag, for example `alante.v+launch@gmail.com`, and start every name and note with **TEST**.

- [ ] alantevelez.com: Home, Services & Pricing, Website Care, About load. Pricing guide downloads from Services & Pricing.
- [ ] /admin redirects to login. A wrong password is refused. The right password opens the dark admin.
- [ ] Old routes load: /intake, /book, /TBR2026, /dogwalking, /sitemap.xml, /robots.txt.
- [ ] Homepage short note as "TEST Launch". It says saved, offers "Complete My Project Details", and both emails arrive (yours and admin).
- [ ] Complete the questionnaire from the email link. It lands on the booking page.
- [ ] Book a call. Write down the time on the confirmation screen, then compare the same time in:
  - the admin booking card;
  - the confirmation email;
  - the admin email;
  - the Zoom meeting.
  All four should show the same time once converted to Eastern Time.
- [ ] Document access: open `/api/contracts/not-a-real-id`. Expect "Not found". Open an existing proposal link in a browser and confirm it shows no IP or signature data (check the network tab).
- [ ] Send yourself a **TEST** proposal from admin. Don't send a contract invoice to anyone real. No payment is collected anywhere in this flow.

Afterwards: in admin, cancel the TEST booking, delete the Zoom meeting, and mark the TEST lead lost (or delete the TEST rows in the table editor).

## 5. Lockdown (last)

1. Confirm the new admin is live: the dark admin with the "Admin" label.
2. Run `supabase/migrations/20261029_lock_down_private_tables.sql`.
3. Run the access audit again. Expect RLS on for all 16 tables, no policies on them, no anon grants, and `freelance-docs` not public.
4. Check access with the public key (from your site's page source or Project Settings, API):
   `curl "https://<project>.supabase.co/rest/v1/intake_submissions?select=id&limit=1" -H "apikey: <anon key>"`
   Expect a permission error, not rows. TBR2026 and the dog walking page must still work.
5. Check the admin dashboard, the questionnaire, and booking again.

## Recovery

| Problem | Recovery |
|---|---|
| New site has a problem **before** the lockdown | Vercel, Deployments: Instant Rollback to `04dac15`. |
| New site has a problem **after** the lockdown | Don't roll back to `04dac15`: its admin only works with the public key open. Fix forward, or roll back the public pages only by reverting the specific commit. The admin stays on the protected routes. |
| A migration fails | Stop and send me the error. Partial runs only add columns or indexes; rerun the file after the fix. |
| Data looks wrong after migrating | The migrations only add columns and indexes. Compare the precheck counts. If needed, restore the backup from step 1. |
| Lockdown breaks something | Send me what broke and fix forward (for example, a missing table in the admin allowlist). `supabase/rollback/20261029_lockdown_rollback.sql` reopens private client data to the public key; it is not a routine recovery step. Use it only as a deliberate, short emergency decision, then lock down again. |
