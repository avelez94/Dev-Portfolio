/**
 * Money helpers. Postgres numeric(12,2) values arrive as numbers or strings; they are converted
 * to integer cents before any arithmetic so totals never drift through floating point.
 */
export type Money = number | string | null | undefined;

export function toCents(v: Money): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Formats a money value; returns "Not available" when the value is unknown (never "$0"). */
export function fmtMoney(v: Money, opts: { whole?: boolean } = {}): string {
  const c = toCents(v);
  if (c === null) return "Not available";
  return (opts.whole ? usdWhole : usd).format(c / 100);
}

/** Ratio as a percentage with one decimal, or null when the denominator is zero or unknown. */
export function pct(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator === null || numerator === undefined || !denominator) return null;
  return Math.round((1000 * numerator) / denominator) / 10;
}

export function fmtPct(v: number | null | undefined) {
  return v === null || v === undefined ? "Not available" : `${v.toFixed(1)}%`;
}

export function fmtCount(v: number | null | undefined) {
  return v === null || v === undefined ? "Not available" : new Intl.NumberFormat("en-US").format(v);
}
