# AI ready architecture

No AI features are enabled and no paid AI services are connected. This document describes
how future automation fits the current design so it can be added safely.

## Principles

1. **Server side only.** AI calls run in server actions, route handlers or background jobs.
   No model API key ever reaches the browser.
2. **Suggest, never act.** AI output is stored as a *suggestion* that a person reviews. Any
   action that affects customers, carriers, money or legal standing requires an explicit human
   approval recorded in `audit_events`.
3. **Modular.** Each capability is one module behind a small interface in `src/lib/ai/`, so it
   can be turned off, swapped between providers, or removed without touching the website.
4. **Least data.** Modules receive only the fields they need; no SSNs, bank details or
   documents are stored by this release at all.
5. **Off by default.** A capability runs only when its environment flag and an API key are
   configured and the owner has approved the cost.

## Planned modules and their data sources

| Module | Reads | Writes (as suggestions) | Human approval required for |
| --- | --- | --- | --- |
| Shipper prospect research | `shipper_prospects` | draft prospects, research notes | adding to CRM, any outreach |
| CRM follow ups | `crm_notes`, `follow_up_tasks` | draft emails, suggested tasks | sending any message |
| Freight inquiry extraction | `quote_inquiries`, emails | structured shipment fields | changing the inquiry |
| Quote profitability analysis | inquiry + lane data | margin estimates | any price sent to a customer |
| Carrier matching | `carrier_leads` | ranked candidates | offering a load |
| Carrier compliance review | FMCSA data, documents | review checklist | approving a carrier |
| Shipment tracking | future `shipments` | status summaries | customer notifications |
| Document extraction | future secure document store | extracted fields | accepting a document |
| Invoicing and receivables | future `invoices`, `payments` | draft invoices, reminders | sending invoices, any payment |
| Business analytics | all tables (read only) | reports | none (read only) |

## Future schema additions (not created yet)

* `ai_suggestions (id, module, entity_type, entity_id, payload jsonb, status pending|approved|rejected, reviewed_by, reviewed_at)`
* `shipments`, `rate_confirmations`, `carrier_documents` (in a private storage bucket with
  signed URLs), `invoices`, `payments`. Each with RLS limited to staff and every state change
  written to `audit_events`.
* Payments must use a PCI compliant processor; card or bank data is never stored here.

## Extension point

`src/lib/ai/types.ts` defines the `AiModule` interface. Implementations must return
suggestions; they have no access to send email, change statuses or contact third parties.
