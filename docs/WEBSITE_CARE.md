# Website Care management system

Status: built and tested locally on `feature/website-care`. **Not merged, not deployed to production, migration not applied anywhere except a local test database.** The feature is switched off unless `WEBSITE_CARE_ENABLED=true`, so the preview deployment runs with it off.

## What it does

1. You enroll a client's website in admin: client record, site URL, approved domains, plan, agreed price, pages, destinations (contact, booking, checkout), manual checklist, and report recipient. **Suggested scope** fills in the home page and the manual checks the scope needs; everything stays editable. Required checks (desktop and phone always; booking, contact form, payments, or updates when the scope includes them) can be reworded but not removed.
2. You **confirm the technical scope** (website, client authorization, checklist; the address must resolve to a public site). The agreement can't be sent before this, or with a Stripe price that differs from the agreed amount.
3. The client gets a **persistent private agreement link** (`/care/agreement/<token>`, the same link every time). It shows the parties, plan, price, the agreed website and checks, and the full care terms, including billing, cancellation and refunds. You can **turn the link off or replace it** (Care agreement, Turn off or replace this link): a revoked link is refused by the server for viewing, signing and checkout (410, no agreement details), any open checkout started from it is expired in Stripe, and a replacement link keeps the signed agreements, PDFs and audit history, so nothing is signed again because the link changed. Link records live in `care_agreement_links` (one active link per website); the activity log records `agreement_link_revoked`, `agreement_link_replaced` and `agreement_link_sent`.
4. The client **signs**: typed name, drawn signature, and an explicit agreement, on the exact version they were shown. The **signed PDF** is stored privately (`care-agreements` bucket) and emailed to the client and you.
5. **Payment unlocks** on the same page: Continue to payment opens a Stripe Checkout for the verified price, made on demand (no 24 hour invitation to expire). A change to the scope, plan or price closes any open link and needs a new signed version.
6. A **verified Stripe webhook** for a **paid invoice** creates the paid review (one per paid period, with its included plan time) and **immediately queues and dispatches** the scan (GitHub workflow dispatch, recorded on the run, retried within limits). A read only scan runs in GitHub Actions (Playwright) and emails you when results are ready.
7. You complete the manual checklist and write the report. Draft, then Ready for review, then Approved (with a frozen snapshot and PDF), then Sent.
8. Sending puts the complete approved report in the email body and attaches the exact approved PDF through Resend. Each review also appears in your existing admin **Schedule** calendar, with reminders and overdue notices by email.

```
Owner confirms scope ─▶ agreement link ─▶ client signs ─▶ signed PDF stored and emailed ─▶ payment unlocks
Stripe ──webhook──▶ /api/care/stripe/webhook ──▶ care_cycles (1 per paid period)
                                     │              │ held + owner email if the scope isn't confirmed
                                     └─▶ queue scan ─▶ GitHub workflow dispatch (recorded, retried)
Vercel cron (every 3h) ─▶ /api/care/cron ─▶ recovery only: missed scans, failed dispatches,
                                             stalled runs, reminders, email retries
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
| Admin UI | `src/app/admin/(dashboard)/care/*` (link in the admin sidebar shows only when the feature is on); care items in the Schedule calendar in `src/app/admin/(dashboard)/schedule/_parts/ScheduleView.tsx` |
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
Run `supabase/pending/website-care/20261030_website_care.sql`, then `20261031_care_work_ledger.sql`, then `20261103_care_report_suggestions.sql`, then `20261104_care_checkout_invitations.sql`, then `20261105_care_agreements_and_dispatch.sql`, then `20261106_care_agreement_links.sql` (agreement link records, and each agreement's client id for the client's Documents), in the SQL editor. They only create new `care_*` tables, functions, and three private buckets (`care-evidence`, `care-reports`, `care-agreements`), and seed the proposed task catalog. They don't change any existing table; the one function that writes outside `care_*` (`care_invoice_estimate`) inserts a pending row into `invoices` only when you ask it to. Both are safe to run twice. Production and preview share one database today, so applying it there is a production change: do it only with the release, after a backup.

### 2. Stripe (test mode)
1. In test mode, create one product, "Website Care", with three monthly prices: $59, $129, $249. No trial.
2. Developers, Webhooks: add `https://<deployment>/api/care/stripe/webhook` with these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`.
3. Customer portal: the app creates its own portal configuration on first use (cancel at the end of the period, no proration, card updates and invoice history, no plan switching) and stores its id in settings; set `STRIPE_CARE_PORTAL_CONFIGURATION` to use one you made. If you enable Stripe's no code customer portal login link, set the **default** portal configuration the same way, because that link uses the default.
4. Environment (Vercel, server only, never `NEXT_PUBLIC_`): `STRIPE_SECRET_KEY` (sk_test_…), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CARE_ESSENTIAL`, `STRIPE_PRICE_CARE_BUSINESS`, `STRIPE_PRICE_CARE_PREMIUM`.
5. A live key is refused unless `CARE_STRIPE_LIVE_APPROVED=true`, and live checkout also needs the billing policy approved in admin settings.

### 3. Check runner (GitHub Actions)
1. Generate a long random token (for example `openssl rand -base64 32`).
2. Vercel: `CARE_RUNNER_TOKEN=<token>`.
3. GitHub, Settings, Secrets and variables, Actions: `CARE_APP_URL` (the deployment URL) and `CARE_RUNNER_TOKEN` (same token).
4. **Required for the automatic start after payment:** a fine grained token with Actions read and write on this repository, set as `CARE_GITHUB_DISPATCH_TOKEN`, plus `CARE_GITHUB_REPO=avelez94/dev-portfolio`. Without it every paid scan's start fails, is retried 5 times (1, 5, 15 and 60 minutes apart, through the cron), then you're emailed once; the workflow's 6 hour schedule can still pick it up, and Retry start on the review tries again.
5. Scheduled workflows only run from `main`, so nothing runs from this branch. The runner never logs client URLs or results, because Actions logs are public on a public repository.

### 4. Scheduler
`vercel.json` adds `/api/care/cron` every 3 hours. It is a recovery mechanism (missed scans, failed or unclaimed dispatches), not the normal path. It uses the existing `CRON_SECRET`. Vercel runs crons only on production deployments, so the preview never ticks.

### 5. Email
Uses the existing `RESEND_API_KEY`. Owner notices go to the address in admin settings (or `CARE_NOTIFY_EMAIL`, or the studio address). Client report emails are refused unless the recipient matches `CARE_EMAIL_ALLOWLIST` (for example `alante.v+*@gmail.com`) or `CARE_CLIENT_EMAIL_LIVE=true`. Keep the allowlist on in preview.

### 6. Calendar (your existing admin calendar)
No setup. Each monthly review appears in admin, Schedule: a small diamond on its due date in the 14 day calendar, a "Monthly care reviews" list under it (client, website, due date, status, link to the review and draft), and the review in the day panel when you click that date. One item per review cycle, so duplicate payment webhooks, reruns, and job retries can't add more; moving the deadline or progressing the work updates the same item. Care items never touch availability, blocked times, bookings, or Zoom, and nobody is invited. There is no external calendar feed.

**Which state completes the calendar item:** the review is complete when the email provider (Resend) **accepts** the report. The item then shows "Sent, delivery not confirmed". It shows "Sent and delivered" only when Resend sends a signed delivery event, and "Sent, delivery failed" on a bounce or complaint. Approval alone never completes it.

Optional: in Resend, Webhooks, add `https://<deployment>/api/care/resend/webhook` for `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, and set `RESEND_WEBHOOK_SECRET` in Vercel. Check that your Resend plan includes webhooks; if not, leave it off and delivery stays "not confirmed".

## Billing, cancellation and refunds (approved Oct 29, 2026)

Published in the care agreement the client signs (`care-agreement-2026-11`), the care terms page (`/care/terms`), the Website Care FAQ, the agreement emails, Stripe Checkout's submit text and the pricing guide, all from `src/content/care-terms.ts`.

- **Billing:** monthly in advance. Successful payment starts the paid service period and automatically starts its review. Client wording: "Your monthly website check is automatically queued when payment is confirmed." Nothing promises instant completion.
- **Refunds:** non-refundable after successful payment, except where required by law. A refund made in Stripe is flagged to you; the system never refunds.
- **Cancelling:** the client cancels future renewals before the next billing date (email you or reply to any care email; you cancel in Stripe at period end or send a portal link). Effective at the end of the paid period; the plan stays available until then; no prorated refund.
- **Billing errors:** duplicate or incorrect charges are always investigated and corrected; the refund rule never blocks that. Flagged automatically: a second paid invoice for a period that already has a review, and a paid invoice on a subscription that isn't linked to the website.
- **Service you can't provide:** a paid period whose website isn't confirmed (never confirmed, setup changed, paused, ended) is kept, held and emailed to you at once; nothing outside the confirmed scope is scanned. Confirming or resuming queues it. An ended site's payment is never released automatically. A subscription Stripe ends before its paid period is over flags open reviews.
- **Existing subscribers:** never moved to the new agreement silently. Any subscriber without a signed current agreement is flagged ("Agreement signature needed"); send them the agreement link. Their earlier agreement stays in place until they sign.

Settings shows these as approved and read only (changing them needs a new agreement version).

## Still needing your approval

1. **Grace period** after a failed payment (days). Not set. Reviews only ever start for paid periods either way.
2. **When billing attention starts**: proposed after 1 failed payment.
3. **Disputes**: proposed "flag for you to decide"; no automatic response.
4. **Trials and promotion codes**: none (checkout turns promotion codes off).
5. **Retention**: proposal below.
6. **Public "Starting a plan" note** (`careSubscribeNote.approved` in `src/content/offers.ts`) stays hidden until Stripe is live.
7. **Ownership clause** from the earlier release is still pending and untouched.

Live checkout stays off until these are approved in admin settings.

12. **Proposed task durations** in the starter catalog (Task catalog): confirm or change each before it deducts plan time.
13. **Additional work pricing (settled)**: additional work is $70 an hour with a one hour minimum (approved November 2026, replacing $100), or a fixed quote the client agrees to (`STANDARD_HOURLY_RATE` in `src/lib/terms.ts`, the same rule as occasional support and the current proposal and contract terms). Preset standard minutes only measure included plan time; they never set an hourly charge, and nothing converts minutes to dollars. Each estimate's additional price and its explanation are entered by hand (the form offers hourly and fixed quote wording). The public sample's $110 is an example fixed quote. Documents issued earlier keep their own wording.
14. **Updated care agreement**: have existing clients accept the flexible plan time terms (`care-flex-2026-11`) before using Quick add or estimates for them.

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
- **Your plan** (right under the top, never in small print): plan name, the client's **agreed** monthly price, the billing period, and included time. Where time is included: **Plan time used** (standard minutes applied to completed work), **Reserved** for approved work (when there is any), and **Available** as of the report date. Until you tick "All completed work for this period is recorded", Available reads **Not confirmed yet** with a note that records aren't complete; it never assumes the full allowance remains. Essential Care says work is quoted separately.
- An accurate headline and three counts with icon and text: **Passed** (agreed checks), **Issues found**, **Not verified**, then **Your next step** right under them (on the first PDF page too).
- **Needs attention** (full width): one entry per kind of problem, with all affected pages and devices listed once. Each says what's wrong, why it matters, and what happens next (I'm looking into it, needs your input, needs your approval, or fixed and verified).
- **Fixed and verified** only when you mark it fixed **and** either a recheck no longer finds it or you record how you verified it.
- **This month's checks**: two columns on desktop with thin row dividers and a thin divider between the columns, one column on phones. Every row has the icon, the label, and the status in the same positions. A check is "Passed" only with an automated pass or your recorded manual pass. A booking, checkout, or contact page row says the page opens but the booking, payment, or message itself wasn't tested. Not applicable items are listed separately.
- **Not verified this month** with reasons. A site blocking the automated checker is listed here, never as an issue, and the wording never claims visitors are fine or affected; your note on the item explains what you found by hand.
- **Work completed**: every task recorded with Quick add for that period, in its client facing words, with the standard minutes it applied (excluded work is labeled, for example "covered defect correction, not counted"). Nothing is typed twice.
- **Waiting for your approval**: each draft estimate with its scope, deliverables, schedule, total standard minutes (with testing), included minutes proposed, additional minutes, and the additional price with how it was calculated. Readiness refuses incomplete estimates and any price typed in the report text.
- The headline is computed, and readiness refuses a summary that reads as all clear while issues or unverified items remain. Every red issue needs a decision before the report can be marked ready.
- Technical detail (error codes per result, redirect chains, screenshots, every individual result), private notes, and logs stay in admin. They're never part of the snapshot, so they can't reach the PDF or the email.

### Plan price
**Agreed monthly price**: set it on the website (Website settings). Each new billing period copies it, so a later price change doesn't rewrite an old report. You can also set it on a single review under **Plan time and work**. A report can't be marked ready without it.

### The client email
The email has your message, then the complete report (plan and time, counts, issues and next actions, the checklist, unverified items, work completed, approval requests and estimate explanations), then a note that the PDF is attached for their records. It uses tables with inline styles; the two column parts stack on phones (Gmail, Apple Mail, and other clients that honor the media query; others keep two columns). The plain text version carries the same content. Review, approval, and sending stay separate steps.

Public samples: two fictional reports (no outstanding issues; an issue plus unverified items) on example.com addresses are on the public Website Care page with PDF downloads. Every PDF page says "Sample report • Illustrative findings". They are static content built with the real report template and never read the database. They appear publicly only when this branch is merged.

## Plan time: approved flexible time policy and work tracking

**Policy (approved):** Business Care includes 30 minutes and Premium Care 90 minutes per billing period, usable for any website work (updates, troubleshooting, fixes, new pages, new features, redesigns, larger projects). Essential Care includes checks and reports, with work quoted separately. Unused time doesn't roll over. Monthly checks, report preparation, and covered defect corrections don't use plan time. Provider costs stay separate. Larger work needs an agreed scope and schedule, and any additional cost needs the client's approval before that work starts. The public wording, plan cards, comparison table, care terms, FAQs, homepage, services copy, pricing guide, samples, reports, and emails all say this (`src/content/care-terms.ts`, `src/content/offers.ts`).

**Standard minutes, not timers.** Nothing measures time. Work is counted from the **Task catalog** (Admin, Care, Task catalog): each task has a name, category, what one unit is and includes, standard work minutes per unit, testing minutes applied once per batch or to each unit, a client facing description, optional private instructions, and an active switch.
- Line total = quantity × work minutes + testing. Example: two supplied images at 5 minutes plus 3 minutes of batch testing = 13.
- Testing is never counted twice: batch testing counts once per task, the same task can't appear twice in one record, and "Tested together with another task here" sets a line's testing to 0.
- The starter catalog is **proposed** (replace a supplied image, supplied text, hours or contact details, a listed price, a link, a supplied document; plus finding or preparing an image and writing or editing text, kept separate from replacing supplied content). Proposed tasks deduct nothing until you press **Confirm minutes**. Changing minutes, testing, or the unit makes a task proposed again. Recorded work keeps its own copy of the task, so edits never change history.
- **Custom task** for anything else (including new features): you set its agreed standard minutes; it is not a time entry.

**Quick add work** (website page and review screen, under **Plan time and work**): choose tasks, set quantities (number field or minus and plus), see task, testing, and total minutes, the current allowance and the balance after recording, tick "The work and its testing are complete", then **Record completed work**. Choosing a task or receiving a request deducts nothing. Each line has a client facing description and a private note (never in reports). Mark a line as not counted for monthly checks, report preparation, or a covered defect correction; it is still recorded and shown to the client with that label.

**Ledger rules** (enforced in PostgreSQL, `care_record_work` and friends): one ledger per website and billing period; included, applied, reserved, available. Every save locks the billing period, so simultaneous requests can't double allocate or go negative; a form's save key makes a double click or retry save once. Work beyond the available minutes is refused (it needs an estimate). **Undo** voids entries with a reason and restores the minutes; **Correct** voids and replaces in one step. Voided entries stay visible with their reason; every change is in the activity log.

**Estimates for larger requests:** scope, deliverables, agreed schedule, total standard minutes with testing, included minutes proposed, additional minutes, and the additional price with how it was calculated (entered by you, either at the standard $70 an hour with a one hour minimum or as an agreed fixed quote; standard minutes never set the price). A draft reserves nothing. **Record client approval** (with how they approved) reserves the included minutes in that billing period only. Recording the work against the estimate takes the reservation first and counts the rest as approved additional work, without counting anything twice; "This finishes the estimate" releases unused reserved minutes. Cancel or decline releases them too. Work beyond the approved standard minutes is refused until a **revised estimate** is approved (which replaces the earlier one). An approved estimate whose period ended is flagged on the Overview; **Carry to current period** closes it and creates a draft that needs approval again, so no expired or future allowance is used silently. **Create invoice** saves a pending fixed fee invoice for the approved additional price, once, in the existing invoices (Revenue); it isn't sent and nothing is charged. Stripe is never charged for overages.

**Agreements:** a new enrollment's care terms are recorded when the client signs the care agreement on their private link (it records `care-flex-2026-11` for plan time and the signed agreement version). Confirming the technical scope no longer records terms, and there is no manual online acceptance. Websites enrolled earlier are flagged on the Overview and on their page ("Review this client's care agreement first"); Quick add and estimates stay off for them until you record how the client accepted the current terms. Earlier issued agreements and sent report snapshots are never rewritten.

**Approved earlier reports:** snapshots approved before this change keep their original plan block and render unchanged.

## Verification

**Plan time and admin pages (third pass, all local, no shared database):**
- `npm run test:care`: 25 ledger tests on a throwaway PostgreSQL 16 with both pending migrations (quantities, batch and per unit testing, preset edits and reconfirmation, duplicate saves including 6 at once, 5 simultaneous allocations against one allowance, overdraw refusal, excluded work, undo, correction, draft vs approved reservations, conversion on completion, early finish, cancellation, revised estimates, period renewal, cross period refusal, terms review, invoice amount and single invoice, browser roles refused); 11 report and email tests; 9 end to end tests that run the real Next.js routes and screens against that database through a local REST stand in (`tests/care/local-stack.mjs`).
- `npm run test:admin`: 22 browser tests for the admin pages (see docs/ADMIN_STRUCTURE.md).
- Typecheck, lint on changed files, production build, pricing guide regenerated (`npm run guide:check` passes), sample PDFs and emails regenerated.
- `tests/care/suggest.test.mjs` (6 tests): field suggestions follow the decision you chose, claim a verified fix only from an automated recheck or with your confirmation, mark hand check wording as needing confirmation, and invent no prices, dates or approval. `tests/care/stack.test.mjs` also checks the server refuses suggested hand check wording without `confirm_checked` and keeps your text.
- `tests/care/stack.test.mjs` also covers each website's review history (`GET sites/:id/history`): every billing period with its checks, findings and decisions, manual review, recorded work and estimates, and every approved report version and send with PDF links; earlier checks open read only (`GET runs/:id`); a second website for the same client keeps a separate history, and the client profile lists each with its review count. `billing.test.mjs` opens an earlier signed agreement version (`GET sites/:id/agreements/:aid`) without signature data and downloads its stored PDF.
- `tests/admin/client-docs.test.mjs` (3 tests): a client's document history by client id across files, proposals, statements of work, contracts, invoices, care agreements and care reports; records that match by email only are flagged as unlinked with a reason, never attributed.
- `tests/care/billing.test.mjs` (16 tests): turning a link off and replacing it (refused for view, sign and checkout; open checkouts expired; same signed agreement and PDF; the new link email; link history), and the client's care documents by client id with the stored signed PDF and unlinked records flagged. Also the agreement and payment workflow against local stand ins for Stripe, Resend and GitHub (`tests/care/fake-services.mjs`), using the real Stripe and Resend SDKs and signed webhooks. Covers: no agreement before the technical scope is confirmed or with a mismatched price (currency, interval, trial, archived, live versus test, Stripe unreachable); required manual checks at confirmation; the persistent link sent once, reminders on the same link; the client page showing only agreement text; payment locked until signing; exact version, name, signature and agreement required; signed PDF stored, emailed to the client and you, identical to the admin download; checkout on demand for the verified price, reused; a price or scope change locking payment until a new version is signed; the first payment queuing and dispatching the scan at once, out of order and redelivered notices adding nothing; a renewal's dispatch failing, retried with backoff and recovering; a dispatch blocked after 5 attempts with one owner email and a manual retry; renewals held for a changed scope and for a paused site, flagged and released; failed and incomplete payments never scanning; a duplicate charge flagged; cancel at period end.
- `tests/care/scope.test.mjs`: required checks, suggestions, and the payment to scan pipeline.
- Not verified: the REST stand in covers what this code uses but isn't Supabase itself; run the migrations and one Quick add on a Supabase branch before release.


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
3. **Enroll:** Websites, then Enroll a website. Pick the client record, plan, agreed price, site URL, approved domains, pages and destinations. Use **Suggested scope** (Add all suggestions), then edit the checklist. Set the recipient name and email. Save. It's a draft; nothing runs.
4. **Confirm the technical scope:** open the website, read the setup, tick the three boxes, describe how the client authorized the checks, and confirm.
5. **Agreement:** in Care agreement, preview what the client signs, type the client's address, and Send agreement link. You'll see when they open it and when they sign; the signed PDF downloads from the same panel and was emailed to both of you. The agreement is refused unless the plan's Stripe price matches the agreed monthly price, in USD, monthly (`verifyCheckoutPrice`). (Billed by invoice instead? Use "Add a paid service period by hand".)
6. **Payment and check:** the client chooses Continue to payment on their agreement page. When Stripe reports the paid invoice, the review shows Payment received, then Scan queued (runner started), Running, Completed, and it's on your Schedule calendar. You're emailed when results are ready, or if the start keeps failing (Retry start on the review). If the scope isn't confirmed when a renewal is paid, the review shows On hold and you're emailed. You get an email with grouped results and a link. Open the review: each issue is one card with its pages; choose what happens next for every red issue, and open individual results or screenshots only when you need them.
7. **Manual review:** record each checklist item. Use Not checked with a reason when needed.
8. **Record work and write:** as you finish work during the period, use **Quick add work** on the website page (it shows up in the report automatically). For anything larger, create an estimate and record the client's approval before starting. At review time, check the agreed price, tick that all completed work is recorded, and write a short summary.
9. **Approve:** Mark ready for review, open the client report and PDF preview, tick sign off, type your name, and approve.
10. **Send:** check the name and exact email, adjust the subject and message, type the address to confirm, then Send Report. Or download the PDF without sending. The review counts as complete only once sent.
