# Admin command center

A private operations center at `/admin`. Every page answers: what am I looking at, what needs
attention, what can I do here, and where do I go next.

## Daily use

1. **Dashboard** (`/admin`): the date, how many items need attention, and **Today's
   priorities**, ordered by: critical exceptions, financial or compliance risks, time sensitive
   operations, sales opportunities, routine work. Three or more items of the same kind collapse
   into one card ("20 invoices are overdue") that expands. Each item shows the related record,
   due date or age, priority, the next step, and Open record, Done, Snooze and Assign controls.
   Done offers Undo.
2. **What the numbers say**: plain English findings from deterministic rules, each with its
   period, calculation and a link to the records.
3. **Key metrics**: KPI cards for the selected period (default last 30 days) compared with the
   preceding period of equal length. The information icon shows each definition; View records
   drills into the underlying list. "Not available" means there is nothing to calculate from;
   it is never shown as zero.
4. **Search** anything with Ctrl K (or /) from any page.

## Navigation

| Group | Pages |
| --- | --- |
| Overview | Dashboard, My Tasks, Notifications |
| Relationships | Shippers (360 profiles), Carriers (qualification and evidence) |
| Operations | Freight Inquiries, Quotes, Shipments |
| Financials (owners and admins) | Invoices (with Operating expenses), Carrier Payables |
| Analytics | Insights (six tabs), Reports (eleven reports with CSV and PDF) |
| System | Website Content, Settings, Audit Log |

The sidebar collapses (preference kept per browser) and becomes a drawer on phones.

## Where tasks come from

| Rule | Priority | Created when |
| --- | --- | --- |
| Review new website inquiry | Time sensitive | An inquiry arrives (closed automatically when marked reviewed) |
| Review carrier interest | Routine | A carrier submits the website form |
| Shipper follow up | Opportunity | A follow up date is today or tomorrow (one task per date) |
| Carrier insurance expiring | Risk | A verified carrier's insurance expires within 30 days |
| Quote approval, quote follow up | Time sensitive, Opportunity | A quote waits for approval, or was sent 3+ days ago without a decision |
| Shipment exception, unassigned load | Critical | An exception is open, or a load near pickup has no carrier |
| Missing POD | Risk | Delivered more than a day ago without a POD record |
| Overdue invoice | Risk | Past due with a balance (a new task per aging bucket) |
| Carrier bill due | Risk | Due within 3 days with a balance |

Rules are SQL (`refresh_system_tasks`) with a unique key per condition, so tasks are never
duplicated and a task you dismissed is not recreated. Inquiry rules run instantly. Time based
rules run every 15 minutes in a background job inside the database (Supabase Cron, migration
`20261113000100_scheduled_jobs.sql`), and also when the dashboard or task center opens (at
most every five minutes). The job only creates or closes internal tasks; it never contacts
anyone. Its run history is in `cron.job_run_details` and is trimmed after 14 days. Tasks whose
condition clears are closed automatically and shown as "auto resolved". Completing a task never
contacts anyone.

## Documents

Carrier and shipment profiles have a Documents panel: choose the type, optionally a reference
and expiry date, and attach a PDF or photo (up to 15 MB). Files are stored privately; the
download link checks your access each time and is recorded in the audit log. W9 forms open
for owners and admins only. A document can also be recorded without a file.

## Operating modes

* **Prelaunch** (now): shipper prospecting, CRM, inquiries, follow ups, carrier interest,
  operating expenses, Website Content and reports with honest empty states. Quotes, Shipments,
  Invoices and Payables show what activation requires.
* **Active brokerage**: only when `BROKER_AUTHORITY_ACTIVE=true` **and** the dashboard switch is
  on (typed confirmation, MC number and verification date required). The database refuses
  quotes, shipments, invoices and carrier bills otherwise.

## Human control points

* Quotes: drafted by a person, **approved** by an owner or admin, **recorded as sent** only
  with a confirmation that you sent it yourself.
* Carriers: can be assigned only when the explicit rules pass (authority check within 30 days,
  insurance check, insurance in force, signed agreement, marked Verified). Enforced by the
  database. No automated carrier score exists.
* Payments: recorded with a confirmation; method and reference only, never bank details;
  overpayment is refused.
* Shipment times: on time performance uses only verified event times and appointment windows;
  everything else is reported as unknown.

## Metrics

All definitions live in `src/lib/metrics/definitions.ts` and are shown in the app. Every figure
is computed once in SQL (`supabase/migrations/20261112000200_analytics.sql`) and reused by the
dashboard, Insights, Reports, CSV and PDF exports.

Key formulas:

* Gross brokerage margin = customer freight revenue minus carrier freight cost (same completed loads)
* Gross margin % = gross brokerage margin / customer freight revenue of those loads
* Average gross margin per load = total gross margin / eligible completed loads
* Operating profit estimate = recognized gross margin minus brokerage operating expenses
  (excludes taxes and owner distributions)

Revenue recognition: on the recorded delivery date of delivered or completed shipments;
cancelled shipments are excluded. Booked revenue, invoiced revenue and cash collected are
reported separately. These are management figures, not GAAP statements.

## Testing with synthetic data

`tests/fixtures/synthetic-brokerage.mjs` generates a deterministic six month history (every
company is labeled "[Synthetic]"). It is loaded only into throwaway local databases by the
tests and by `npm run preview:synthetic` (which refuses non local databases). It must never be
loaded into production.
