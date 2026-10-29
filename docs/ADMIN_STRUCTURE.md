# Admin dashboard structure

The admin dashboard used to be one 3,064 line page that switched views in memory. It is now separate pages under one shared layout. Addresses, data access, permissions, and business rules are unchanged.

## Routes

| Address | Page | What loads |
|---|---|---|
| `/admin` | Home | scheduled calls, pending leads, active projects, unpaid invoices, accepted proposals, signed contracts. `?call=<id>` or `?lead=<id>` selects one. |
| `/admin/pipeline` | Pipeline | clients. `?client=<id>` selects one; the panel then loads that client's invoices, milestones, meetings, and files. |
| `/admin/revenue` | Revenue | invoices, projects, client names. |
| `/admin/documents` | Documents | pricing, clients, proposals, contracts, uploaded templates. `/admin/docs` redirects here. |
| `/admin/schedule` | Schedule | scheduled call times, availability, blocked days and hours, Website Care reviews (when on). |
| `/admin/care` | Website Care | unchanged subpages: `?view=`, `?site=`, `?cycle=`. Shows "switched off" unless `WEBSITE_CARE_ENABLED=true`. |
| `/admin/login`, `/admin/debt-tracker` | unchanged, outside the shared layout | |

## Files

```
src/app/admin/
  layout.tsx                      metadata (unchanged)
  login/, debt-tracker/           unchanged
  (dashboard)/                    route group: shares the layout, not part of the URL
    layout.tsx                    renders AdminShell
    loading.tsx, error.tsx        route level loading and error (with retry)
    page.tsx                      Home
    _home/                        HomeView, LeadPanel (call and lead details)
    pipeline/  page.tsx, _parts/  PipelineView, ClientPanel, ClientInvoiceForm, EmailDialog
    revenue/   page.tsx, _parts/  RevenueView, InvoiceDialog, ProjectDialog
    documents/ page.tsx, _parts/  DocumentsView, PricingCards, ProposalForm, ContractForm, DocContext
    schedule/  page.tsx, _parts/  ScheduleView
    care/                         Website Care (moved here unchanged, now inside the shared shell)
    _components/                  AdminShell (sidebar, bottom nav, sign out, session prompt), styles,
                                  theme, ui (page frame, states, fields, dialogs), PreviewDialog, unsaved
    _lib/                         api, types, format, useRows (per page data loading), leads,
                                  invoices (creation, payments, totals), documents (proposal and
                                  contract rules), pdf (document builders), files (storage)
```

## Behavior kept on purpose

- **Sign in:** `src/proxy.ts` protects every `/admin` page; every API route checks the admin cookie itself (`requireAdmin`), so the server never relies on the UI. A 401 anywhere shows the "session has ended" prompt, which now returns you to the page you were on.
- **Data:** the browser still talks only to `/api/admin/data` (admin cookie, server key added there). Each page now asks only for the tables it shows.
- **Client targeting:** the selected client is in the address. The client panel and every form in it are rebuilt when the client changes, so a half filled invoice, email, or meeting can't be sent for someone else. Invoice, email, and meeting functions take the client as an argument.
- **Document recipients:** the Documents panel always shows the exact address the open proposal or contract sends to.
- **Unsaved work:** the proposal draft still saves itself in the browser. Other forms with input register as unsaved: the sidebar asks before leaving, and the browser asks before refresh or close. Back and forward within a page change the selection the same way a click does.
- **Website Care:** its link and calendar items appear only when its API answers; its endpoints return 404 when switched off.
- **Removed:** the unused statement of work form code (`sowForm`, `sendSOWEmail`, `generateSOWDoc`), which had no button and was marked as not used.

## Tests

`npm run test:admin` starts a local dev server with a throwaway admin token and runs browser tests against an in-memory stand-in for `/api/admin/data` (`tests/admin/fake-data.mjs`), so nothing reaches a database or sends email. `tests/admin/workflows.test.mjs` passed 10 of 10 on the old single page and passes on the new pages; `tests/admin/routes.test.mjs` covers addresses, refresh, back and forward, highlighting, redirects, unsaved warnings, error states, and sign in on every route.
