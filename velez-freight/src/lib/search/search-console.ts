import "server-only";
import { createSign } from "node:crypto";

// Google Search Console (read only) through a service account that the owner adds as a user on
// the Search Console property. Nothing here runs unless all three settings are present:
//   GSC_SITE_URL       the property, e.g. "sc-domain:example.com" or "https://www.example.com/"
//   GSC_CLIENT_EMAIL   the service account's email
//   GSC_PRIVATE_KEY    the service account's private key (PEM; "\n" escapes are accepted)
// The Search Console API is free. Endpoints can be pointed at a local stand in for tests.

const TOKEN_URL = () => process.env.GSC_TOKEN_URL || "https://oauth2.googleapis.com/token";
const API_BASE = () => (process.env.GSC_API_BASE || "https://searchconsole.googleapis.com").replace(/\/$/, "");
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export type GscConfig = { siteUrl: string; clientEmail: string; privateKey: string };
export function gscConfig(): GscConfig | null {
  const siteUrl = process.env.GSC_SITE_URL ?? "";
  const clientEmail = process.env.GSC_CLIENT_EMAIL ?? "";
  const privateKey = (process.env.GSC_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  return siteUrl && clientEmail && privateKey ? { siteUrl, clientEmail, privateKey } : null;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** A signed JWT assertion for the OAuth token exchange (RS256). */
export function serviceAccountAssertion(cfg: Pick<GscConfig, "clientEmail" | "privateKey">, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL(), iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(cfg.privateKey))}`;
}

let cached: { token: string; expires: number } | null = null;
async function accessToken(cfg: GscConfig) {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountAssertion(cfg) }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error_description || `Token request failed (${res.status})`);
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function call<T>(cfg: GscConfig, path: string, body?: unknown): Promise<T> {
  const token = await accessToken(cfg);
  const res = await fetch(`${API_BASE()}/webmasters/v3/sites/${encodeURIComponent(cfg.siteUrl)}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Search Console request failed (${res.status})`);
  return data;
}

export type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type Totals = { clicks: number; impressions: number; ctr: number | null; position: number | null };
export type Sitemap = { path: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean; errors?: string; warnings?: string; contents?: { submitted?: string; indexed?: string }[] };
export type SearchData = { current: Totals; previous: Totals; byDate: Row[]; queries: Row[]; pages: Row[]; sitemaps: Sitemap[] };

const totals = (rows: Row[]): Totals => {
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const impressions = rows.reduce((a, r) => a + r.impressions, 0);
  // Average position weighted by impressions, as Search Console reports it.
  const position = impressions ? rows.reduce((a, r) => a + r.position * r.impressions, 0) / impressions : null;
  return { clicks, impressions, ctr: impressions ? clicks / impressions : null, position };
};

/** Search performance for a period and the one before it, top queries and pages, and sitemap status. */
export async function loadSearchData(cfg: GscConfig, p: { from: string; to: string; prevFrom: string; prevTo: string }): Promise<SearchData> {
  const q = (startDate: string, endDate: string, dimensions: string[], rowLimit = 25) =>
    call<{ rows?: Row[] }>(cfg, "/searchAnalytics/query", { startDate, endDate, dimensions, rowLimit, dataState: "final" }).then((r) => r.rows ?? []);
  const [byDate, prevByDate, queries, pages, sitemaps] = await Promise.all([
    q(p.from, p.to, ["date"], 1000),
    q(p.prevFrom, p.prevTo, ["date"], 1000),
    q(p.from, p.to, ["query"]),
    q(p.from, p.to, ["page"]),
    call<{ sitemap?: Sitemap[] }>(cfg, "/sitemaps").then((r) => r.sitemap ?? []).catch(() => []),
  ]);
  return { current: totals(byDate), previous: totals(prevByDate), byDate, queries, pages, sitemaps };
}
