/**
 * A local stand-in for the Supabase REST (PostgREST) and storage APIs, backed
 * by the demo database. It covers what the admin dashboard and the Website
 * Care server code use: select with columns and embedded tables (to one, to
 * many, !inner, filters on embedded columns), eq/neq/gt/gte/lt/lte/like/ilike/
 * is/in/cs filters with not and or/and groups, order, limit, offset, counts,
 * single object responses, insert and upsert, update, delete, rpc, and storage
 * upload, download, list, and remove.
 *
 * Demo only. Tables gain any column a request names that the demo schema
 * lacks, so the fictional data never fails on a column added in production.
 */
import 'server-only'
import type { DemoScope } from './context'

type Q = DemoScope['query']
export type Reply = { status: number; headers?: Record<string, string>; body?: string | Buffer }

const json = (status: number, data: unknown, headers: Record<string, string> = {}): Reply => ({ status, headers: { 'content-type': 'application/json', ...headers }, body: data === undefined ? '' : JSON.stringify(data) })

export class RestError extends Error {
  constructor(public status: number, message: string, public code = 'PGRST100') { super(message) }
}

const IDENT = /^[a-z_][a-z0-9_]*$/i
function ident(s: string) {
  if (!IDENT.test(s)) throw new RestError(400, `bad identifier ${s}`)
  return `"${s}"`
}
const lit = (v: unknown) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

/* ----------------------------- schema cache ----------------------------- */

type Col = { name: string; type: string; generated: boolean }
const schemaCache = new WeakMap<Q, Map<string, Map<string, Col>>>()

export async function columns(q: Q, table: string): Promise<Map<string, Col>> {
  let all = schemaCache.get(q)
  if (!all) schemaCache.set(q, (all = new Map()))
  if (!all.has(table)) {
    const r = await q(`select column_name as name, data_type as type, is_generated = 'ALWAYS' as generated from information_schema.columns where table_schema = 'public' and table_name = $1`, [table])
    if (!r.rows.length) throw new RestError(404, `relation "public.${table}" does not exist`, '42P01')
    all.set(table, new Map(r.rows.map((c) => [String(c.name), { name: String(c.name), type: String(c.type), generated: !!c.generated }])))
  }
  return all.get(table)!
}

export function forgetSchema(q: Q) {
  schemaCache.delete(q)
}

function inferType(v: unknown) {
  if (typeof v === 'number') return 'numeric'
  if (typeof v === 'boolean') return 'boolean'
  if (v && typeof v === 'object') return 'jsonb'
  return 'text'
}

/** Adds any missing columns, typed from a sample value. */
export async function ensureColumns(q: Q, table: string, sample: Record<string, unknown>) {
  const cols = await columns(q, table)
  const missing = Object.keys(sample).filter((k) => !cols.has(k) && IDENT.test(k))
  if (!missing.length) return
  for (const k of missing) await q(`alter table public.${ident(table)} add column if not exists ${ident(k)} ${inferType(sample[k])}`)
  schemaCache.get(q)?.delete(table)
}

/* ------------------------------- filters ------------------------------- */

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and', 'not.or', 'not.and'])

function colRef(alias: string, col: string) {
  // JSON paths: evidence->>screenshot, details->a->>b
  const m = col.match(/^([a-z_][a-z0-9_]*)((?:->>?[a-z0-9_]+)*)$/i)
  if (!m) throw new RestError(400, `bad column ${col}`)
  const path = (m[2].match(/->>?[a-z0-9_]+/gi) || []).map((p) => (p.startsWith('->>') ? `->>${lit(p.slice(3))}` : `->${lit(p.slice(2))}`)).join('')
  return { sql: `${alias}.${ident(m[1])}${path}`, base: m[1] }
}

function unquote(v: string) {
  return v.length > 1 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"') : v
}

function listItems(v: string) {
  const inner = v.replace(/^\(|\)$/g, '')
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of inner) {
    if (ch === '"') quoted = !quoted
    if (ch === ',' && !quoted) { out.push(unquote(cur)); cur = '' } else cur += ch
  }
  if (cur !== '' || inner.endsWith(',')) out.push(unquote(cur))
  return out
}

function condition(alias: string, col: string, raw: string): string {
  let r = raw
  let neg = false
  if (r.startsWith('not.')) { neg = true; r = r.slice(4) }
  const i = r.indexOf('.')
  if (i < 0) throw new RestError(400, `bad filter ${col}=${raw}`)
  const op = r.slice(0, i)
  const val = r.slice(i + 1)
  const c = colRef(alias, col).sql
  let s: string
  if (op === 'is') s = `${c} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : val === 'false' ? 'false' : 'unknown'}`
  else if (op === 'in') {
    const items = listItems(val)
    s = items.length ? `${c}::text in (${items.map(lit).join(',')})` : 'false'
  } else if (op === 'like' || op === 'ilike') s = `${c}::text ${op} ${lit(val.replace(/\*/g, '%'))}`
  else if (op === 'cs') s = val.startsWith('{') ? `${c} @> ${lit(val)}` : `${c}::jsonb @> ${lit(val)}::jsonb`
  else {
    const ops: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
    if (!ops[op]) throw new RestError(400, `unsupported filter ${op}`)
    s = `${c} ${ops[op]} ${lit(unquote(val))}`
  }
  return neg ? `not (${s})` : s
}

function splitTop(s: string) {
  const out: string[] = []
  let depth = 0
  let cur = ''
  let quoted = false
  for (const ch of s) {
    if (ch === '"') quoted = !quoted
    if (!quoted && ch === '(') depth++
    if (!quoted && ch === ')') depth--
    if (ch === ',' && depth === 0 && !quoted) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** or=(a.eq.1,and(b.eq.2,c.is.null)) */
function logic(alias: string, kind: 'or' | 'and', body: string): string {
  const parts = splitTop(body.replace(/^\(/, '').replace(/\)$/, '')).map((p) => {
    const g = p.match(/^(not\.)?(or|and)\((.*)\)$/)
    if (g) { const inner = logic(alias, g[2] as 'or' | 'and', `(${g[3]})`); return g[1] ? `not ${inner}` : inner }
    const dot = p.indexOf('.')
    return condition(alias, p.slice(0, dot), p.slice(dot + 1))
  })
  return `(${parts.join(kind === 'or' ? ' or ' : ' and ')})`
}

/* -------------------------------- select -------------------------------- */

type Embed = { alias: string; target: string; inner: boolean; cols: string; on: string; many: boolean }

const fkCache = new WeakMap<Q, Map<string, { col: string; refCol: string } | null>>()
async function fk(q: Q, from: string, to: string) {
  let m = fkCache.get(q)
  if (!m) fkCache.set(q, (m = new Map()))
  const k = `${from}>${to}`
  if (!m.has(k)) {
    const r = await q(`select a.attname as col, b.attname as ref from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_attribute b on b.attrelid = c.confrelid and b.attnum = c.confkey[1]
      where c.contype = 'f' and c.conrelid = ('public.' || $1)::regclass and c.confrelid = ('public.' || $2)::regclass limit 1`, [from, to])
    m.set(k, r.rows[0] ? { col: String(r.rows[0].col), refCol: String(r.rows[0].ref) } : null)
  }
  return m.get(k)!
}

async function embedOf(q: Q, table: string, part: string): Promise<Embed | null> {
  const m = part.match(/^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)(!inner|!left)?\((.*)\)$/i)
  if (!m) return null
  const [, alias, target, hint, cols] = m
  const one = await fk(q, table, target)
  if (one) return { alias: alias || target, target, inner: hint === '!inner', cols, many: false, on: `x.${ident(one.refCol)} = t.${ident(one.col)}` }
  const many = await fk(q, target, table)
  if (many) return { alias: alias || target, target, inner: hint === '!inner', cols, many: true, on: `x.${ident(many.col)} = t.${ident(many.refCol)}` }
  throw new RestError(400, `Could not find a relationship between '${table}' and '${target}'`, 'PGRST200')
}

async function columnList(q: Q, table: string, cols: string, alias: string) {
  const known = await columns(q, table)
  const out: string[] = []
  for (const raw of splitTop(cols || '*')) {
    if (raw === '*') { out.push(`${alias}.*`); continue }
    const m = raw.match(/^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*(?:->>?[a-z0-9_]+)*)(?:::([a-z]+))?$/i)
    if (!m) throw new RestError(400, `bad select ${raw}`)
    const ref = colRef(alias, m[2])
    if (!known.has(ref.base)) {
      await ensureColumns(q, table, { [ref.base]: null })
      known.set(ref.base, { name: ref.base, type: 'text', generated: false })
    }
    const name = m[1] || m[2].split(/->>?/).pop()!
    out.push(`${ref.sql}${m[3] ? '::' + m[3] : ''} as ${ident(name)}`)
  }
  return out
}

async function selectSql(q: Q, table: string, params: URLSearchParams, opts: { count?: boolean } = {}) {
  const parts = splitTop(params.get('select') || '*')
  const cols: string[] = []
  const embeds: Embed[] = []
  for (const p of parts) {
    const e = await embedOf(q, table, p)
    if (e) embeds.push(e)
    else cols.push(...(await columnList(q, table, p, 't')))
  }
  for (const e of embeds) {
    const ic = (await columnList(q, e.target, e.cols, 'x')).join(', ')
    const filters = [...params].filter(([k]) => k.startsWith(e.target + '.') || k.startsWith(e.alias + '.')).map(([k, v]) => condition('x', k.split('.').slice(1).join('.'), v))
    const where = [e.on, ...filters].join(' and ')
    cols.push(e.many
      ? `coalesce((select json_agg(y) from (select ${ic} from public.${ident(e.target)} x where ${where}) y), '[]'::json) as ${ident(e.alias)}`
      : `(select to_json(y) from (select ${ic} from public.${ident(e.target)} x where ${where}) y) as ${ident(e.alias)}`)
  }
  const where = whereSql(params, embeds)
  for (const e of embeds.filter((x) => x.inner)) {
    const filters = [...params].filter(([k]) => k.startsWith(e.target + '.') || k.startsWith(e.alias + '.')).map(([k, v]) => condition('x', k.split('.').slice(1).join('.'), v))
    where.push(`exists (select 1 from public.${ident(e.target)} x where ${[e.on, ...filters].join(' and ')})`)
  }
  const w = where.length ? ' where ' + where.join(' and ') : ''
  const order = params.get('order')
  const orderSql = order ? ' order by ' + order.split(',').map((o) => {
    const [col, dir, nulls] = o.split('.')
    return `${colRef('t', col).sql} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`
  }).join(', ') : ''
  const limit = params.get('limit') ? ` limit ${Number(params.get('limit'))}` : ''
  const offset = params.get('offset') ? ` offset ${Number(params.get('offset'))}` : ''
  return {
    rows: `select ${cols.join(', ')} from public.${ident(table)} t${w}${orderSql}${limit}${offset}`,
    count: opts.count ? `select count(*)::int as n from public.${ident(table)} t${w}` : null,
  }
}

function whereSql(params: URLSearchParams, embeds: Embed[] = []) {
  const where: string[] = []
  for (const [k, v] of params) {
    if (k === 'or' || k === 'and') { where.push(logic('t', k, v)); continue }
    if (k === 'not.or' || k === 'not.and') { where.push(`not ${logic('t', k.slice(4) as 'or' | 'and', v)}`); continue }
    if (RESERVED.has(k)) continue
    if (k.includes('.') && !k.includes('->')) {
      const [target] = k.split('.')
      if (embeds.some((e) => e.target === target || e.alias === target)) continue // applied inside the embed
    }
    where.push(condition('t', k, v))
  }
  return where
}

/* --------------------------------- rest --------------------------------- */

async function rowsOf(q: Q, text: string) {
  const r = await q(`select coalesce(json_agg(r), '[]'::json) as rows from (${text}) r`)
  return (r.rows[0]?.rows || []) as Record<string, unknown>[]
}
async function rowsOfMod(q: Q, text: string, params: unknown[]) {
  const r = await q(`with r as (${text}) select coalesce(json_agg(r), '[]'::json) as rows from r`, params)
  return (r.rows[0]?.rows || []) as Record<string, unknown>[]
}

function pgError(e: unknown): Reply {
  const err = e as { message?: string; code?: string; detail?: string; hint?: string }
  if (e instanceof RestError) return json(e.status, { message: e.message, code: e.code, details: null, hint: null })
  const code = err.code || 'P0001'
  const status = code === '23505' || code === '23503' ? 409 : code === '42501' ? 403 : code === '42P01' || code === '42883' ? 404 : 400
  return json(status, { message: String(err.message || e), code, details: err.detail ?? null, hint: err.hint ?? null })
}

export async function rest(scope: DemoScope, method: string, parts: string[], params: URLSearchParams, headers: Headers, raw: Buffer): Promise<Reply> {
  const q = scope.query
  const accept = headers.get('accept') || ''
  const prefer = headers.get('prefer') || ''
  const single = accept.includes('vnd.pgrst.object')
  const wantCount = /count=(exact|planned|estimated)/.test(prefer)
  const reply = (rows: Record<string, unknown>[], status = 200, extra: Record<string, string> = {}) => {
    if (single) {
      if (rows.length !== 1) return json(406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' })
      return json(status, rows[0], extra)
    }
    return json(status, rows, extra)
  }
  try {
    if (parts[0] === 'rpc') return await rpc(q, parts[1], raw, single)
    const table = parts[0]
    await columns(q, table)
    if (method === 'GET' || method === 'HEAD') {
      const s = await selectSql(q, table, params, { count: wantCount })
      const rows = await rowsOf(q, s.rows)
      const extra: Record<string, string> = {}
      if (s.count) {
        const n = Number((await q(s.count)).rows[0]?.n || 0)
        const from = Number(params.get('offset') || 0)
        extra['content-range'] = rows.length ? `${from}-${from + rows.length - 1}/${n}` : `*/${n}`
      }
      if (method === 'HEAD') return { status: 200, headers: { 'content-type': 'application/json', ...extra }, body: '' }
      return reply(rows, 200, extra)
    }
    const body = raw.length ? JSON.parse(raw.toString('utf8')) : null
    const ret = prefer.includes('return=representation')
    const known = await columns(q, table)
    if (method === 'POST') {
      const list: Record<string, unknown>[] = Array.isArray(body) ? body : [body]
      const out: Record<string, unknown>[] = []
      const conflict = params.get('on_conflict')
      const merge = prefer.includes('resolution=merge-duplicates') || !!conflict
      const ignore = prefer.includes('resolution=ignore-duplicates')
      for (const row of list) {
        await ensureColumns(q, table, row)
        const keys = Object.keys(row).filter((k) => !known.get(k)?.generated)
        const target = conflict ? conflict.split(',').map(ident).join(', ') : '"id"'
        let text = keys.length
          ? `insert into public.${ident(table)} (${keys.map(ident).join(', ')}) select ${keys.map(ident).join(', ')} from json_populate_record(null::public.${ident(table)}, $1::json)`
          : `insert into public.${ident(table)} default values`
        if (ignore) text += ` on conflict (${target}) do nothing`
        else if (merge && keys.length) text += ` on conflict (${target}) do update set ${keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ')}`
        out.push(...(await rowsOfMod(q, text + ' returning *', keys.length ? [JSON.stringify(row)] : [])))
      }
      if (!ret) return { status: 201, headers: {}, body: '' }
      const sel = params.get('select')
      if (!sel || sel === '*') return reply(out, 201)
      const ids = out.map((r) => r.id).filter(Boolean)
      const p = new URLSearchParams({ select: sel, id: `in.(${ids.join(',')})` })
      return reply(await rowsOf(q, (await selectSql(q, table, p)).rows), 201)
    }
    if (method === 'PATCH') {
      await ensureColumns(q, table, body || {})
      const keys = Object.keys(body || {}).filter((k) => !known.get(k)?.generated)
      if (!keys.length) return reply([])
      const w = whereSql(params)
      const text = `update public.${ident(table)} t set (${keys.map(ident).join(', ')}) = (select ${keys.map(ident).join(', ')} from json_populate_record(null::public.${ident(table)}, $1::json))${w.length ? ' where ' + w.join(' and ') : ''} returning t.*`
      const rows = await rowsOfMod(q, text, [JSON.stringify(body)])
      if (!ret) return { status: 204, headers: {}, body: '' }
      const sel = params.get('select')
      if (!sel || sel === '*') return reply(rows)
      const p = new URLSearchParams({ select: sel, id: `in.(${rows.map((r) => r.id).join(',')})` })
      return reply(await rowsOf(q, (await selectSql(q, table, p)).rows))
    }
    if (method === 'DELETE') {
      const w = whereSql(params)
      const rows = await rowsOfMod(q, `delete from public.${ident(table)} t${w.length ? ' where ' + w.join(' and ') : ''} returning t.*`, [])
      return ret ? reply(rows) : { status: 204, headers: {}, body: '' }
    }
    return json(405, { message: 'method not allowed' })
  } catch (e) {
    return pgError(e)
  }
}

async function rpc(q: Q, fn: string, raw: Buffer, single: boolean): Promise<Reply> {
  if (!IDENT.test(fn)) throw new RestError(404, 'not found')
  const args: Record<string, unknown> = raw.length ? JSON.parse(raw.toString('utf8')) : {}
  const info = (await q(`select proretset as set, prorettype::regtype::text as type,
      (select json_object_agg(n, t::regtype::text) from unnest(proargnames[1:pronargs], proargtypes::oid[]) as a(n, t)) as args
    from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace limit 1`, [fn])).rows[0] as { set: boolean; type: string; args: Record<string, string> | null } | undefined
  if (!info) return json(404, { message: `Could not find the function public.${fn}`, code: 'PGRST202', details: null, hint: null })
  const values: unknown[] = []
  const named = Object.entries(args).map(([k, v]) => {
    const t = info.args?.[k] || 'text'
    if (v === null || v === undefined) return `${ident(k)} => null::${t}`
    values.push(t === 'jsonb' || t === 'json' || t.endsWith('[]') ? JSON.stringify(v) : String(v))
    const p = `$${values.length}`
    if (t.endsWith('[]')) return `${ident(k)} => (select coalesce(array_agg(x), '{}') from json_array_elements_text(${p}::json) x)::${t}`
    return `${ident(k)} => ${p}::${t}`
  }).join(', ')
  try {
    if (info.set || info.type === 'record') {
      const rows = (await q(`select coalesce(json_agg(r), '[]'::json) as rows from public.${ident(fn)}(${named}) r`, values)).rows[0]?.rows as Record<string, unknown>[]
      if (single) return rows.length === 1 ? json(200, rows[0]) : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null })
      return json(200, rows)
    }
    const v = (await q(`select to_json(public.${ident(fn)}(${named})) as v`, values)).rows[0]?.v
    return json(200, v ?? null)
  } catch (e) {
    return pgError(e)
  }
}

/* -------------------------------- storage ------------------------------- */

const MAX_OBJECT = 1_500_000

export async function storage(scope: DemoScope, method: string, parts: string[], headers: Headers, raw: Buffer): Promise<Reply> {
  // parts: object/<bucket>/<path...> | object/authenticated/<bucket>/<path...> | object/list/<bucket>
  if (parts[0] !== 'object') return json(404, { message: 'Not found' })
  let rest = parts.slice(1)
  if (rest[0] === 'authenticated' || rest[0] === 'public') rest = rest.slice(1)
  if (rest[0] === 'list') {
    const bucket = rest[1]
    const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
    const prefix = `${bucket}/${body.prefix ? String(body.prefix).replace(/\/?$/, '/') : ''}`
    const names = [...scope.storage.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).filter((k) => !k.includes('/'))
    return json(200, names.map((name) => ({ name, id: name, metadata: { size: scope.storage.get(prefix + name)?.data.length || 0 } })))
  }
  const bucket = rest[0]
  const key = `${bucket}/${rest.slice(1).map(decodeURIComponent).join('/')}`
  if (method === 'GET' || method === 'HEAD') {
    const f = scope.storage.get(key)
    if (!f) return json(404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    return { status: 200, headers: { 'content-type': f.type }, body: method === 'HEAD' ? '' : f.data }
  }
  if (method === 'POST' || method === 'PUT') {
    let data = raw
    let type = headers.get('content-type') || 'application/octet-stream'
    if (type.startsWith('multipart/form-data')) {
      const form = await new Request('http://demo.local', { method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(raw) }).formData()
      const file = [...form.values()].find((v): v is File => typeof v !== 'string')
      data = file ? Buffer.from(await file.arrayBuffer()) : Buffer.alloc(0)
      type = file?.type || 'application/octet-stream'
    }
    if (scope.storage.has(key) && method === 'POST' && headers.get('x-upsert') !== 'true') return json(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
    // Large files keep their name and size; the demo serves a short placeholder instead.
    scope.storage.set(key, data.length > MAX_OBJECT ? { type: 'text/plain', data: Buffer.from(`Demo placeholder: the original file was ${data.length} bytes.`) } : { type, data })
    return json(200, { Key: key, Id: key })
  }
  if (method === 'DELETE') {
    const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
    const removed: { name: string }[] = []
    for (const p of body.prefixes || []) if (scope.storage.delete(`${bucket}/${p}`)) removed.push({ name: p })
    return json(200, removed)
  }
  return json(405, { message: 'method not allowed' })
}
