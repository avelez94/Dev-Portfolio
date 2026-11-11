// TEST ONLY. A minimal stand in for the Supabase REST (PostgREST) and Auth APIs, backed by a
// local Postgres database that has the real migration applied. It implements only the request
// shapes this app sends, and it executes every query under the caller's Postgres role
// (anon, authenticated or service_role) with the JWT subject set, so grants and Row Level
// Security are enforced exactly as written in the migration. Never deploy this.
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);
const SECRET = process.env.FAKE_JWT_SECRET ?? "e2e-test-secret-not-for-production";
// Return DATE columns as plain YYYY-MM-DD strings, as PostgREST does.
pg.types.setTypeParser(1082, (v) => v);
const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 8 });

// ---------------------------------------------------------------------------
// JWT helpers (HS256)
// ---------------------------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function signJwt(payload, secret = SECRET) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, p, s] = String(token ?? "").split(".");
  if (!h || !p || !s) return null;
  const expected = createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (expected !== s) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}

// ---------------------------------------------------------------------------
// Auth (password grant, refresh, user, logout, recover)
// ---------------------------------------------------------------------------
const passwords = new Map(); // email -> password, seeded through POST /__seed
const refreshTokens = new Map(); // token -> user id

async function findUser(where, value) {
  const { rows } = await pool.query(`select id, email from auth.users where ${where} = $1`, [value]);
  return rows[0];
}
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() });
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access = signJwt({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, iat: now, exp: now + 3600, session_id: randomUUID() });
  const refresh = randomUUID();
  refreshTokens.set(refresh, u.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: userJson(u) };
}

async function handleAuth(req, res, url, body) {
  const path = url.pathname.replace("/auth/v1", "");
  if (path === "/token" && url.searchParams.get("grant_type") === "password") {
    const u = await findUser("lower(email)", String(body.email ?? "").toLowerCase());
    if (!u || passwords.get(u.email) !== body.password) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(res, 200, session(u));
  }
  if (path === "/token" && url.searchParams.get("grant_type") === "refresh_token") {
    const id = refreshTokens.get(body.refresh_token);
    if (!id) return send(res, 400, { error: "invalid_grant", msg: "Invalid Refresh Token" });
    const u = await findUser("id", id);
    return send(res, 200, session(u));
  }
  const claims = verifyJwt((req.headers.authorization ?? "").replace(/^Bearer /i, ""));
  if (path === "/user" && req.method === "GET") {
    if (!claims?.sub) return send(res, 401, { code: 401, msg: "invalid JWT" });
    const u = await findUser("id", claims.sub);
    return u ? send(res, 200, userJson(u)) : send(res, 404, { msg: "User not found" });
  }
  if (path === "/user" && req.method === "PUT") {
    if (!claims?.sub) return send(res, 401, { msg: "invalid JWT" });
    const u = await findUser("id", claims.sub);
    if (body.password) passwords.set(u.email, body.password);
    return send(res, 200, userJson(u));
  }
  if (path === "/logout") return send(res, 204, null);
  if (path === "/recover") return send(res, 200, {});
  return send(res, 404, { msg: `fake auth: ${req.method} ${path} not implemented` });
}

// ---------------------------------------------------------------------------
// REST (PostgREST subset)
// ---------------------------------------------------------------------------
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { code: "PGRST100" });
  return `"${s}"`;
};
let columnTypes = null;
async function colType(table, col) {
  if (!columnTypes) {
    const { rows } = await pool.query(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'`);
    columnTypes = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, r.data_type]));
  }
  return columnTypes.get(`${table}.${col}`);
}
function splitTop(s) {
  const out = []; let depth = 0; let cur = ""; let q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q && ch === "(") depth++;
    if (!q && ch === ")") depth--;
    if (!q && depth === 0 && ch === ",") { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
const OPS = { eq: "=", neq: "<>", lt: "<", lte: "<=", gt: ">", gte: ">=", like: "like", ilike: "ilike" };
function condition(col, expr, params) {
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  let val = expr.slice(dot + 1);
  if (op === "is") return `${ident(col)} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`;
  if (op === "in") {
    const items = splitTop(val.replace(/^\(|\)$/g, "")).map((v) => v.replace(/^"|"$/g, ""));
    params.push(items);
    return `${ident(col)} = any($${params.length})`;
  }
  if (!OPS[op]) throw Object.assign(new Error(`operator ${op} not supported`), { code: "PGRST100" });
  if (op === "like" || op === "ilike") val = val.replace(/\*/g, "%");
  params.push(val);
  return `${ident(col)} ${OPS[op]} $${params.length}`;
}
function where(url, params) {
  const conds = [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(k)) continue;
    if (v.startsWith("not.")) { const rest = v.slice(4); conds.push(`not (${condition(k, rest, params)})`); continue; }
    if (k === "or") {
      const parts = splitTop(v.replace(/^\(|\)$/g, "")).map((p) => { const i = p.indexOf("."); return condition(p.slice(0, i), p.slice(i + 1), params); });
      conds.push(`(${parts.join(" or ")})`);
    } else conds.push(condition(k, v, params));
  }
  return conds.length ? ` where ${conds.join(" and ")}` : "";
}
const selectList = (url) => {
  const s = (url.searchParams.get("select") ?? "*").replace(/\s/g, "");
  return s === "*" ? "*" : s.split(",").map(ident).join(", ");
};
function orderBy(url) {
  const o = url.searchParams.get("order");
  if (!o) return "";
  return " order by " + o.split(",").map((part) => {
    const [col, dir = "asc", nulls] = part.split(".");
    return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullslast" ? " nulls last" : nulls === "nullsfirst" ? " nulls first" : ""}`;
  }).join(", ");
}
async function values(table, obj, params) {
  const cols = Object.keys(obj);
  const placeholders = [];
  for (const c of cols) {
    const t = await colType(table, c);
    let v = obj[c];
    if (v !== null && typeof v === "object" && (t === "jsonb" || t === "json")) v = JSON.stringify(v);
    params.push(v);
    placeholders.push(`$${params.length}`);
  }
  return { cols: cols.map(ident), placeholders };
}

async function runAs(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const role = ["anon", "authenticated", "service_role"].includes(claims?.role) ? claims.role : "anon";
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [claims?.sub ?? ""]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function handleRest(req, res, url, body) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "") || req.headers.apikey;
  const claims = verifyJwt(token);
  if (!claims) return send(res, 401, { code: "PGRST301", message: "JWT invalid" });
  const parts = url.pathname.replace("/rest/v1/", "").split("/");
  const prefer = String(req.headers.prefer ?? "");
  const wantsObject = String(req.headers.accept ?? "").includes("vnd.pgrst.object");
  try {
    if (parts[0] === "rpc") {
      const fn = ident(parts[1]);
      const params = [];
      const args = Object.entries(body ?? {}).map(([k, v]) => { params.push(v); return `${ident(k)} => $${params.length}`; });
      const { rows } = await runAs(claims, (c) => c.query(`select public.${fn}(${args.join(", ")}) as result`, params));
      return send(res, 200, rows[0]?.result ?? null);
    }
    const table = parts[0];
    const t = `public.${ident(table)}`;
    const params = [];
    let sql;
    let returning = prefer.includes("return=representation");
    if (req.method === "GET" || req.method === "HEAD") {
      if (prefer.includes("count=exact") && req.method === "HEAD") {
        const { rows } = await runAs(claims, (c) => c.query(`select count(*)::int as n from ${t}${where(url, params)}`, params));
        res.writeHead(200, { "content-range": `*/${rows[0].n}` });
        return res.end();
      }
      const limit = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      if (prefer.includes("count=exact")) {
        const cp = [];
        const { rows } = await runAs(claims, (c) => c.query(`select count(*)::int as n from ${t}${where(url, cp)}`, cp));
        res.setHeader("content-range", `${offset ?? 0}-*/${rows[0].n}`);
      }
      sql = `select ${selectList(url)} from ${t}${where(url, params)}${orderBy(url)}${limit ? ` limit ${Number(limit)}` : ""}${offset ? ` offset ${Number(offset)}` : ""}`;
      returning = true;
    } else if (req.method === "POST") {
      const rows = Array.isArray(body) ? body : [body];
      const tuples = [];
      let cols;
      for (const r of rows) { const v = await values(table, r, params); cols = v.cols; tuples.push(`(${v.placeholders.join(", ")})`); }
      const conflict = url.searchParams.get("on_conflict");
      const upsert = prefer.includes("resolution=merge-duplicates") ? ` on conflict (${ident(conflict ?? "id")}) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}` : "";
      sql = `insert into ${t} (${cols.join(", ")}) values ${tuples.join(", ")}${upsert}${returning ? ` returning ${selectList(url)}` : ""}`;
    } else if (req.method === "PATCH") {
      const v = await values(table, body, params);
      const sets = v.cols.map((c, i) => `${c} = ${v.placeholders[i]}`);
      sql = `update ${t} set ${sets.join(", ")}${where(url, params)}${returning ? ` returning ${selectList(url)}` : ""}`;
    } else if (req.method === "DELETE") {
      sql = `delete from ${t}${where(url, params)}${returning ? ` returning ${selectList(url)}` : ""}`;
    } else {
      return send(res, 405, { message: "method not allowed" });
    }
    const { rows } = await runAs(claims, (c) => c.query(sql, params));
    if (!returning) return send(res, req.method === "POST" ? 201 : 204, null);
    if (wantsObject) {
      if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null });
      return send(res, 200, rows[0]);
    }
    return send(res, 200, rows);
  } catch (e) {
    const status = e.code === "42501" ? (claims.role === "anon" ? 401 : 403) : e.code === "23505" ? 409 : 400;
    return send(res, status, { code: e.code ?? "PGRST000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
  }
}

// ---------------------------------------------------------------------------
function send(res, status, body) {
  if (body === null) { res.writeHead(status); return res.end(); }
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  try {
    if (url.pathname === "/__seed" && req.method === "POST") {
      for (const { email, password } of body.users ?? []) passwords.set(email, password);
      return send(res, 200, { ok: true });
    }
    if (url.pathname.startsWith("/auth/v1")) return await handleAuth(req, res, url, body);
    if (url.pathname.startsWith("/rest/v1")) return await handleRest(req, res, url, body);
    send(res, 404, { message: "not found" });
  } catch (e) {
    send(res, 500, { message: e.message });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`[fake-supabase] listening on ${PORT}`));
