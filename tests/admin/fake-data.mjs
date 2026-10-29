/**
 * An in-memory stand-in for the Supabase REST and storage API behind
 * /api/admin/data, installed in the browser with Playwright's page.route.
 * Nothing reaches a real database. It supports what the admin dashboard uses:
 * select (with one embedded table), eq/neq/gte/lte/in filters, order, single,
 * insert, update, delete, and storage upload/download/remove.
 *
 * Every mutating request and every other admin API call is recorded in
 * `calls`, so tests can assert exactly what would have been sent.
 */
import { randomUUID } from 'node:crypto'

const today = () => new Date().toISOString().slice(0, 10)
const days = (n) => new Date(Date.now() + n * 86400000)
const iso = (n) => days(n).toISOString()
const date = (n) => iso(n).slice(0, 10)

export function fixtures() {
  const intake1 = { id: 'in-1', name: 'Dana Booker', email: 'dana@example.com', business: 'Booker Bakery', project_type: 'Landing Page', description: 'New site', budget: '$2k', timeline: 'Soon', heard_from: 'Google', priority: null, notes: null, status: 'booked', submitted_at: iso(-3), stage: 'details' }
  const intake2 = { id: 'in-2', name: 'Lee Pending', email: 'lee@example.com', business: null, project_type: 'Web Application', description: 'An app', budget: '$5k', timeline: 'Q1', heard_from: 'Referral', priority: null, notes: null, status: 'pending', submitted_at: iso(-1), stage: 'details' }
  return {
    intake_submissions: [intake1, intake2],
    bookings: [{ id: 'bk-1', intake_id: 'in-1', scheduled_at: iso(2), zoom_join_url: null, zoom_host_url: 'https://zoom.example.com/host', status: 'scheduled' }],
    clients: [
      { id: 'cl-a', name: 'Avery Alpha', email: 'avery@example.com', business: 'Alpha Co', pipeline_stage: 'discovery_call', created_at: iso(-10), intake_id: null, booking_id: null, notes: 'Likes teal', platform: 'direct' },
      { id: 'cl-b', name: 'Blake Beta', email: 'blake@example.com', business: 'Beta LLC', pipeline_stage: 'proposal_sent', created_at: iso(-9), intake_id: null, booking_id: null, notes: null, platform: 'direct' },
      { id: 'cl-c', name: 'Casey Gamma', email: 'casey@example.com', business: null, pipeline_stage: 'active_project', created_at: iso(-8), intake_id: null, booking_id: null, notes: null, platform: 'referral' },
    ],
    availability: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: 'av-' + d, day_of_week: d, start_time: '09:00:00', end_time: '17:00:00', is_active: d > 0 && d < 6 })),
    blocked_dates: [{ id: 'bd-1', blocked_date: date(5), reason: 'Vacation' }],
    blocked_slots: [],
    projects: [
      { id: 'pr-1', client_id: 'cl-c', name: 'Gamma site', type: 'Landing Page', status: 'active', value: 3000, platform: 'referral', start_date: null, end_date: date(10), notes: null, created_at: iso(-8) },
    ],
    invoices: [
      { id: 'iv-1', project_id: null, client_id: 'cl-c', invoice_number: 'INV-OVERDUE', amount: 500, status: 'pending', invoice_type: 'fixed_fee', total_fee: 500, deposit_amount: 500, deposit_paid_date: null, hours: 0, hourly_rate: 100, service_desc: 'Fix', due_date: date(-5), paid_date: null, notes: null, created_at: iso(-20), brand_version: null },
      { id: 'iv-2', project_id: null, client_id: 'cl-c', invoice_number: 'INV-PAID', amount: 1200, status: 'paid', invoice_type: 'fixed_fee', total_fee: 1200, deposit_amount: 1200, deposit_paid_date: null, hours: 0, hourly_rate: 100, service_desc: 'Build', due_date: date(-30), paid_date: today(), notes: null, created_at: iso(-40), brand_version: null },
    ],
    invoice_milestones: [],
    documents: [{ id: 'dc-1', client_id: 'cl-a', name: 'brief.pdf', type: 'other', storage_path: 'clients/brief.pdf', created_at: iso(-2) }],
    pricing: [
      { id: 'p1', name: 'Landing page', price: '$1,500', description: 'One page', updated_at: iso(-50) },
      { id: 'p2', name: 'Booking + Payments', price: '$2,500', description: 'My own booking note', updated_at: iso(-50) },
      { id: 'p3', name: 'Deposit', price: '50%', description: 'My own deposit note', updated_at: iso(-50) },
    ],
    meetings: [],
    proposals: [{ id: 'po-1', client_name: 'Blake Beta', client_email: 'blake@example.com', client_business: 'Beta LLC', project_title: 'Beta Website', project_type: 'Landing Page', status: 'accepted', responded_at: iso(-1), total: 2000, deposit_pct: 50, payment_plan: 'standard', created_at: iso(-4) }],
    sows: [{ id: 'sw-2', proposal_id: 'po-1', project_title: 'Beta Website', line_items: [{ name: 'Launch', deliverables: 'Site live on the domain', fee: '1000', dueDate: '' }], created_at: iso(-4) }, { id: 'sw-1', project_title: 'Gamma SOW', line_items: [{ name: 'M1', deliverables: 'Design', fee: '1000', dueDate: '' }, { name: 'M2', deliverables: 'Build', fee: '1000', dueDate: '' }], created_at: iso(-6) }],
    contracts: [{ id: 'ct-1', client_name: 'Casey Gamma', client_email: 'casey@example.com', project_title: 'Gamma site', status: 'signed', signed_at: iso(-7), created_at: iso(-7) }],
  }
}

const EMBED = { bookings: { intake_submissions: 'intake_id' } }

function parseValue(v) {
  if (v === 'null') return null
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

function filterRows(rows, params) {
  let out = rows
  for (const [k, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue
    const i = raw.indexOf('.')
    const op = raw.slice(0, i)
    const val = raw.slice(i + 1)
    out = out.filter((r) => {
      const x = r[k]
      if (op === 'eq') return String(x) === String(parseValue(val)) || (val === 'null' && x == null)
      if (op === 'neq') return String(x) !== val
      if (op === 'gte') return String(x) >= val
      if (op === 'lte') return String(x) <= val
      if (op === 'gt') return String(x) > val
      if (op === 'lt') return String(x) < val
      if (op === 'is') return val === 'null' ? x == null : String(x) === val
      if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(x))
      return true
    })
  }
  return out
}

export function createFakeApi(seed = fixtures()) {
  const db = structuredClone(seed)
  const files = new Map([['clients/brief.pdf', Buffer.from('%PDF-1.4 fake')]])
  const calls = []
  let failNext = null // { match: RegExp, status }

  async function handleData(route) {
    const req = route.request()
    const url = new URL(req.url())
    const parts = url.pathname.replace(/^.*\/api\/admin\/data\//, '').split('/')
    const method = req.method()
    if (failNext && failNext.match.test(url.pathname + url.search)) {
      const s = failNext.status
      failNext = null
      return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
    }
    if (parts[0] === 'storage') {
      const rest = parts.slice(3)
      if (method === 'GET') {
        const path = rest.slice(1).map(decodeURIComponent).join('/')
        const f = files.get(path)
        return f ? route.fulfill({ status: 200, body: f, contentType: 'application/octet-stream' }) : route.fulfill({ status: 404, body: '{}' })
      }
      if (method === 'POST' || method === 'PUT') {
        const path = rest.slice(1).map(decodeURIComponent).join('/')
        files.set(path, req.postDataBuffer() || Buffer.from(''))
        calls.push({ kind: 'storage-upload', path })
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: path }) })
      }
      if (method === 'DELETE') {
        const body = JSON.parse(req.postData() || '{}')
        for (const p of body.prefixes || []) files.delete(p)
        calls.push({ kind: 'storage-delete', prefixes: body.prefixes })
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    }
    const table = parts[2]
    if (!db[table]) db[table] = []
    const params = [...url.searchParams.entries()]
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    const prefer = req.headers()['prefer'] || ''
    const reply = (rows, status = 200) => {
      if (single) {
        if (rows.length !== 1) return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'not one row' }) })
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(rows[0]) })
      }
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(rows) })
    }
    if (method === 'GET' || method === 'HEAD') {
      let rows = filterRows(db[table], params)
      const order = url.searchParams.get('order')
      if (order) {
        const [col, dir] = order.split(',')[0].split('.')
        rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (dir === 'desc' ? -1 : 1))
      }
      const embed = EMBED[table]
      const select = url.searchParams.get('select') || '*'
      if (embed) {
        rows = rows.map((r) => {
          const out = { ...r }
          for (const [t, fk] of Object.entries(embed)) if (select.includes(t)) out[t] = db[t].find((x) => x.id === r[fk]) || null
          return out
        })
      }
      return reply(rows)
    }
    const body = req.postData() ? JSON.parse(req.postData()) : null
    if (method === 'POST') {
      const list = (Array.isArray(body) ? body : [body]).map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...r }))
      db[table].push(...list)
      calls.push({ kind: 'insert', table, rows: list })
      return prefer.includes('return=representation') ? reply(list, 201) : route.fulfill({ status: 201, body: '' })
    }
    if (method === 'PATCH') {
      const rows = filterRows(db[table], params)
      for (const r of rows) Object.assign(r, body)
      calls.push({ kind: 'update', table, where: Object.fromEntries(params.filter(([k]) => k !== 'select')), patch: body, ids: rows.map((r) => r.id) })
      return prefer.includes('return=representation') ? reply(rows) : route.fulfill({ status: 204, body: '' })
    }
    if (method === 'DELETE') {
      const rows = filterRows(db[table], params)
      db[table] = db[table].filter((r) => !rows.includes(r))
      calls.push({ kind: 'delete', table, ids: rows.map((r) => r.id) })
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ status: 405, body: '' })
  }

  async function handleApi(route) {
    const req = route.request()
    const url = new URL(req.url())
    let body = null
    try { body = JSON.parse(req.postData() || 'null') } catch { body = req.postData() }
    calls.push({ kind: 'api', method: req.method(), path: url.pathname, body })
    if (url.pathname.startsWith('/api/care/admin/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' })
    if (url.pathname === '/api/admin/auth') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emailed: true }) })
  }

  async function install(page) {
    await page.route('**/api/admin/data/**', handleData)
    await page.route(/\/api\/(care\/admin|invoices|email|meetings|proposals|sows|contracts|admin\/auth)(\/|$|\?)/, handleApi)
  }

  return { db, calls, install, failOnce: (match, status = 401) => { failNext = { match, status } } }
}
