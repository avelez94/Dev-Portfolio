// How a visitor arrived, reduced to a broad channel. Pure functions shared by the browser
// tracker and the server. Only a host name and the utm_medium tag are examined; the full
// referrer, query strings and search terms are never stored.

export const CHANNELS = ["organic_search", "paid_search", "direct", "referral", "social", "email", "unknown"] as const;
export const ENGINES = ["google", "bing", "duckduckgo", "yahoo", "ecosia", "brave", "other"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Engine = (typeof ENGINES)[number];
export type Arrival = { landing: string; channel: Channel; engine: Engine | null };

const SEARCH: [RegExp, Engine][] = [
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/(^|\.)search\.brave\.com$/, "brave"],
  [/(^|\.)(baidu\.com|yandex\.[a-z]+|startpage\.com|qwant\.com)$/, "other"],
];
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|linkedin\.com|lnkd\.in|t\.co|x\.com|twitter\.com|instagram\.com|youtube\.com|reddit\.com)$/;
const MAIL = /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/;

export function classifyArrival(input: { referrerHost: string; currentHost: string; utmMedium?: string | null }): { channel: Channel; engine: Engine | null } {
  const host = input.referrerHost.toLowerCase();
  const medium = (input.utmMedium ?? "").toLowerCase();
  const paid = /^(cpc|ppc|paid|paidsearch|paid_search|sem)$/.test(medium);
  if (/^e?mail|newsletter$/.test(medium)) return { channel: "email", engine: null };
  if (/^(social|social_media|sm)$/.test(medium)) return { channel: "social", engine: null };
  if (!host || host === input.currentHost.toLowerCase()) return paid ? { channel: "paid_search", engine: null } : { channel: "direct", engine: null };
  // Web mail first: mail.google.com is not Google search.
  if (MAIL.test(host)) return { channel: "email", engine: null };
  for (const [re, engine] of SEARCH) if (re.test(host)) return { channel: paid ? "paid_search" : "organic_search", engine };
  if (SOCIAL.test(host)) return { channel: "social", engine: null };
  return { channel: "referral", engine: null };
}

/** Landing path only: no query string or fragment, and only safe characters. */
export function cleanLanding(path: string) {
  const p = path.split(/[?#]/)[0].slice(0, 200);
  return /^\/[A-Za-z0-9/_-]*$/.test(p) ? p : "/";
}

export function parseArrival(v: unknown): Arrival | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  const channel = CHANNELS.includes(a.channel as Channel) ? (a.channel as Channel) : null;
  if (!channel || typeof a.landing !== "string") return null;
  const engine = ENGINES.includes(a.engine as Engine) ? (a.engine as Engine) : null;
  return { landing: cleanLanding(a.landing), channel, engine: channel === "organic_search" || channel === "paid_search" ? engine : null };
}
