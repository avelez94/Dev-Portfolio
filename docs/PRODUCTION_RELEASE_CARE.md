# Production release: Website Care without Stripe (Oct 30, 2026)

Production: Vercel project `dev-portfolio` (team cutrated-mile), Supabase project **WebDev Freelance** (`dqzjhtdqjcdimtsipqzl`). Preview deployments run the isolated demo, never this database.

## Database (applied Oct 30)

| Order | Migration | How |
|---|---|---|
| 0 | Backup: `release_backup.pricing_20261030` and `release_backup.counts_20261030` (private schema, no public access) | connector |
| 1 | `pending/pricing-and-payments/20261102_pricing_titles_and_payment_schedule.sql` | connector |
| 2 | `pending/website-care/20261030_website_care.sql` | connector |
| 3 to 7 | `20261031_care_work_ledger`, `20261103_care_report_suggestions`, `20261104_care_checkout_invitations`, `20261105_care_agreements_and_dispatch`, `20261106_care_agreement_links` (as `supabase/release/20261030/03_apply.sql`, one transaction; 1 and 2 again, no change) | owner, SQL editor |
| 8 | `pending/website-care/20261107_care_function_search_path.sql` | connector |

Precheck: no care objects existed; `clients.id` and `invoices.client_id` uuid; no duplicate invoice schedules; lockdown intact. Verify: record counts unchanged (clients 3, invoices 4, pricing 8, proposals 2, sows 2, contracts 1, documents 0, invoice_milestones 0); no client care records created.

### Inventory

- **Existing tables reused (read, never altered):** `clients` (care websites and agreements reference `clients.id`), `invoices` (an approved estimate can create a pending invoice through `care_invoice_estimate`), `documents`, `proposals`, `sows`, `contracts`, `invoice_milestones` (client document history, read only).
- **Existing data changed:** five `pricing` names (Landing Page, Booking + Payments, Web Application, AI Workflow, Deposit renamed; prices and descriptions untouched). Two new unique indexes on `invoices` (one schedule per SOW, one per contract).
- **New tables (19):** care_settings, care_sites, care_cycles, care_scan_runs, care_findings, care_issue_notes, care_manual_results, care_reports, care_report_approvals, care_report_sends, care_notifications, care_stripe_events, care_email_events, care_activity, care_task_presets, care_estimates, care_work_entries, care_agreements, care_agreement_links. RLS on, no policies, no rights for anon or authenticated; server key only.
- **Seeded configuration (not client data):** one care_settings row (approved billing policy text), eight proposed task presets (unconfirmed until you confirm minutes).
- **Functions (15), server key only, search path pinned:** care_claim_scan_run, care_heartbeat, care_recover_scan_runs, care_begin_stripe_event, care_period_allowance, care_estimate_reservation_left, care_estimate_own_used, care_estimate_recorded, care_estimate_chain_used, care_record_work, care_void_work, care_approve_estimate, care_close_estimate, care_invoice_estimate, care_preset_guard (trigger).
- **Key constraints:** one active scan per period, one initial scan per paid period, one send per approved version, one open agreement per website, one active agreement link per website, unique Stripe subscription per website and invoice per period.
- **Private buckets:** care-agreements (signed agreement PDFs), care-reports (approved report PDFs), care-evidence (screenshots). public = false, no storage policies; only the server key reads or writes. Existing: freelance-docs, walk-photos (unchanged).

### Rollback
`supabase/release/20261030/99_rollback.sql`: refuses while any website or agreement exists; drops the care objects, restores the pricing names from the backup, drops the two invoice indexes. Code rollback: Vercel Instant Rollback to 5f74966, or set WEBSITE_CARE_ENABLED off.

## Production settings
Set: WEBSITE_CARE_ENABLED=true, CARE_EMAIL_ALLOWLIST (your addresses only), CARE_NOTIFY_EMAIL, CARE_GITHUB_REPO, CARE_GITHUB_REF. Not set on purpose: CARE_CLIENT_EMAIL_LIVE (client emails stay limited to the allowlist), every STRIPE_* value (payments off).

## Stripe off
Without STRIPE_SECRET_KEY: checkout, subscriptions and the billing portal are refused server side (503 with a plain message); agreements are sent, signed, stored and emailed; nothing is marked paid and no paid period or scan starts without a verified Stripe payment notice.
