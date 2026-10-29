/**
 * The demo database: PostgreSQL compiled to WebAssembly (PGlite), running in
 * this server process with no network and no files. It runs the real Website
 * Care migrations and SQL functions on fictional data.
 *
 * The demo state belongs to the browser session, not the server: each
 * request brings the session's state, it's loaded into the in-memory
 * database, the request runs, and the changed state goes back. So sessions
 * never see each other's changes, nothing is kept on the server, and a
 * restarted server loses nothing. Requests run one at a time.
 */
import 'server-only'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { demoScope, type DemoLogEntry, type DemoScope } from './context'
import { columns, ensureColumns, forgetSchema } from './rest'
import { adminRows, careRows, DEMO_FILES, UNCONFIRMED_PRESETS } from './fixtures'

export type DemoState = {
  v: 1
  created: string
  tables: Record<string, Record<string, unknown>[]>
  storage: Record<string, { type: string; b64: string }>
  log: DemoLogEntry[]
}

const MIGRATIONS = ['20261030_website_care.sql', '20261031_care_work_ledger.sql', '20261103_care_report_suggestions.sql']

/** The existing dashboard tables (created outside the repo in production), with the columns the app uses. */
const BASE_SCHEMA = `
create role anon; create role authenticated; create role service_role;
create table public.intake_submissions (id uuid primary key default gen_random_uuid(), name text, email text, business text, project_type text, description text,
  budget text, timeline text, heard_from text, priority text, notes text, status text default 'pending', submitted_at timestamptz default now(), stage text, source text,
  interest text, inquiry_note text, details jsonb, details_completed_at timestamptz, linked_submission_id uuid, continue_token_hash text, continue_token_expires_at timestamptz);
create table public.bookings (id uuid primary key default gen_random_uuid(), intake_id uuid references public.intake_submissions(id) on delete set null, scheduled_at timestamptz,
  zoom_meeting_id text, zoom_join_url text, zoom_host_url text, status text default 'scheduled', created_at timestamptz not null default now());
create table public.clients (id uuid primary key default gen_random_uuid(), name text, email text, business text, pipeline_stage text default 'discovery_call',
  created_at timestamptz default now(), intake_id uuid, booking_id uuid, notes text, platform text);
create table public.availability (id uuid primary key default gen_random_uuid(), day_of_week int, start_time time, end_time time, is_active boolean default true);
create table public.blocked_dates (id uuid primary key default gen_random_uuid(), blocked_date date, reason text, created_at timestamptz default now());
create table public.blocked_slots (id uuid primary key default gen_random_uuid(), blocked_date date, start_time time, end_time time, reason text, created_at timestamptz default now());
create table public.projects (id uuid primary key default gen_random_uuid(), client_id uuid, name text, type text, status text default 'active', value numeric default 0,
  platform text, start_date date, end_date date, notes text, created_at timestamptz default now());
create table public.invoices (id uuid primary key default gen_random_uuid(), project_id uuid, client_id uuid, invoice_number text, amount numeric, status text default 'pending',
  invoice_type text, total_fee numeric, deposit_amount numeric, deposit_paid_date date, hours numeric, hourly_rate numeric, service_desc text, due_date date,
  paid_date date, notes text, created_at timestamptz default now(), brand_version text);
create table public.invoice_milestones (id uuid primary key default gen_random_uuid(), invoice_id uuid references public.invoices(id) on delete cascade, name text,
  deliverables text, due_date date, fee numeric, status text default 'pending', paid_date date, created_at timestamptz default now(), brand_version text);
create table public.documents (id uuid primary key default gen_random_uuid(), client_id uuid, name text, type text, storage_path text, created_at timestamptz default now());
create table public.pricing (id uuid primary key default gen_random_uuid(), name text, price text, description text, updated_at timestamptz default now());
create table public.meetings (id uuid primary key default gen_random_uuid(), client_id uuid, scheduled_at timestamptz, zoom_meeting_id text, zoom_join_url text,
  zoom_host_url text, title text, status text default 'scheduled', created_at timestamptz default now());
create table public.proposals (id uuid primary key default gen_random_uuid(), client_id uuid, client_name text, client_email text, client_business text, project_title text,
  project_type text, understood text, line_items jsonb default '[]', total numeric, deposit_pct numeric, out_of_scope text, timeline text, next_steps text, message text,
  status text default 'pending', responded_at timestamptz, terms_version text, hourly_rate numeric, payment_plan text, created_at timestamptz default now());
create table public.sows (id uuid primary key default gen_random_uuid(), proposal_id uuid, client_name text, client_email text, client_business text, project_title text,
  project_type text, understood text, out_of_scope text, line_items jsonb default '[]', total numeric, deposit_pct numeric, timeline text, start_date text, delivery_date text,
  revisions text, hourly_rate numeric, payment_method text, status text default 'pending', terms_version text, payment_plan text, created_at timestamptz default now());
create table public.contracts (id uuid primary key default gen_random_uuid(), sow_id uuid, proposal_id uuid, client_name text, client_email text, client_business text,
  project_title text, project_type text, start_date text, delivery_date text, total_fee numeric, deposit numeric, balance numeric, kill_fee_pct numeric, payment_method text,
  status text default 'pending', signed_at timestamptz, signature text, terms_version text, hourly_rate numeric, payment_plan text, created_at timestamptz default now());
create table public.debt_payoff (id uuid primary key default gen_random_uuid(), creditor text, promo_name text, original_balance numeric, current_balance numeric,
  promo_deadline date, deadline_is_estimated boolean default false, priority int, completed boolean default false, completed_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now());
`

let instance: Promise<{ db: PGlite; query: DemoScope['query']; tables: string[]; base: DemoState }> | null = null

async function boot() {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = await PGlite.create()
  await db.exec(BASE_SCHEMA)
  for (const m of MIGRATIONS) {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'pending', 'website-care', m), 'utf8').replace(/create extension if not exists pgcrypto;/g, '')
    await db.exec(sql)
  }
  const query: DemoScope['query'] = async (text, params) => {
    const r = await db.query<Record<string, unknown>>(text, params as unknown[] | undefined)
    return { rows: r.rows }
  }
  const tables = (await query(`select tablename from pg_tables where schemaname = 'public' order by tablename`)).rows.map((r) => String(r.tablename))
  const base = await dump(query, tables, new Map(), [])
  return { db, query, tables, base }
}

function engine() {
  if (!instance) instance = boot().catch((e) => { instance = null; throw e })
  return instance
}

async function dump(query: DemoScope['query'], tables: string[], storage: DemoScope['storage'], log: DemoLogEntry[]): Promise<DemoState> {
  const sel = tables.map((t) => `'${t}', (select coalesce(json_agg(t), '[]'::json) from public."${t}" t)`).join(', ')
  const r = await query(`select json_build_object(${sel}) as s`)
  return {
    v: 1,
    created: new Date().toISOString(),
    tables: r.rows[0].s as DemoState['tables'],
    storage: Object.fromEntries([...storage].map(([k, v]) => [k, { type: v.type, b64: v.data.toString('base64') }])),
    log: log.slice(-200),
  }
}

export async function insertRows(query: DemoScope['query'], table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const keys = new Set<string>()
  for (const r of rows) Object.keys(r).forEach((k) => keys.add(k))
  await ensureColumns(query, table, Object.fromEntries([...keys].map((k) => [k, rows.find((r) => r[k] !== null && r[k] !== undefined)?.[k] ?? null])))
  const cols = await columns(query, table)
  const list = [...keys].filter((k) => cols.has(k) && !cols.get(k)!.generated).map((k) => `"${k}"`).join(', ')
  await query(`insert into public."${table}" (${list}) select ${list} from json_populate_recordset(null::public."${table}", $1::json)`, [JSON.stringify(rows)])
}

async function restore(query: DemoScope['query'], tables: string[], state: DemoState) {
  await query(`set session_replication_role = replica`)
  try {
    await query(`truncate ${tables.map((t) => `public."${t}"`).join(', ')} cascade`)
    for (const t of tables) await insertRows(query, t, state.tables[t] || [])
  } finally {
    await query(`set session_replication_role = origin`)
  }
}

/** Builds a new session's fictional data, using the real care functions where the data comes from them. */
async function seed(e: Awaited<ReturnType<typeof engine>>, scope: DemoScope, after: (scope: DemoScope) => Promise<void>) {
  await restore(e.query, e.tables, e.base)
  await e.query(`set session_replication_role = replica`)
  try {
    for (const [t, rows] of Object.entries({ ...adminRows(), ...careRows() })) await insertRows(e.query, t, rows)
  } finally {
    await e.query(`set session_replication_role = origin`)
  }
  await e.query(`update care_task_presets set confirmed_at = now() - interval '20 days', confirmed_by = 'admin' where not (key = any($1::text[]))`, [UNCONFIRMED_PRESETS])
  for (const [k, f] of Object.entries(DEMO_FILES)) scope.storage.set(k, { type: f.type, data: f.data() })
  await demoScope.run(scope, () => after(scope))
}

let queue: Promise<unknown> = Promise.resolve()

/**
 * Runs `fn` against the session's demo data inside the demo scope and returns
 * its result with the session's updated state. `seedWork` adds the parts of a
 * new session that go through the real care functions.
 */
export async function withDemo<T>(state: DemoState | null, fn: () => Promise<T>, seedWork: (scope: DemoScope) => Promise<void>): Promise<{ result: T; state: DemoState; fresh: boolean }> {
  const run = queue.then(async () => {
    const e = await engine()
    const scope: DemoScope = { query: e.query, storage: new Map(), log: [] }
    const fresh = !state || state.v !== 1 || !state.tables
    if (fresh) await seed(e, scope, seedWork)
    else {
      await restore(e.query, e.tables, state)
      for (const [k, v] of Object.entries(state.storage || {})) scope.storage.set(k, { type: v.type, data: Buffer.from(v.b64, 'base64') })
      scope.log.push(...(state.log || []))
    }
    const result = await demoScope.run(scope, fn)
    const next = await dump(e.query, e.tables, scope.storage, scope.log)
    if (!fresh) next.created = state!.created
    return { result, state: next, fresh }
  })
  queue = run.catch(() => {})
  return run
}

/** For tests and resets: drop the cached schema after a column was added outside the REST layer. */
export async function resetSchemaCache() {
  const e = await engine()
  forgetSchema(e.query)
}
