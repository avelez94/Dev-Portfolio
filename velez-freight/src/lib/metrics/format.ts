import type { MetricDef } from "./definitions";
import { fmtCount, fmtMoney, fmtPct } from "@/lib/money";

/** Display format for a metric value. Money arrives in cents; null is "Not available". */
export function formatValue(unit: MetricDef["unit"], v: number | null | undefined) {
  if (v === null || v === undefined) return "Not available";
  if (unit === "money") return fmtMoney(v / 100, { whole: Math.abs(v) >= 100_000 });
  if (unit === "percent") return fmtPct(v);
  if (unit === "hours") return `${v.toFixed(1)} h`;
  if (unit === "days") return `${v.toFixed(1)} days`;
  return fmtCount(v);
}
