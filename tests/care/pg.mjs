/**
 * A throwaway local PostgreSQL for the Website Care database tests. It starts
 * a fresh cluster in a temporary folder, applies the pending care migrations,
 * and is deleted afterwards. It never connects to the shared database.
 *
 * Needs PostgreSQL 14+ server binaries (initdb, pg_ctl) and psql. Set
 * PG_BIN to their folder if they aren't found automatically. When none are
 * installed, the database tests are skipped with a message.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
const MIGRATIONS = ['supabase/pending/website-care/20261030_website_care.sql', 'supabase/pending/website-care/20261031_care_work_ledger.sql']

function findBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN
  const base = '/usr/lib/postgresql'
  if (existsSync(base)) {
    const v = readdirSync(base).sort((a, b) => Number(b) - Number(a))[0]
    if (v && existsSync(join(base, v, 'bin', 'initdb'))) return join(base, v, 'bin')
  }
  const w = spawnSync('which', ['initdb'], { encoding: 'utf8' })
  return w.status === 0 ? w.stdout.trim().replace(/\/initdb$/, '') : null
}

export const BIN = findBin()
export const available = Boolean(BIN) && spawnSync('which', ['psql']).status === 0
const PORT = String(55400 + Math.floor(Math.random() * 400))
let dir = null

// initdb refuses to run as root; use the postgres account when running as root.
const asDbUser = (cmd) => (process.getuid?.() === 0 ? spawnSync('su', ['postgres', '-c', cmd], { encoding: 'utf8' }) : spawnSync('sh', ['-c', cmd], { encoding: 'utf8' }))

export async function startDb() {
  dir = mkdtempSync(join(tmpdir(), 'care-pg-'))
  chmodSync(dir, 0o777)
  const data = join(dir, 'data')
  let r = asDbUser(`${BIN}/initdb -D ${data} -A trust -U postgres >/dev/null`)
  if (r.status !== 0) throw new Error('initdb failed: ' + r.stderr)
  r = asDbUser(`${BIN}/pg_ctl -D ${data} -o "-p ${PORT} -k ${dir} -c listen_addresses=''" -l ${dir}/log -w start >/dev/null`)
  if (r.status !== 0) throw new Error('pg_ctl start failed: ' + r.stderr + readFileSync(join(dir, 'log'), 'utf8'))
  // Stand ins for what Supabase provides, plus the existing tables the care migration references.
  sql(`create role anon; create role authenticated; create role service_role;
       create table public.clients (id uuid primary key default gen_random_uuid(), name text, email text, business text);
       create table public.invoices (id uuid primary key default gen_random_uuid(), client_id uuid, invoice_number text, invoice_type text,
         total_fee numeric, deposit_amount numeric, amount numeric, due_date date, service_desc text, status text, created_at timestamptz default now());`)
  for (const m of MIGRATIONS) sql(readFileSync(join(ROOT, m), 'utf8'))
}

export function stopDb() {
  if (!dir) return
  asDbUser(`${BIN}/pg_ctl -D ${join(dir, 'data')} -m immediate stop >/dev/null`)
  rmSync(dir, { recursive: true, force: true })
}

const args = () => ['-h', dir, '-p', PORT, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-At']

/** Runs SQL and returns stdout; throws with the database error message on failure. */
export function sql(text) {
  const r = spawnSync('psql', args(), { input: text, encoding: 'utf8' })
  if (r.status !== 0) {
    const e = new Error((r.stderr || '').replace(/^psql:[^:]*:\d+: /gm, '').trim())
    e.db = true
    throw e
  }
  return r.stdout.trim()
}

/** Returns the rows of a query as objects. */
export const rows = (q) => JSON.parse(sql(`with t as (${q}) select coalesce(json_agg(t), '[]') from t`) || '[]')
export const one = (q) => rows(q)[0]
/** Runs a function returning jsonb and parses it. */
export const call = (expr) => JSON.parse(sql(`select (${expr})::text`))

/** Runs several statements at the same moment, each in its own connection. */
export function concurrently(statements) {
  return Promise.all(statements.map((text) => new Promise((resolve) => {
    const p = spawn('psql', args(), { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolve({ ok: code === 0, out: out.trim(), err: err.trim() }))
    p.stdin.end(text)
  })))
}

export const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
export const j = (v) => `${q(JSON.stringify(v))}::jsonb`
