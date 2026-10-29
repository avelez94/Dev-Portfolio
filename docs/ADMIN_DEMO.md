# Admin demo (preview deployments)

Vercel previews share the production database, so the admin on a preview runs as a demo: fictional data, simulated services, and no route to real client records. The banner on every admin page reads **Demo • Fictional data • Changes are temporary.**

## When it's on

`src/lib/demo/mode.ts`:

- **On** for every Vercel preview deployment (`VERCEL_ENV=preview`), or wherever `ADMIN_DEMO=on`.
- `ADMIN_DEMO=off` turns it off on a preview.
- **Never** on production (`VERCEL_ENV=production`), whatever the flag says. `/api/demo` answers 404 there.

## How it works

- **Sign in.** The usual admin password signs you in, and each sign in starts its own demo session.
- **Closed routes.** In demo mode the proxy closes the real admin API routes with a 403, even with the admin cookie. The routes it closes are the dashboard data route, the Website Care admin API, and the invoice, email, meeting, proposal, SOW, contract and debt routes. The real care feature stays off (`WEBSITE_CARE_ENABLED` is not used).
- **Browser side** (`src/lib/demo/browser.ts`):
  - Sends those requests to `/api/demo`, together with the session's demo state. That covers Supabase client calls and links to report PDFs.
  - Keeps the state in that browser only, so sessions never see each other's changes.
  - **Reset demo** discards the changes.
- **Server side** (`src/lib/demo/engine.ts`):
  - Loads the state into PGlite (PostgreSQL compiled to WebAssembly) inside the server process. PGlite uses no network and no files, and nothing is kept between requests.
  - PGlite applies the real pending care migrations, so the care SQL functions are the real ones: allowance, recording, reservations, corrections and estimates.
  - The real route handlers and care server code run against it (`dispatch.ts`).
- **Outbound calls** (`intercept.ts`): while a demo request runs, every outbound call is answered in process:
  - Database and storage calls go to the demo database.
  - Resend email, Zoom meetings and GitHub runner dispatch are simulated and listed under **Simulated actions**.
  - DNS lookups return example.com's address.
  - Everything else is refused, including Stripe and any raw http(s) connection.
- **Demo versions of some actions** (in `dispatch.ts`):
  - The check runner finishes queued checks with fictional results.
  - **Create Stripe checkout link** returns a link to a simulated checkout page (what the client would see). **Pay (simulated)** there plays Stripe's payment notice. It charges the plan's Stripe price, as Stripe would, and creates the paid period with the real `createCycle`.
  - Simulated checks report each site's second agreed page as too wide for phones, so every review has an issue to handle.
  - The Stripe portal and Stripe sync are acknowledged only.

## Direct links (fictional records, the same in every session)

| Page | Path |
| --- | --- |
| Northside Physio website | `/admin/care?site=00000000-0000-4000-8000-000000000201` |
| Northside Physio review | `/admin/care?cycle=00000000-0000-4000-8000-000000000301` |
| Quick add work | add `&work=add` to the review or website link |
| New estimate | add `&work=estimate` to the review or website link |
| Harbor Street Bakery (older terms, flagged) | `/admin/care?site=00000000-0000-4000-8000-000000000202` |
| Lakeside Dental (simulated Stripe subscription) | `/admin/care?site=00000000-0000-4000-8000-000000000203` |
| Owner's guide | `/admin/care/guide` |
| My Pricing cards, proposal and contract forms | `/admin/documents` |
| Proposal with milestone payments (client view, current terms) | `/proposals/00000000-0000-4000-8000-000000000933` |
| Proposal issued under the October terms (kept as issued) | `/proposals/00000000-0000-4000-8000-000000000932` |
| Unsigned contract with milestones (sign as the client) | `/contracts/00000000-0000-4000-8000-000000000944` |
| Signed contract and its invoice schedule | `/contracts/00000000-0000-4000-8000-000000000943` |
| Invoice schedule after signing (Taylor Brooks) | `/admin/pipeline?client=00000000-0000-4000-8000-000000000106` |

Client document pages use the demo only when the browser has a demo session (open `/admin` first). Without one they read the real database as before.

A new client to enroll: **Rivera Garden Design** (Casey Rivera) is in the client list without a care website.

## Still needs real verification

The demo can't show these. Check them against the real services before going live:

- **Supabase:** the pending migrations on a real project, row level security and grants, the storage buckets, and PostgREST behavior that the demo's REST stand-in only approximates.
- **Stripe:** checkout, the webhooks, subscription sync, the portal, and failed payments.
- **Resend:** real delivery, the attachments, and the signed delivery webhook.
- **The GitHub Actions check runner:** real browsers against real sites, its leases and retries, and the screenshots.
- **Zoom:** meeting creation with real credentials.

## Tests

`npm run test:demo` runs the app locally in demo mode. Every outside service points at a local tripwire, and the suite fails if any request reaches it.
