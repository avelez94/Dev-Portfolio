# Mary’s Logistics Group website

Public website and private Business Command Center for Mary’s Logistics Group (formerly Velez
Freight Group), a family owned freight
brokerage being established in Maryland. Built with Next.js 16 (App Router), TypeScript,
Tailwind CSS 4, shadcn/ui style components (Radix), Lucide icons, React Hook Form + Zod,
Supabase (Postgres + Auth) and Resend. Designed for Vercel.

This folder is a self contained app inside the `Dev-Portfolio` repository. Deploy it as its own
Vercel project with **Root Directory = `velez-freight`** (the folder keeps its original name so the
hosting configuration does not change), or move it to its own repository
(`git subtree split --prefix velez-freight`).

## Operating status: prelaunch by default

`BROKER_AUTHORITY_ACTIVE=false` (default) keeps the site in prelaunch mode:

* A status notice appears on every public page.
* Quote buttons become "Contact Us" and "Business Inquiry"; the homepage form becomes a launch
  notification sign up; `/request-quote` shows a business inquiry form.
* The freight quote server action refuses submissions, and a database trigger refuses quote
  rows while the dashboard switch is off.

Operations turn on only when **both** the environment variable is `true` **and** an owner or
admin enables "Operations enabled" in Dashboard > Settings (which requires typing a
confirmation, the MC number and the date authority was verified). Even then, inquiries are
stored as `pending_review` and no price is generated.

## Admin command center

A private operations center at `/admin`: today's priorities from explicit workflow rules, KPI
cards with comparisons and drill downs, shipper 360 profiles, carrier qualification with
recorded evidence, a task center, Insights (six analytical tabs) and a report center with CSV
and PDF exports. Quotes, shipments, invoicing and payables are built and stay locked until
operations are enabled. See `docs/COMMAND_CENTER.md` for how it works and
`docs/ADMIN_GAP_ANALYSIS.md` for what was added.

To explore it locally with a developed (synthetic) brokerage history:

```bash
npm run preview:synthetic
```

Then sign in at http://localhost:3300/admin/login as `owner@example.test` with the password
`correct horse battery staple`. This uses a throwaway local database and refuses anything else.

## Local development

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

The site runs at http://localhost:3100. Without Supabase variables the public pages render
with prelaunch defaults, and forms report honestly that the inquiry system is not connected.

## Connecting Supabase

Status: the production project (`velez-freight-group`, ref `mjdrehxyaweamzfqolib`) exists and
every migration in `supabase/migrations/` has been applied and verified against the repository
(see `docs/SECURITY.md`). The steps below are for reference or for a new environment.

1. Create a Supabase project.
2. Review the files in `supabase/migrations/` and apply them in order (SQL editor or Supabase
   CLI). One of them schedules the background workflow job with Supabase Cron. Rollback
   scripts are in `supabase/rollback/` (apply newest first; destructive, export data first).
3. Apply the Auth settings in `docs/SECURITY.md` (disable sign ups, redirect URL).
4. Create the first owner: Authentication > Users > Invite user (your email). Then in the SQL
   editor run:

   ```sql
   update public.profiles set role = 'owner', is_active = true where email = 'YOUR_EMAIL';
   ```

   Open the invitation email, set a password, and sign in at `/admin/login`. Further team
   members are invited from Dashboard > Settings.
5. Add the environment variables from `.env.example` in Vercel.

## Hosting (Vercel)

Project `velez-freight-group` (team `cutrated-mile`), production address
https://velez-freight-group.vercel.app. Settings that matter: Root Directory `velez-freight`,
"Include files outside the root directory" off, Node 22, functions in `iad1` (Washington, D.C.),
deployments skipped when nothing in this folder changed. Vercel Authentication currently
protects every address except custom domains, so only signed in Vercel team members can view
the site until it is made public or a custom domain is connected. Environment variables are
listed in `.env.example`; `SUPABASE_SERVICE_ROLE_KEY` holds the Supabase secret key (`sb_secret_...`) and is added by the owner directly in Vercel. The public key is the publishable key (`sb_publishable_...`); the legacy JWT keys are not used.

## Email notifications

Set `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM` (a sender on a domain verified in Resend) and
`NOTIFY_EMAIL_TO`. Without them, submissions are still stored and notifications are skipped.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3100 |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run test:unit` | Validation and spam token unit tests |
| `npm run test:db` | Database security, workflow and metric accuracy tests on a local Postgres (needs `TEST_DATABASE_URL`) |
| `npm run preview:synthetic` | Local only preview with a synthetic developed brokerage |
| `npm run test:e2e` | Builds the app and runs Playwright flows and axe accessibility scans against a local Postgres through a test only Supabase stand in |

## Project structure

```
src/
  app/(site)/        public pages (home, services, shippers, carriers, our-story, contact,
                     request-quote, privacy, terms)
  app/admin/         login, auth callback, dashboard pages and server actions
  app/actions/       public form server actions (validated, rate limited, spam checked)
  components/        ui (shadcn style), site, home, forms, admin
  config/            site.ts (approved copy and content), images.ts, admin.ts
  lib/               env, supabase clients, auth, data access, security, email, ai (stub)
supabase/            migrations and rollback scripts
tests/               unit, db, e2e
docs/                SECURITY, AI_ARCHITECTURE, BRAND_ASSETS, IMAGE_SOURCES, COMMAND_CENTER
brand-source/        the owner supplied logo file (master)
scripts/brand/       regenerates the vector logo files from the master
```

## Content and facts

All copy lives in `src/config/site.ts` (owner approved text). Company facts that are not yet
confirmed (email, phone, MC and USDOT numbers, LLC status) are **not** hard coded; they are
edited in Dashboard > Settings and hidden until set.
