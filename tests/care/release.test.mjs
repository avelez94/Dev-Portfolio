/**
 * Rehearsal of the Oct 30 production database release on a local copy shaped
 * like production (the dashboard tables plus the Oct 29 migrations, Supabase's
 * roles and storage stand ins, and existing records): precheck, backup, the
 * one transaction bundle, verify, a second run (safe to repeat), the rollback
 * guard, the rollback, and applying again. Never touches a shared database.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { available, startDb, stopDb, sql, rows, one } from './pg.mjs'

const ROOT = new URL('../..', import.meta.url).pathname
const skip = available ? false : 'PostgreSQL server binaries not found (set PG_BIN to run these tests)'
const R = (f) => readFileSync(ROOT + 'supabase/release/20261030/' + f, 'utf8')
const base = readFileSync(ROOT + 'src/lib/demo/engine.ts', 'utf8').match(/const BASE_SCHEMA = `([\s\S]*?)`/)[1]

before(async () => {
  if (skip) return
  await startDb({ raw: true })
  sql(base.replace(/create table public\.demo_stripe[^;]*;/, ''))
  // Supabase stand ins: storage, an extensions schema, the default grants the lockdown removes.
  sql(`create schema storage; create table storage.buckets (id text primary key, name text, public boolean default false);
       insert into storage.buckets (id, name, public) values ('freelance-docs', 'freelance-docs', false);
       grant all on all tables in schema public to anon, authenticated;
       -- Supabase's defaults: new tables, sequences and functions in public are granted to the public roles.
       alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
       alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
       alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`)
  for (const f of readdirSync(ROOT + 'supabase/migrations').sort()) sql(readFileSync(ROOT + 'supabase/migrations/' + f, 'utf8'))
  // Existing records.
  sql(`insert into public.clients (id, name, email, business) values ('11111111-1111-4111-8111-111111111111', 'Existing Client', 'client@example.com', 'Existing Co');
       insert into public.pricing (name, price, description) values ('Landing Page', '$1,500', 'kept'), ('Deposit', '50%', 'kept'), ('Hosting', '$20', 'untouched');
       insert into public.invoices (client_id, invoice_number, amount, status, notes) values ('11111111-1111-4111-8111-111111111111', 'INV-1', 100, 'paid', 'contract_id:abc');`)
}, { timeout: 120000 })
after(() => { if (!skip) stopDb() })

test('precheck reads only and shows no care objects yet', { skip }, () => {
  const before = sql('select count(*) from information_schema.tables where table_schema = \'public\'')
  sql(R('01_precheck.sql'))
  assert.equal(sql('select count(*) from information_schema.tables where table_schema = \'public\''), before)
  assert.equal(rows(`select table_name from information_schema.tables where table_schema = 'public' and table_name like 'care\\_%'`).length, 0)
})

test('backup, then the one transaction bundle applies every migration and existing data is unchanged except the pricing names', { skip }, () => {
  sql(R('02_backup.sql'))
  assert.equal(one('select count(*)::int n from release_backup.pricing_20261030').n, 3)
  sql(R('03_apply.sql'))
  const care = rows(`select c.relname, c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'care\\_%'`)
  assert.equal(care.length, 19)
  assert.ok(care.every((t) => t.rls))
  assert.deepEqual(rows(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relname like 'care\\_%' and relkind = 'r' and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))`), [], 'no public access to any care table')
  assert.deepEqual(rows(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'care\\_%' and has_function_privilege('anon', p.oid, 'execute')`), [], 'care functions are server only')
  assert.deepEqual(rows(`select id, public from storage.buckets order by id`), [{ id: 'care-agreements', public: false }, { id: 'care-evidence', public: false }, { id: 'care-reports', public: false }, { id: 'freelance-docs', public: false }])
  assert.deepEqual(rows(`select name, price, description from public.pricing order by price`), [{ name: 'Business Website', price: '$1,500', description: 'kept' }, { name: 'Hosting', price: '$20', description: 'untouched' }, { name: 'Project Payments', price: '50%', description: 'kept' }])
  assert.equal(one(`select count(*)::int n from public.clients`).n, 1)
  assert.equal(one(`select count(*)::int n from public.invoices`).n, 1)
  // Verify runs and every count is the same.
  sql(R('04_verify.sql'))
  assert.ok(rows(`select 1 from release_backup.counts_20261030`).length === 8)
  assert.deepEqual(one(`select (select count(*) from care_sites)::int s, (select count(*) from care_agreements)::int a`), { s: 0, a: 0 }, 'no fixtures or client records were loaded')
})

test('running the bundle again changes nothing', { skip }, () => {
  const presets = one('select count(*)::int n from care_task_presets').n
  sql(R('03_apply.sql'))
  assert.equal(one('select count(*)::int n from care_task_presets').n, presets)
  assert.equal(one('select count(*)::int n from care_settings').n, 1)
})

test('rollback refuses while care holds client records, then restores the previous state, and the release applies again', { skip }, () => {
  sql(`insert into care_sites (client_id, label, site_url, approved_domains, plan) values ('11111111-1111-4111-8111-111111111111', 'Site', 'https://example.com/', '{example.com}', 'business')`)
  assert.throws(() => sql(R('99_rollback.sql')), /enrolled website or agreement records/)
  assert.equal(rows(`select 1 from information_schema.tables where table_name = 'care_sites'`).length, 1, 'nothing was dropped')
  sql(`delete from care_sites`)
  sql(R('99_rollback.sql'))
  assert.equal(rows(`select table_name from information_schema.tables where table_schema = 'public' and table_name like 'care\\_%'`).length, 0)
  assert.deepEqual(rows(`select name from public.pricing order by price`).map((r) => r.name), ['Landing Page', 'Hosting', 'Deposit'])
  assert.equal(one(`select count(*)::int n from public.invoices`).n, 1)
  sql(R('03_apply.sql'))
  assert.equal(rows(`select 1 from information_schema.tables where table_schema = 'public' and table_name like 'care\\_%'`).length, 19)
})
