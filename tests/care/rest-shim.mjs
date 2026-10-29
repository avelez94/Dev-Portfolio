/**
 * A small local stand-in for the Supabase REST API (PostgREST), enough for
 * the Website Care server code to run end to end against the throwaway
 * PostgreSQL from pg.mjs. Test infrastructure only: it trusts its input and
 * listens on localhost.
 *
 * Supports: select with columns and one level of embedded to-one tables
 * (including !inner with a filter), eq/neq/gt/gte/lt/lte/is/in filters,
 * order, limit, single object responses, insert (with upsert), update,
 * delete, and rpc calls. Storage requests are accepted and kept in memory.
 */
import { createServer } from 'node:http'
import { sql } from './pg.mjs'

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error('bad identifier ' + s)
  return `"${s}"`
}
const lit = (v) => (v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const jlit = (o) => {
  const tag = '$j' + Math.random().toString(36).slice(2, 8) + '$'
  return `${tag}${JSON.stringify(o)}${tag}`
}

const fkCache = new Map()
function fkColumn(base, target) {
  const k = base + '>' + target
  if (!fkCache.has(k)) {
    const col = sql(`select a.attname from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.conrelid = 'public.${base}'::regclass and c.confrelid = 'public.${target}'::regclass limit 1`)
    if (!col) throw new Error(`no relation from ${base} to ${target}`)
    fkCache.set(k, col)
  }
  return fkCache.get(k)
}

function splitTop(s) {
  const out = []; let depth = 0; let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function condition(alias, col, raw) {
  const neg = raw.startsWith('not.')
  const r = neg ? raw.slice(4) : raw
  const i = r.indexOf('.')
  const op = r.slice(0, i)
  const val = decodeURIComponent(r.slice(i + 1))
  const c = `${alias}.${ident(col)}`
  let s
  if (op === 'is') s = `${c} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`
  else if (op === 'in') s = `${c}::text in (${val.replace(/^\(|\)$/g, '').split(',').map((x) => lit(x.replace(/^"|"$/g, ''))).join(',') || "''"})`
  else {
    const ops = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
    if (!ops[op]) throw new Error('unsupported filter ' + op)
    s = `${c} ${ops[op]} ${lit(val)}`
  }
  return neg ? `not (${s})` : s
}

/** or=(a.eq.1,and(b.eq.2,c.is.null)) */
function logic(alias, kind, body) {
  const parts = splitTop(body.replace(/^\(/, '').replace(/\)$/, '')).map((p) => {
    const g = p.match(/^(not\.)?(or|and)\((.*)\)$/)
    if (g) { const inner = logic(alias, g[2], `(${g[3]})`); return g[1] ? `not ${inner}` : inner }
    const dot = p.indexOf('.')
    return condition(alias, p.slice(0, dot), p.slice(dot + 1))
  })
  return `(${parts.join(kind === 'or' ? ' or ' : ' and ')})`
}

function selectSql(table, params) {
  const select = params.get('select') || '*'
  const cols = []
  const joins = []
  for (const part of splitTop(select)) {
    const m = part.match(/^([a-z_]+)(!inner)?\((.*)\)$/i)
    if (m) {
      const [, target, inner, inner_cols] = m
      const fk = fkColumn(table, target)
      const ic = inner_cols.trim() === '*' ? 'x.*' : splitTop(inner_cols).map((c) => `x.${ident(c)}`).join(', ')
      cols.push(`(select to_json(y) from (select ${ic} from public.${ident(target)} x where x.id = t.${ident(fk)}) y) as ${ident(target)}`)
      joins.push({ target, fk, inner: !!inner })
    } else cols.push(part === '*' ? 't.*' : `t.${ident(part)}`)
  }
  const where = []
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    if (k === 'or' || k === 'and') { where.push(logic('t', k, v)); continue }
    if (k.includes('.')) {
      const [target, col] = k.split('.')
      const j = joins.find((x) => x.target === target)
      where.push(`exists (select 1 from public.${ident(target)} x where x.id = t.${ident(j.fk)} and ${condition('x', col, v)})`)
    } else where.push(condition('t', k, v))
  }
  for (const j of joins.filter((x) => x.inner)) where.push(`exists (select 1 from public.${ident(j.target)} x where x.id = t.${ident(j.fk)})`)
  const order = params.get('order')
  const orderSql = order ? ' order by ' + order.split(',').map((o) => {
    const [col, dir, nulls] = o.split('.')
    return `t.${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`
  }).join(', ') : ''
  const limit = params.get('limit') ? ` limit ${Number(params.get('limit'))}` : ''
  return `select ${cols.join(', ')} from public.${ident(table)} t${where.length ? ' where ' + where.join(' and ') : ''}${orderSql}${limit}`
}

const whereOnly = (params) => {
  const w = []
  for (const [k, v] of params) if (!['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) w.push(condition('t', k, v))
  return w.length ? ' where ' + w.join(' and ') : ''
}

function pgError(e) {
  const msg = e.message.replace(/^ERROR:\s+/m, '').split('\n')[0]
  const code = (msg.match(/^(\w+):/) || [])[1]
  return { status: 400, body: { message: msg, code: /unique/.test(msg) ? '23505' : 'P0001', details: null, hint: null, _raw: code } }
}

export function startRestShim(port) {
  const storage = new Map()
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const chunks = []
    for await (const c of req) chunks.push(c)
    const raw = Buffer.concat(chunks)
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers })
      res.end(body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
    }
    try {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'storage') {
        const key = parts.slice(3).join('/')
        if (req.method === 'GET') return storage.has(key) ? send(200, storage.get(key), { 'content-type': 'application/octet-stream' }) : send(404, { message: 'Object not found' })
        if (req.method === 'POST' || req.method === 'PUT') { storage.set(key, raw); return send(200, { Key: key }) }
        return send(200, [])
      }
      if (parts[0] !== 'rest' || parts[1] !== 'v1') return send(404, { message: 'not found' })
      const accept = req.headers.accept || ''
      const prefer = req.headers.prefer || ''
      const single = accept.includes('vnd.pgrst.object')
      const reply = (rows, status = 200) => {
        if (single) {
          if (rows.length !== 1) return send(406, { code: 'PGRST116', details: `Results contain ${rows.length} rows, application/vnd.pgrst.object+json requires 1 row`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' })
          return send(status, rows[0])
        }
        return send(status, rows)
      }
      const rowsOf = (q) => JSON.parse(sql(`select coalesce(json_agg(r), '[]') from (${q}) r`) || '[]')
      const rowsOfMod = (q) => JSON.parse(sql(`with r as (${q}) select coalesce(json_agg(r), '[]') from r`) || '[]')

      if (parts[2] === 'rpc') {
        const fn = parts[3]
        const args = raw.length ? JSON.parse(raw.toString()) : {}
        const info = JSON.parse(sql(`select json_build_object('set', proretset, 'type', prorettype::regtype::text,
            'args', (select json_object_agg(n, t::regtype::text) from unnest(proargnames[1:pronargs], proargtypes::oid[]) as a(n, t)))
          from pg_proc where proname = ${lit(fn)} limit 1`) || 'null')
        if (!info) return send(404, { message: `function ${fn} not found`, code: 'PGRST202' })
        // Each argument is cast to the type the function declares.
        const named = Object.entries(args).map(([k, v]) => {
          const t = info.args?.[k] || 'text'
          const val = v === null ? 'null' : t === 'jsonb' || t === 'json' ? jlit(v) : t.endsWith('[]') ? `array[${v.map(lit).join(',')}]` : lit(v)
          return `${ident(k)} => ${val}::${t}`
        }).join(', ')
        if (info.set || info.type === 'record') return send(200, rowsOf(`select * from public.${ident(fn)}(${named})`))
        const v = sql(`select to_json(public.${ident(fn)}(${named}))`)
        return send(200, v === '' ? 'null' : v)
      }

      const table = parts[2]
      const params = url.searchParams
      if (req.method === 'GET') return reply(rowsOf(selectSql(table, params)))
      const body = raw.length ? JSON.parse(raw.toString()) : null
      const ret = prefer.includes('return=representation')
      if (req.method === 'POST') {
        const list = Array.isArray(body) ? body : [body]
        const keys = [...new Set(list.flatMap((r) => Object.keys(r)))]
        let q = `insert into public.${ident(table)} (${keys.map(ident).join(', ')}) select ${keys.map(ident).join(', ')} from json_populate_recordset(null::public.${ident(table)}, ${jlit(list)})`
        const conflict = params.get('on_conflict')
        if (conflict) {
          const target = conflict.split(',').map(ident).join(', ')
          q += prefer.includes('ignore-duplicates') ? ` on conflict (${target}) do nothing` : ` on conflict (${target}) do update set ${keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ')}`
        }
        const rows = rowsOfMod(q + ' returning *')
        return ret ? reply(rows, 201) : send(201)
      }
      if (req.method === 'PATCH') {
        const keys = Object.keys(body)
        const rows = rowsOfMod(`update public.${ident(table)} t set (${keys.map(ident).join(', ')}) = (select ${keys.map(ident).join(', ')} from json_populate_record(null::public.${ident(table)}, ${jlit(body)}))${whereOnly(params)} returning t.*`)
        return ret ? reply(rows) : send(204)
      }
      if (req.method === 'DELETE') {
        const rows = rowsOfMod(`delete from public.${ident(table)} t${whereOnly(params)} returning t.*`)
        return ret ? reply(rows) : send(204)
      }
      return send(405, { message: 'method not allowed' })
    } catch (e) {
      if (e.db) { const r = pgError(e); return send(r.status, r.body) }
      console.error('rest shim', e)
      return send(500, { message: String(e.message || e) })
    }
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}
