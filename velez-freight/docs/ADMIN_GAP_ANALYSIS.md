# Admin command center: gap analysis

Inspected before changes: 14 admin routes, 8 admin components, one migration with 10 tables and
24 RLS policies, plus the existing unit, database and end to end tests.

## Already in place (kept)

| Area | What exists |
| --- | --- |
| Auth and security | Invite only Supabase Auth, `requireStaff` / `requireAdmin` / `requireOwner`, RLS on every table, anon has no grants, append only `audit_events` |
| Records | `shipper_prospects` (CRM), `carrier_leads`, `contact_inquiries`, `quote_inquiries`, `crm_notes`, `follow_up_tasks`, `business_settings`, `profiles` |
| Screens | Overview with counts, inquiries list and detail, shipper list and detail, carrier list and detail, simple task list, activity log, settings with the operations switch and team invites |
| Gates | `BROKER_AUTHORITY_ACTIVE` plus dashboard switch; database trigger refuses quote inquiries when operations are off |

## Missing from the new specification

| Spec section | Gap |
| --- | --- |
| 2 Navigation | Grouped, collapsible sidebar with counts; mobile drawer; breadcrumbs; global search; Notifications, Quotes, Shipments, Invoices, Carrier Payables, Insights, Reports and Website Content pages |
| 3 Today's Priorities | No rule based priority engine, no recommended actions, no snooze or reassign, no deduplication |
| 4 KPIs | Counts only; no date filter, comparison period, drill down, or prelaunch versus active sets |
| 5 to 9 Analytics | No metric definitions, no aggregation layer, no charts, no financial or operational data model |
| 7 Sales analytics | Status is overwritten in place, so historical funnels are impossible; no activity log (calls, emails, meetings); no lead source or industry category; no "Lost" stage |
| 8 Operations | No quotes, shipments, events, exceptions or documents tables |
| 9 Financials | No invoices, payments, carrier bills, carrier payments or operating expenses |
| 10 Shipper 360 | No contacts, activity timeline, or performance metrics |
| 11 Carrier profile | No insurance, expirations, verification evidence or onboarding progress |
| 12 Task center | No views, categories, recurrence, snooze, assignee, or automatic workflow tasks |
| 13 Report center | No reports, CSV or PDF exports, saved preferences |
| 14 Smart insights | None |
| 20 Testing | No metric, finance, funnel, task generation or export tests; no synthetic fixtures |

## Approach

* One additive migration (`20261112000100_command_center.sql`) that **extends** the existing
  shipper, carrier and task tables instead of duplicating them, and adds only: shipper contacts,
  CRM activities, immutable stage history, carrier verification evidence, quotes, shipments,
  shipment events and exceptions, documents (metadata), invoices and payments, carrier bills and
  payments, operating expenses, notifications, report preferences and scheduled report
  definitions (disabled).
* Brokerage tables (quotes, shipments, invoices, carrier bills) refuse inserts at the database
  while operations are disabled, in addition to the server checks.
* Financial tables are readable by owners and admins only.
* Every metric is defined once in `src/lib/metrics/definitions.ts` and computed once in SQL
  functions (`analytics_*`), which every page, chart, report and export reuses.
* Synthetic data lives only in `tests/fixtures/` and is loaded only into local test databases.
