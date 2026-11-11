# Platform audit and plan (launch preview, settings, outreach, operations, agents)

## Already implemented (reused, not rebuilt)

| Area | What exists |
| --- | --- |
| Public site | Nine pages, prelaunch and operational copy branches, server enforced gate (`BROKER_AUTHORITY_ACTIVE` plus dashboard switch plus authority status), quote wizard (operational only), contact and carrier forms with validation, rate limits and spam checks |
| Admin shell | Sidebar groups, drawer, breadcrumbs, Ctrl K search, notifications, invite only access, roles (owner, admin, staff), RLS on every table, audit log |
| CRM | Shipper 360 (contacts, activities, stage history, notes, tasks, follow ups), carrier profiles with recorded verification evidence and qualification rule, inquiries |
| Tasks | Task center, system rules (`refresh_system_tasks`, every 15 minutes via Supabase Cron), snooze, recurrence, assignment |
| Operations | Quotes (approval, recorded as sent), shipments, events, exceptions, documents with private file storage |
| Financials | Invoices, payments, carrier bills and payments, operating expenses, aging |
| Analytics | SQL metric functions, Insights (six tabs), ten reports with CSV and PDF |
| Settings | Business identity, launch checklist, activation switch, notifications, team |
| Email | One internal notification template through Resend (not configured) |
| AI | Type definitions only (`src/lib/ai/types.ts`); no provider, nothing running |

## Gaps this work fills

1. **Launch preview:** an authenticated, noindex copy of the website rendered in the launch state, with simulated submissions.
2. **Settings Center:** tabs; company profile; regulatory credentials with verification state and history; public credentials preview and display controls; contact and support hours; structured website content with version history; integrations status.
3. **Email and Outreach:**
   - templates with versions and categories;
   - safe variable rendering;
   - drafts and approval;
   - CRM compose and history;
   - suppression list with a working unsubscribe link;
   - a modular provider with sending gates;
   - delivery webhooks;
   - dashboard and analytics.
4. **Sales navigation:** Outreach, Email Templates, Opportunities (pipeline view over existing shipper records).
5. **Agents:**
   - registry of the seven agents with permissions, all disabled by default;
   - run history and approval requests;
   - a first agent that is read only and rules based (no paid AI).

## Dependencies on you or external services

* **Sending domain:** must be verified in Resend (SPF, DKIM, DMARC records), and you must explicitly enable sending.
* **Physical mailing address:** required in commercial emails (CAN-SPAM).
* **Inbound replies:** need a connected inbox; not available yet, so replies are not tracked.
* **AI provider:** needs an account and your approval before any agent uses a language model.
* **Live data:** applying new migrations to the live database and deploying both need your approval.

## Sequence

Phase 1 audit (this file), then:
* Phase 2: launch preview
* Phase 3: Settings Center
* Phase 4: Email and Outreach
* Phase 5: CRM additions
* Phase 6: analytics
* Phase 7: agents
* Phase 8: tests and readiness checklist (`docs/PRODUCTION_READINESS.md`)

## Phase report

| Phase | Complete | Not done or limited |
| --- | --- | --- |
| 2 Launch preview | `/admin/preview`: every public page in the launch state, owner and admin only (checked on every render), noindex and uncached, labeled bar, links stay inside, forms validate but save nothing, credential placeholders | None |
| 3 Settings Center | Eight tabs; company profile; regulatory credentials with verified state, source, dates, evidence files and append only history; MC verification required to enable operations; contact emails, business hours, after hours (24/7 only once confirmed), social links; display preferences; editable homepage text with versions and restore; unsaved change markers, Cancel, leave warning, confirmations | Only seven homepage text slots are editable; other page copy stays in code |
| 4 Email and Outreach | Templates (categories, versions, duplicate, archive, seven starters), composer with variables, fallbacks, desktop and phone preview, plain text; drafts and approval; sending gates; idempotent, confirmed sending; unsubscribe page and one click; do not email list; signed delivery webhook; CRM email history and activities; overview stats | Reply tracking (needs an inbox connection); bulk sending (one message at a time by design) |
| 5 CRM | Opportunities pipeline; compose from shipper and carrier profiles; priorities for emails awaiting approval, unsent or failed, carrier verification left in review, and credential renewals | None |
| 6 Analytics | Outreach overview figures; Email Outreach report (CSV and PDF); executive brief | Outreach is not yet a tab in Insights |
| 7 Agents | Registry of seven agents with documented permissions, all off; AI agents locked by the database; run history; approval queue; Executive Insights (rules based, read only, on demand) | Six agents not built: four need an approved AI provider, two run today as priority rules |
| 8 Tests and readiness | Unit 24, database 54, browser 74 (prelaunch and operating builds, including accessibility scans); `docs/PRODUCTION_READINESS.md` | Live database migrations applied and deployed to production 2026-11-11 |
