/** Reporting periods in the business time zone (America/New_York). Dates are YYYY-MM-DD. */
export const BUSINESS_TZ = "America/New_York";

export const presets = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "mtd", label: "Month to date" },
  { value: "qtd", label: "Quarter to date" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom range" },
] as const;
export type Preset = (typeof presets)[number]["value"];

export type Period = { preset: Preset; from: string; to: string; prevFrom: string; prevTo: string; days: number; label: string; compareLabel: string };

export function businessToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function fmtDay(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Resolves a period from URL parameters. Defaults to the last 30 days. Comparison is the
 *  immediately preceding period of the same length. */
export function resolvePeriod(params: { period?: string; from?: string; to?: string }, now = new Date()): Period {
  const today = businessToday(now);
  const preset = (presets.some((p) => p.value === params.period) ? params.period : "30d") as Preset;
  let from = addDays(today, -29);
  let to = today;
  const [y, m] = today.split("-").map(Number);
  if (preset === "today") from = today;
  if (preset === "7d") from = addDays(today, -6);
  if (preset === "mtd") from = `${today.slice(0, 7)}-01`;
  if (preset === "qtd") from = `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  if (preset === "ytd") from = `${y}-01-01`;
  if (preset === "custom" && isDate(params.from) && isDate(params.to)) {
    from = params.from <= params.to ? params.from : params.to;
    to = params.from <= params.to ? params.to : params.from;
    if (daysBetween(from, to) > 3660) from = addDays(to, -3660);
  }
  const days = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const label = preset === "custom" ? `${fmtDay(from)} to ${fmtDay(to)}` : presets.find((p) => p.value === preset)!.label;
  return { preset, from, to, prevFrom, prevTo, days, label, compareLabel: `vs ${fmtDay(prevFrom)} to ${fmtDay(prevTo)}` };
}

/** Chooses a chart grain that keeps roughly 6 to 40 points. */
export function grainFor(days: number): "day" | "week" | "month" {
  return days <= 31 ? "day" : days <= 200 ? "week" : "month";
}

export function periodQuery(p: Period) {
  const q = new URLSearchParams({ period: p.preset });
  if (p.preset === "custom") { q.set("from", p.from); q.set("to", p.to); }
  return q.toString();
}

/** UTC instant of midnight at the start of a business day in America/New_York (handles DST). */
export function dayStartUtc(d: string): string {
  const guess = new Date(`${d}T05:00:00Z`);
  const local = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", hourCycle: "h23" }).format(guess);
  const shift = Number(local) % 24; // 0 when EST (UTC minus 5), 1 when EDT (UTC minus 4)
  return new Date(guess.getTime() - shift * 3_600_000).toISOString();
}
