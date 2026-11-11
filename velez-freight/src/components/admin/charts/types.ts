export type ChartFormat = "count" | "money" | "percent" | "hours";
export type Series = { key: string; label: string; color: string };
export type ChartProps = { kind: "line" | "bar" | "stacked" | "hbar"; data: Record<string, string | number | null>[]; xKey: string; series: Series[]; format?: ChartFormat; height?: number };

/** Brand chart palette. Navy leads; red is reserved for problems (late, overdue). */
export const C = { navy: "#142839", slate: "#7A8A99", champagne: "#B08A4E", sky: "#4F7C9E", success: "#2E7D4F", warning: "#B7791F", danger: "#B81B24", muted: "#C9C3B6" };

export function formatChartValue(v: number, f: ChartFormat) {
  if (!Number.isFinite(v)) return "";
  if (f === "money") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v);
  if (f === "percent") return `${v.toFixed(1)}%`;
  if (f === "hours") return `${v.toFixed(1)} h`;
  return new Intl.NumberFormat("en-US").format(v);
}
