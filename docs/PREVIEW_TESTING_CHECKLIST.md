# Preview testing checklist (review/warm-redesign)

Use real services on the **preview** deployment only. Use your own test inboxes, never a client's address. Nothing here touches production.

## Status (October 29)

"Local" means my workspace: a real PostgreSQL 16 database with PostgREST 12 (the database layer Supabase runs) and local stand ins for Resend and Zoom. It proves the code and migrations behave correctly. It does **not** prove anything about your preview project, its data, its settings, or the real email and Zoom accounts. "Preview" means the Vercel preview deployment with its real Supabase project, Resend, and Zoom, which I can't reach from my workspace.

| Check | Local result | Preview result | Next action |
|---|---|---|---|
| 0. Preview uses its own database | n/a | **Blocked** | You: in Vercel, compare `NEXT_PUBLIC_SUPABASE_URL` for Preview and Production. |
| 1. Preview configuration | n/a | **Blocked** | You: section 1, after 0. |
| 2. Migrations | **Passed**: all five applied cleanly, each run twice | **Blocked** | You: audit, then section 2 on the preview database only. |
| 3. Access lockdown | **Passed**: before, the public key read leads; after, 12 private tables refused it, trades and walks still readable, site and admin working | **Blocked** | You: rerun the audit and the curl checks in section 3. |
| Booking concurrency (database enforced) | **Passed**: duplicates rejected by the database itself; 5 rounds of 8 simultaneous requests, one booking and one Zoom meeting each; failures leave no row and no meeting | **Blocked** | You: `scripts/booking-race-check.mjs` against the preview, then clean up. |
| Client document links | **Passed**: API responses and pages carry only client fields | **Blocked** | You: open one proposal and contract link, and view the response in the browser's network tab. |
| Admin client context | **Passed**: proposals, emails, invoices, and meetings each reach only the person on screen (30 checks, desktop and phone) | **Blocked** | You: section 8, using your own addresses as clients. |
| Admin redesign | **Passed**: 60 workflow checks; accessibility scan clean | **Blocked** | You: section 8 on your phone and laptop. |
| 4 to 7. Inquiry, questionnaire, booking, documents with real services | **Passed** against the stand ins | **Blocked** | You: sections 4 to 7. |
| Email rendering in Gmail and Outlook, real Zoom meeting | not testable locally | **Blocked** | You: sections 4, 6, 7. |

## 0. Before you start: which database does preview use?

- [ ] In Vercel, open Project Settings, Environment Variables, and compare `NEXT_PUBLIC_SUPABASE_URL` for **Preview** and **Production**.
  - Different projects: run every migration below on the preview database.
  - Same project: **stop**. Every test below would write to production data. Create a separate Supabase project for preview (or a Supabase branch) and point the Preview variables at it first.

## 1. Configuration (Vercel, Preview environment)

- [ ] `NEXT_PUBLIC_SITE_URL` set to the preview URL, so email links point at preview and not alantevelez.com.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for the preview database.
- [ ] `RESEND_API_KEY` (test sends go to your own addresses).
- [ ] `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`.
- [ ] `ADMIN_PASSWORD`, `ADMIN_SECRET_TOKEN` (a long random value), `CRON_SECRET`.
- [ ] Not set: `ZOOM_OAUTH_BASE`, `ZOOM_API_BASE`, `RESEND_BASE_URL` (test only overrides).
- [ ] Remove `NEXT_PUBLIC_DOC_BRAND_SINCE` if you added it. It's no longer used.
- [ ] Redeploy the preview after changing variables.

## 2. Migrations (preview database, in this order)

Run `supabase/audit/20261029_access_audit.sql` first and save the output. It's read only.

1. [ ] `supabase/migrations/20261028_terms_version.sql`
2. [ ] `supabase/migrations/20261028_intake_flow.sql`
3. [ ] `supabase/migrations/20261029_document_brand_version.sql`
4. [ ] `supabase/migrations/20261029_booking_integrity.sql`. Run its two duplicate checks first, and check the `status` column type (instructions in the file).
5. [ ] Deploy this branch's code, **then** run `supabase/migrations/20261029_lock_down_private_tables.sql`.
6. [ ] Run the audit again. Expect RLS on for all 16 tables, no policies, no grants to `anon`/`authenticated`, and `freelance-docs` with `public = false`.

## 3. Access checks after the lockdown

Use the preview's anon key (visible in the browser bundle, so it's public anyway):

```
curl "$SUPABASE_URL/rest/v1/intake_submissions?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

- [ ] Each of `intake_submissions`, `clients`, `bookings`, `invoices`, `documents`, `contracts`, `proposals`, `sows`, `projects`, `meetings` returns `[]` or a permission error, never rows.
- [ ] `curl -I "$PREVIEW/api/admin/data/rest/v1/clients?select=*"` without the cookie returns 401.
- [ ] Logged in, the admin dashboard still shows leads, clients, invoices, documents. Upload, download and delete a document.
- [ ] The dog walking page and TBR2026 still work (their tables are deliberately untouched).

## 4. Short inquiry

- [ ] Homepage form, your own email. Success says the note is saved, you'll reply by email, and the only button is "Complete My Project Details". No booking link.
- [ ] Client email "Got your note…" arrives, has the questionnaire button, no booking link. Check it on a phone and in Gmail and Outlook.
- [ ] Admin email "New note from…" arrives with reply-to set to the visitor.
- [ ] The address bar never shows a name, email, or the private link.

## 5. Detailed questionnaire

- [ ] From the email button: answers are filled in, the original note is shown separately, and editing works.
- [ ] Refresh partway: the prefill comes back. (Answers typed since the last step are not stored in the browser, by design.)
- [ ] Submit: you're taken to the booking page. Admin email says "Project details completed by…". Admin shows one lead with "Short note" and "Details completed" checked.
- [ ] Open the original email link again: it says the link was already used and points to the "Project details received" email.
- [ ] Direct visit to /intake with a different email: a new separate lead.
- [ ] Questionnaire with the **same** email but no link: a separate lead. The earlier note is unchanged. The admin email says "Not verified".
- [ ] Care or support interest: three steps, with the platform question instead of content questions.

## 6. Booking

Before clicking through, run the automated race check against the preview (it refuses the production domain). It creates five test leads using `+race` versions of your address:

```
node scripts/booking-race-check.mjs https://<preview-url> you@yourdomain.com
```

Expect `PASS: exactly one booking`. Then cancel that booking, delete the test leads, and delete the Zoom meeting.

- [ ] The booking page confirms the details were received, explains the call, and shows times in your time zone. Check one date before and one after a daylight saving change.
- [ ] Book a time. Confirmation screen shows the Zoom join link (not the host link).
- [ ] Client email "Your discovery call is confirmed…" and admin email "Discovery call booked with…" arrive. The admin email has the host link.
- [ ] Zoom: the meeting exists for 20 minutes with the right topic. Your Zoom invite branding is controlled in Zoom, not here.
- [ ] Two browsers, two different leads, same time, click Confirm together: one books, the other is told the time was taken. Zoom has one meeting.
- [ ] Questionnaire: move back and forth between steps (answers stay), and trigger an error (answers stay). The page says refreshing clears anything not yet submitted.
- [ ] Revisit the booking link after booking: "already booked".
- [ ] /book with no reference: points to the questionnaire.
- [ ] An existing booking link from before this change still opens and books.
- [ ] Reminder: run the cron (`/api/cron/reminders` with `CRON_SECRET`) for a call 24 to 48 hours out. The reminder email arrives once.

## 7. Documents

- [ ] Send a proposal to yourself. Email, page (new styling), accept, then the accepted copy email.
- [ ] Send a contract to yourself. Compare the page clauses with the admin "Download" PDF: same 12 clauses, terms version, and payment schedule.
- [ ] Sign it. The signed copy PDF has the same clauses, signature, date and IP. Deposit invoice email arrives.
- [ ] Re-send a signed contract issued **before** this change. The PDF keeps its original layout and wording.
- [ ] An existing proposal or contract page from before this change keeps its original look.
- [ ] A new invoice downloads in the new layout. An invoice created before migration 3 downloads in the original layout.
- [ ] Stripe and PayPal receipts are styled in those services' dashboards, not here.

## 8. Admin portal

- [ ] Sign in on a phone and a laptop. Wrong password, then right password.
- [ ] Leave the dashboard open past the session, or clear the cookie, then click anything. The "session has ended" prompt appears.
- [ ] Open a lead, a booking, a client. Create an invoice, schedule a meeting, email yourself, block a day, download each PDF.
- [ ] Select one test client in Pipeline, then build a proposal in Docs for a different test address. The side panel shows only the proposal's recipient, and the proposal email arrives only at that address.
- [ ] With an invoice form half filled for one client, click another client. The form closes; nothing is created for the second client.
- [ ] Debt tracker loads and saves a payment.

## 9. Mobile, keyboard, motion

- [ ] Questionnaire and booking on a real phone, with no sideways scrolling.
- [ ] Keyboard only: complete the questionnaire and book.
- [ ] With reduced motion turned on in the OS, nothing animates.
