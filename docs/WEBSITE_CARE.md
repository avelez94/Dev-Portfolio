# Website Care management system

Status: built and tested locally on `feature/website-care`. **Not merged, not deployed to production, migration not applied anywhere except a local test database.** The feature is switched off unless `WEBSITE_CARE_ENABLED=true`, so the preview deployment runs with it off.

## What it does

1. You enroll a client's website in admin: client record, site URL, approved domains, plan, agreed pages, destinations (contact, booking, checkout), manual checklist, and report recipient.
2. You send the client a Stripe Checkout link that admin creates. Only a **verified Stripe webhook** for a **paid invoice** creates a service cycle: one per paid service period per website.
3. Nothing is scanned until you **confirm the setup** (website, client authorization, checklist). A paid period that arrives earlier waits.
4. A read only scan runs in GitHub Actions (Playwright). It records findings and screenshots and emails you a summary with a link to the draft.
5. You complete the manual checklist and write the report. Draft, then Ready for review, then Approved (with a frozen snapshot and PDF), then Sent.
6. Sending attaches the exact approved PDF through Resend. Reminders, overdue notices, and a private calendar feed keep the work visible.

```
Stripe ──webhook──▶ /api/care/stripe/webhook ──▶ care_cycles (1 per paid period)
                                                    │  (waits until setup confirmed)
Vercel cron (hourly) ─▶ /api/care/cron ─▶ queue scan, recover, remind, retry emails
                                                    │
GitHub Actions (dispatch + every 6h) ─▶ care-runner ─▶ /api/care/runner/* (token)
                                                    │
Admin /admin/care ─▶ /api/care/admin/* (admin cookie) ─▶ review, approve, send
```

## Files

| Area | Where |
|---|---|
| Migration (pending, separate from released ones) | `supabase/pending/website-care/20261030_website_care.sql` |
| Server logic | `src/lib/care/*` (config, sites, cycles, runs, findings, report, report-pdf, send, stripe, notify, emails, ics, schedule, cron, url-safety) |
| API | `src/app/api/care/admin/[...path]`, `runner/[...path]`, `stripe/webhook`, `calendar/[token]`, `cron` |
| Admin UI | `src/app/admin/care/*` (link in the admin sidebar shows only when the feature is on) |
| Public page | `src/app/(site)/care/page.tsx`, `src/content/offers.ts`, `src/app/(site)/care/subscribed` |
| Check runner | `care-runner/` and `.github/workflows/website-care-checks.yml` |

## Expected costs and limits

| Service | Cost | Notes |
|---|---|---|
| Stripe | No monthly fee. Card processing (US standard 2.9% + 30¢) plus Stripe Billing 0.7% of billing volume | About $2.42 on a $59 payment, $4.95 on $129, $8.95 on $249 |
| GitHub Actions | $0 | The repository is public, so hosted runner minutes are free. If it becomes private, GitHub Free includes 2,000 minutes a month; a check is about 2 to 4 minutes, idle polls exit in seconds |
| Vercel Pro | Included | One hourly cron (`/api/care/cron`); Pro allows it. Route timeout set to 60 seconds |
| Resend | Existing account | A few owner emails per client per month plus one report email |
| Supabase storage | Within current plan | Screenshots are about 50 to 150 KB each, up to 12 per check: roughly 1 MB per site per month |
| Calendar | $0 | Private iCalendar feed; no paid provider |

Scan limits (per site, adjustable within caps): 15 pages (cap 25), 60 site links (cap 150), 2 pages at a time (cap 3), 30 second page timeout (cap 45), 10 minute run limit (cap 15). Screenshots are taken for the first 6 pages per screen size.

## Setup (in this order, test mode first)

### 1. Database (staging or a Supabase branch first, never straight to production)
Run `supabase/pending/website-care/20261030_website_care.sql` in the SQL editor. It only creates new `care_*` tables, four functions, and two private buckets (`care-evidence`, `care-reports`). It doesn't change any existing table. It's safe to run twice. Production and preview share one database today, so applying it there is a production change: do it only with the release, after a backup.

### 2. Stripe (test mode)
1. In test mode, create one product, "Website Care", with three monthly prices: $59, $129, $249. No trial.
2. Developers, Webhooks: add `https://<deployment>/api/care/stripe/webhook` with these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`.
3. Settings, Billing, Customer portal: choose what clients may do (update card, see invoices, cancel at period end). Those choices are business policy; see below.
4. Environment (Vercel, server only, never `NEXT_PUBLIC_`): `STRIPE_SECRET_KEY` (sk_test_…), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CARE_ESSENTIAL`, `STRIPE_PRICE_CARE_BUSINESS`, `STRIPE_PRICE_CARE_PREMIUM`.
5. A live key is refused unless `CARE_STRIPE_LIVE_APPROVED=true`, and live checkout also needs the billing policy approved in admin settings.

### 3. Check runner (GitHub Actions)
1. Generate a long random token (for example `openssl rand -base64 32`).
2. Vercel: `CARE_RUNNER_TOKEN=<token>`.
3. GitHub, Settings, Secrets and variables, Actions: `CARE_APP_URL` (the deployment URL) and `CARE_RUNNER_TOKEN` (same token).
4. Optional, for immediate pickup instead of within 6 hours: a fine grained token with Actions read and write on this repository, set as `CARE_GITHUB_DISPATCH_TOKEN`, plus `CARE_GITHUB_REPO=avelez94/dev-portfolio`.
5. Scheduled workflows only run from `main`, so nothing runs from this branch. The runner never logs client URLs or results, because Actions logs are public on a public repository.

### 4. Scheduler
`vercel.json` adds `/api/care/cron` hourly. It uses the existing `CRON_SECRET`. Vercel runs crons only on production deployments, so the preview never ticks.

### 5. Email
Uses the existing `RESEND_API_KEY`. Owner notices go to the address in admin settings (or `CARE_NOTIFY_EMAIL`, or the studio address). Client report emails are refused unless the recipient matches `CARE_EMAIL_ALLOWLIST` (for example `alante.v+*@gmail.com`) or `CARE_CLIENT_EMAIL_LIVE=true`. Keep the allowlist on in preview.

### 6. Calendar
Admin, Website Care, Settings, Calendar: "Create private feed link", then subscribe in Google Calendar (Other calendars, From URL) or Apple Calendar. No personal calendar is connected, and the discovery call booking calendar is never used. To place work blocks in free time, a calendar connection (Google Calendar API with OAuth) would be needed; it isn't built, and the system never claims time is free.

### 7. Switch on
`WEBSITE_CARE_ENABLED=true` and `CARE_APP_URL=https://alantevelez.com` (or the preview URL while testing in a separate environment).

## Business policy decisions still needing your approval

1. **Grace period** after a failed payment (days). Not set. Reviews only ever start for paid periods either way.
2. **When billing attention starts**: proposed after 1 failed payment.
3. **Refunds**: proposed "flag the review for you to decide". Nothing stops automatically.
4. **Disputes**: proposed "flag for you to decide".
5. **Immediate cancellation**: proposed "keep the open review and flag it".
6. **Cancel at period end**: always honors the paid period (built in, per your brief).
7. **Customer portal permissions** in Stripe (cancel, switch plans, proration on switching). Not configured by this system; proration is Stripe's setting.
8. **Trials and promotion codes**: none (checkout turns promotion codes off).
9. **Retention**: proposal below.
10. **Public "Starting a plan" note** (`careSubscribeNote.approved` in `src/content/offers.ts`) stays hidden until you approve.
11. **Ownership clause** from the earlier release is still pending and untouched.

Record approval in admin settings once the policy is written into your care agreement. Changing a policy value clears the approval.

## Retention (proposal)
Reports, approvals, sent versions, send records, findings, and activity are never deleted automatically. Suggested later step: delete screenshots older than 13 months from `care-evidence` when they aren't used by an approved report's snapshot. This isn't automated; it would be a reviewed manual SQL step.

## Security summary
- Every admin endpoint requires the admin cookie; the runner endpoints require the runner token; the webhook verifies Stripe's signature on the raw body (wrong secret, old timestamp, or missing signature is refused).
- All care tables have RLS on with no policies and no public grants. The functions can only be executed by the server role. Buckets are private. Screenshots and PDFs are served only through admin endpoints.
- Destinations: public http and https on ports 80 and 443 only. Private, loopback, link local (cloud metadata), carrier grade NAT, multicast, and reserved ranges are refused at enrollment (including after DNS) and again at scan time. The browser runs behind a local guard proxy that resolves every host itself and connects only to the checked address, which covers redirects, images, scripts, and other subrequests, and defeats DNS rebinding. Link checks use the same rule with pinned addresses.
- The browser aborts every request that isn't GET, HEAD, or OPTIONS, closes WebSockets, blocks service workers and downloads, and dismisses dialogs. It never types, clicks, or signs in. Links that look like logout, cart, checkout, delete, account, or admin are skipped.
- Runner results are validated: unknown checks and statuses are dropped, evidence is limited to known fields, and screenshot paths must be in the run's own folder.
- No card data is stored. Webhook events keep only id, type, time, and object id.

## Verification

**Verified locally** (197 automated checks on real Postgres 16 + PostgREST, a stateful fake Stripe API, fake Resend, fixture websites, the production build, and the real runner with Chromium; plus axe with 0 WCAG A/AA violations on 7 admin views at desktop and phone width, no horizontal overflow, and the existing regression suites):
- Activation only after a verified paid invoice. Bad, old, or missing signatures are refused. The success page and checkout completion alone create nothing.
- Duplicate, replayed, delayed, and out of order webhooks: one cycle per paid period, event ids stored once, and a stale "active" event can't revive a canceled subscription.
- Failed payment (attention, no cycle), late payment (cycle created, attention cleared), plan change (no new cycle), unrelated invoice (ignored), cancel at period end (paid period kept), immediate cancel, refund, and dispute (flagged).
- Correct client association: subscription metadata naming a site with a different client is ignored, and a second subscription can't take over a linked site.
- Incomplete enrollment: paid cycle waits; confirmation releases it; setup changes require confirming again.
- Jobs: one active run per cycle, two runners never share a run, stalled runs requeue with backoff then fail after 3 attempts, late results from a timed out runner are refused, missed scans are recovered by cron, and queued runs can be canceled. A failed scan blocks approval and never completes a review.
- Findings on fixture sites: 404, redirect loop, redirect outside the approved domains, server error, robot check page (could not check), timeout (could not check), certificate error, missing image, mobile overflow with measured width, broken link with the page it was found on, and the booking page with the "doesn't confirm booking works" caveat.
- Read only and network safety, proven from the fixture server's request log: no POST, beacon, form submission, or WebSocket; logout and cart links never requested; private address, metadata address, and rebinding host never reached.
- Report: readiness rules, not checked needs a reason, stale preview refused, explicit sign off, edits invalidate approval (private notes don't), and the sent version is preserved.
- PDF contains the four sections, could not check, disclaimers, and no private notes or health score. The downloaded and emailed attachment hashes equal the approved file.
- Sending: typed recipient required, provider failure keeps the approval and retry works without rescanning, duplicate send refused, provider acceptance labeled as not confirmed delivery, and a non allowlisted recipient refused.
- Calendar: all day items only, no attendees or organizer, correct date across the November DST change, the same UID with a higher SEQUENCE when a deadline moves, completed items marked Done, and a new link disables the old one.
- Reminders: one per interval, capped, failed reminder kept and retried, and the review is never erased.
- No Stripe calls besides customers, checkout, and portal sessions; no bookings created; emails only to the owner and allowlisted test addresses.
- Feature off: every care endpoint returns 404, the cron skips, the admin link is hidden, and the subscribed page returns 404.

**Needs a manual check on a real deployment:**
- Stripe test mode end to end with real test keys: checkout page, test card 4242, webhook delivery, portal, failure card 4000 0000 0000 0341, refund and dispute from the dashboard.
- GitHub Actions run against a test deployment (Playwright install and run on ubuntu-latest).
- Resend delivery of the report email and PDF to your own `+care` address.
- Subscribing to the calendar feed in Google and Apple Calendar.

**Deferred (not built):**
- Personal calendar integration (Google OAuth) for real work blocks with free/busy checks.
- Resend delivery webhooks (confirmed delivery). Today the system records provider acceptance only.
- Automated screenshot cleanup.
- Client dashboard access (intentionally not offered).

**Blocked from this environment:**
- Preview deployment testing: this workspace can't reach vercel.app or Supabase, and the preview shares the production database with the migration unapplied, so the preview runs with the feature off.
- Real Stripe test mode (no test keys here, and api.stripe.com isn't reachable).

## Walkthrough: your first client

1. **Before:** set the environment variables above in a test setup, apply the migration there, and turn the feature on.
2. **Settings:** Admin, Care, Settings. Check the time zone, working days and hours, review deadline (default 7 days after payment), and reminders. Create the calendar feed link and subscribe.
3. **Enroll:** Websites, then Enroll a website. Pick the client record, plan, site URL, approved domains, pages, destinations, and checklist (use the template buttons). Set the recipient name and email. Save. It's a draft; nothing runs.
4. **Confirm:** open the website, read the setup, tick the three boxes, describe how the client authorized it (for example "signed care agreement, Nov 3"), and confirm.
5. **Billing:** Create Stripe checkout link, then send it to the client yourself. When Stripe reports the paid invoice, a review appears in the queue with its due date. (Billed by invoice instead? Use "Add a paid service period by hand".)
6. **Check:** the scan starts automatically. You get an email with results and a link. Open the review: look at the findings, screenshots, and anything that couldn't be checked. Add private notes and hide a finding from the client only if it truly doesn't apply.
7. **Manual review:** record each checklist item. Use Not checked with a reason when needed.
8. **Write:** summary, what you looked into, what you fixed (only confirmed fixes), still open items, and anything needing approval with an estimate.
9. **Approve:** Mark ready for review, open the client report and PDF preview, tick sign off, type your name, and approve.
10. **Send:** check the name and exact email, adjust the subject and message, type the address to confirm, then Send Report. Or download the PDF without sending. The review counts as complete only once sent.
