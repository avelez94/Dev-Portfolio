# Website Care management system

Status: built and tested locally on `feature/website-care`. **Not merged, not deployed to production, migration not applied anywhere except a local test database.** The feature is switched off unless `WEBSITE_CARE_ENABLED=true`, so the preview deployment runs with it off.

## What it does

1. You enroll a client's website in admin: client record, site URL, approved domains, plan, agreed pages, destinations (contact, booking, checkout), manual checklist, and report recipient.
2. You send the client a Stripe Checkout link that admin creates. Only a **verified Stripe webhook** for a **paid invoice** creates a service cycle: one per paid service period per website.
3. Nothing is scanned until you **confirm the setup** (website, client authorization, checklist). A paid period that arrives earlier waits.
4. A read only scan runs in GitHub Actions (Playwright). It records findings and screenshots and emails you a summary with a link to the draft.
5. You complete the manual checklist and write the report. Draft, then Ready for review, then Approved (with a frozen snapshot and PDF), then Sent.
6. Sending puts the complete approved report in the email body and attaches the exact approved PDF through Resend. Each review also appears in your existing admin **Schedule** calendar, with reminders and overdue notices by email.

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
| API | `src/app/api/care/admin/[...path]`, `runner/[...path]`, `stripe/webhook`, `resend/webhook`, `cron` |
| Admin UI | `src/app/admin/care/*` (link in the admin sidebar shows only when the feature is on); care items in the existing Schedule calendar in `src/app/admin/page.tsx` |
| Client report | `src/lib/care/report-model.ts` (content rules), `report-pdf.ts` (PDF), `src/components/care/ReportView.tsx` (web view), `issue-catalog.ts` (client wording) |
| Public samples | `src/content/care-samples.ts`, `src/components/site/CareSample.tsx`, `/care/sample-report/[slug].pdf` |
| Public page | `src/app/(site)/care/page.tsx`, `src/content/offers.ts`, `src/app/(site)/care/subscribed` |
| Check runner | `care-runner/` and `.github/workflows/website-care-checks.yml` |

## Costs, allowances, and limits (no new paid services)

What I could verify from here, and what you need to check in each account. Nothing here requires an upgrade or a paid add on.

| Service | Verified | Usage this feature adds | Guard rails |
|---|---|---|---|
| GitHub Actions | The repository is **public** (checked through the GitHub API). GitHub's docs: Actions usage is free for standard GitHub hosted runners in public repositories. The workflow uploads **no artifacts** (artifact count is 0). | One job per queued check, plus a 6 hourly idle poll that exits in seconds without installing a browser. | 30 minute job timeout, at most 3 checks per job, 6 minute run limit per check (cap 8), one workflow at a time, 3 attempts per check. I couldn't read your account billing settings from here: set the Actions spending limit to $0 in GitHub Billing so nothing can ever be charged. If the repository becomes private, GitHub Free includes 2,000 minutes a month; this uses roughly 3 to 5 minutes per site per month. |
| Vercel Pro | Pro gives a monthly usage credit and bills on demand **after** the credit is used (Vercel docs). Cron jobs run as normal functions. | One cron every 3 hours (240 short runs a month), webhooks, about 50 small runner calls per check, and your admin use. This is far below the credit for a single site business, but I can't see your current usage. | Every route has a 60 second limit. Turn on Spend Management with a hard pause at a level you choose, so on demand charges can't happen. |
| Resend | Free plan: 3,000 emails a month, 100 a day (Resend). I couldn't see which plan you're on. | 2 to 5 owner notices and 1 report email per site per month. | Notices are deduplicated and capped (4 attempts, overdue reminders capped). Delivery webhooks are optional; without them delivery shows "not confirmed". |
| Supabase storage | Free plan quotas: 1 GB storage, 5 GB egress (Supabase docs). The docs don't state what happens above Free quotas. | Up to 6 screenshots per check (about 0.5 MB per site per month) and about 30 KB per approved PDF. | Screenshots are deleted after 90 days (adjustable, 30 to 730) by the scheduled job, at most 200 per run. Reports, approved PDFs, results, and send records are always kept. |
| Stripe | No monthly fee. Card processing plus Stripe Billing 0.7% per charge (Stripe). | Only on real client payments, after you approve live billing. | Test mode only; a live key is refused unless `CARE_STRIPE_LIVE_APPROVED=true` and the billing policy is approved. |

**If a limit is ever reached:** checks wait in the queue (nothing is lost) and you can run the runner by hand: `cd care-runner && npm install && npx playwright install chromium && CARE_APP_URL=… CARE_RUNNER_TOKEN=… node run.mjs` on your Mac, or review the site by hand and record it in the manual checklist. Owner emails that fail stay queued and are retried later, and the review stays open in the dashboard and calendar either way.

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

### 6. Calendar (your existing admin calendar)
No setup. Each monthly review appears in admin, Schedule: a small diamond on its due date in the 14 day calendar, a "Monthly care reviews" list under it (client, website, due date, status, link to the review and draft), and the review in the day panel when you click that date. One item per review cycle, so duplicate payment webhooks, reruns, and job retries can't add more; moving the deadline or progressing the work updates the same item. Care items never touch availability, blocked times, bookings, or Zoom, and nobody is invited. There is no external calendar feed.

**Which state completes the calendar item:** the review is complete when the email provider (Resend) **accepts** the report. The item then shows "Sent, delivery not confirmed". It shows "Sent and delivered" only when Resend sends a signed delivery event, and "Sent, delivery failed" on a bounce or complaint. Approval alone never completes it.

Optional: in Resend, Webhooks, add `https://<deployment>/api/care/resend/webhook` for `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, and set `RESEND_WEBHOOK_SECRET` in Vercel. Check that your Resend plan includes webhooks; if not, leave it off and delivery stays "not confirmed".

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

## Retention
Reports, approvals, sent versions, send records, findings, and activity are never deleted. Screenshots are deleted after the retention period in settings (default 90 days); the finding keeps its text and notes that its screenshot expired. Approved PDFs don't contain screenshots, so this never changes a report.

## Security summary
- Every admin endpoint requires the admin cookie; the runner endpoints require the runner token; the webhook verifies Stripe's signature on the raw body (wrong secret, old timestamp, or missing signature is refused).
- All care tables have RLS on with no policies and no public grants. The functions can only be executed by the server role. Buckets are private. Screenshots and PDFs are served only through admin endpoints.
- Destinations: public http and https on ports 80 and 443 only. Private, loopback, link local (cloud metadata), carrier grade NAT, multicast, and reserved ranges are refused at enrollment (including after DNS) and again at scan time. The browser runs behind a local guard proxy that resolves every host itself and connects only to the checked address, which covers redirects, images, scripts, and other subrequests, and defeats DNS rebinding. Link checks use the same rule with pinned addresses.
- The browser aborts every request that isn't GET, HEAD, or OPTIONS, closes WebSockets, blocks service workers and downloads, and dismisses dialogs. It never types, clicks, or signs in. Links that look like logout, cart, checkout, delete, account, or admin are skipped.
- Runner results are validated: unknown checks and statuses are dropped, evidence is limited to known fields, and screenshot paths must be in the run's own folder.
- No card data is stored. Webhook events keep only id, type, time, and object id.

## The client report

A short report built from one frozen snapshot. The preview, the PDF, and the email body all come from the same approved version:
- **Top:** client, website, review date, and a short scope ("4 pages, 1 booking page, 3 hand checks").
- **Your plan** (right under the top, never in small print): plan name, the client's **agreed** monthly price, the service period, and the included update or troubleshooting time. Where time is included, it shows the time recorded for this period and what's left, or **"Time usage not recorded"** if you haven't recorded it (it never assumes the full allowance is left). It says monthly checks and preparing the report don't use that time and unused time doesn't roll over. Essential Care says updates and fixes are quoted separately.
- An accurate headline and three counts with icon and text: **Passed** (agreed checks), **Issues found**, **Not verified**.
- **Needs attention** (full width): one entry per kind of problem, with all affected pages and devices listed once. Each says what's wrong, why it matters, and what happens next (I'm looking into it, needs your input, needs your approval, or fixed and verified).
- **Fixed and verified** only when you mark it fixed **and** either a recheck no longer finds it or you record how you verified it.
- **This month's checks**: two columns on desktop with thin row dividers and a thin divider between the columns, one column on phones. Every row has the icon, the label, and the status in the same positions. A check is "Passed" only with an automated pass or your recorded manual pass. A booking, checkout, or contact page row says the page opens but the booking, payment, or message itself wasn't tested. Not applicable items are listed separately.
- **Not verified this month** with reasons. A site blocking the automated checker is listed here, never as an issue, and the wording never claims visitors are fine or affected; your note on the item explains what you found by hand.
- A short "What I did" and a **Next step** box ("No action needed", "Please send…", "Approval needed for…").
- **Estimates:** a report that asks for payment needs the price in the Estimate field, the work it covers, **why it's outside the included care scope**, and (on plans with included time) **whether the remaining included time applies**. Readiness refuses the report until all of these are filled in, and also refuses a price typed anywhere else. Nothing is deducted automatically; you decide case by case and say so in the report.
- The headline is computed, and readiness refuses a summary that reads as all clear while issues or unverified items remain. Every red issue needs a decision before the report can be marked ready.
- Technical detail (error codes per result, redirect chains, screenshots, every individual result), private notes, and logs stay in admin. They're never part of the snapshot, so they can't reach the PDF or the email.

### Plan price and recorded time
- **Agreed monthly price**: set it on the website (Website settings). Each new review period copies it, so a later price change doesn't rewrite an old report. You can also set it on a single review under **Plan and time**. A report can't be marked ready without it.
- **Time used**: record update and troubleshooting minutes on the review under **Plan and time**. Changing the price or time after approval returns the report to draft.

### The client email
The email has your message, then the complete report (plan and time, counts, issues and next actions, the checklist, unverified items, work completed, approval requests and estimate explanations), then a note that the PDF is attached for their records. It uses tables with inline styles; the two column parts stack on phones (Gmail, Apple Mail, and other clients that honor the media query; others keep two columns). The plain text version carries the same content. Review, approval, and sending stay separate steps.

Public samples: two fictional reports (no outstanding issues; an issue plus unverified items) on example.com addresses are on the public Website Care page with PDF downloads. Every PDF page says "Sample report • Illustrative findings". They are static content built with the real report template and never read the database. They appear publicly only when this branch is merged.

## Verification

**Refinements verified locally (Oct 29, second pass):** typecheck and lint clean; production build; 11 report logic checks (Essential Care quoted separately, "Time usage not recorded", recorded and over allowance time, missing agreed price blocks readiness, estimate explanations required, prices outside the Estimate field refused, crawler blocking stays "Not verified" with no visitor claim, private notes never in the snapshot or email, email escaping, no dashes in client text); the pending migration applied twice on a fresh local Postgres 16 with the new price and time limits enforced; the public Care page, both samples, and both emails at desktop and phone width with no horizontal overflow; both sample PDFs (the no issues sample is one page; the issue sample runs to two, with the Next step box kept whole). The admin screens weren't driven in a browser this pass because they need the care tables, and the only database here is the shared one.

**Verified locally earlier** (242 automated Website Care checks on real Postgres 16 + PostgREST, a stateful fake Stripe API, fake Resend with signed delivery events, fixture websites, the production build, and the real runner with Chromium; axe found 0 WCAG A/AA violations on the review screen, sent review, and public Care page at desktop and phone width; no horizontal overflow; the earlier regression suites pass 385 of 385: flow 133, site 78, admin 60, documents 26, targeting 30, real database 39, document links 19):
- Everything from the first build (activation only after a verified paid invoice, duplicate and out of order webhooks, one cycle per paid period, failed payments and cancellations, client association, incomplete enrollment, job retries and recovery, read only and private network safety, approval invalidation, exact attachment, send failure recovery, nothing unintended).
- Admin calendar: one item per cycle with client, website, deadline, status, and link; the deadline change updates the same item; reruns add nothing; delivery states shown only from signed events; availability, blocked times, bookings, and meetings unchanged; admin only.
- Report: grouping (one issue per type across pages and devices), every red issue needs a decision, fixed needs verification, fixed and verified after a clean recheck, all clear summaries refused while issues remain, not applicable items listed separately, booking caveat, counts match the lists, one page for a typical month, sent version unchanged.
- Delivery: bad signature and stale timestamps refused, duplicates ignored, a late "delayed" can't undo "delivered".
- Retention: old screenshots deleted from storage and marked expired; approved reports untouched.
- Public samples: both PDFs download, every page labeled, example.com data only, no private endpoints or client data on the page; the sample route works without the feature switch.
- The regression database failure from last time was the test database's state (already locked down). I recreated it in the state the test expects (all release migrations except the lockdown, which the test applies itself) with `realdb-setup/reset_race_test.sh`; it now passes 39 of 39 without changing the test.

**Needs a manual check on a real deployment:** Stripe test mode with real test keys; a GitHub Actions run against a test deployment; Resend delivery to your `+care` address and, if your plan includes webhooks, a delivery event; your GitHub, Vercel, and Resend billing settings (spending limits), which I couldn't read from here.

**Deferred:** placing work blocks in free time (needs a personal calendar connection); automatic client dashboard (not offered).

**Blocked from this environment:** opening the preview (vercel.app isn't reachable from here, and the preview runs with the feature off against the shared database), real Stripe test mode, and account billing pages.

## Walkthrough: your first client

1. **Before:** set the environment variables above in a test setup, apply the migration there, and turn the feature on.
2. **Settings:** Admin, Care, Settings. Check the time zone, working days and hours, review deadline (default 7 days after payment), reminders, and screenshot retention.
3. **Enroll:** Websites, then Enroll a website. Pick the client record, plan, site URL, approved domains, pages, destinations, and checklist (use the template buttons). Set the recipient name and email. Save. It's a draft; nothing runs.
4. **Confirm:** open the website, read the setup, tick the three boxes, describe how the client authorized it (for example "signed care agreement, Nov 3"), and confirm.
5. **Billing:** Create Stripe checkout link, then send it to the client yourself. When Stripe reports the paid invoice, a review appears in the queue with its due date. (Billed by invoice instead? Use "Add a paid service period by hand".)
6. **Check:** the scan starts automatically and the review appears in your Schedule calendar. You get an email with grouped results and a link. Open the review: each issue is one card with its pages; choose what happens next for every red issue, and open individual results or screenshots only when you need them.
7. **Manual review:** record each checklist item. Use Not checked with a reason when needed.
8. **Plan and time, then write:** check the agreed price and record the minutes you spent on updates or fixes. Then write a short summary, what you fixed (only confirmed fixes), and anything needing approval with an estimate, why it's outside the plan, and whether the remaining time applies. If you fix something, run the check again or record how you verified it, and it shows as Fixed and verified.
9. **Approve:** Mark ready for review, open the client report and PDF preview, tick sign off, type your name, and approve.
10. **Send:** check the name and exact email, adjust the subject and message, type the address to confirm, then Send Report. Or download the PDF without sending. The review counts as complete only once sent.
