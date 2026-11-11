/** A report is data, not presentation: the page, CSV and PDF all render the same structure. */
export type Column = { key: string; label: string; format?: "money" | "count" | "percent" | "text" | "date" };
export type Section = { title: string; note?: string; columns: Column[]; rows: Record<string, string | number | null>[] };
export type Report = { key: string; title: string; description: string; period: string; generatedAt: string; source: string; summary: { label: string; value: string }[]; sections: Section[]; notes: string[] };

/** Formats a cell for display and export. Money is shown with two decimals. */
export function cell(v: string | number | null | undefined, f: Column["format"] = "text"): string {
  if (v === null || v === undefined || v === "") return f === "text" || f === "date" ? "" : "Not available";
  if (f === "money") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));
  if (f === "percent") return `${Number(v).toFixed(1)}%`;
  if (f === "count") return new Intl.NumberFormat("en-US").format(Number(v));
  return String(v);
}
