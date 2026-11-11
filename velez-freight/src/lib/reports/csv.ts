import type { Report } from "@/lib/reports/types";
import { cell } from "@/lib/reports/types";
import { brand } from "@/config/brand";

/** Neutralizes spreadsheet formula injection and quotes per RFC 4180. */
export function csvField(v: string): string {
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV file per report: a header block, then each section with its own header row. */
export function reportToCsv(r: Report): string {
  const lines: string[][] = [[r.title], ["Company", brand.name], ["Period", r.period], ["Generated", r.generatedAt], ["Source", r.source]];
  if (r.summary.length) { lines.push([]); r.summary.forEach((x) => lines.push([x.label, x.value])); }
  for (const s of r.sections) {
    lines.push([], [s.title]);
    if (s.note) lines.push([s.note]);
    lines.push(s.columns.map((c) => c.label));
    // Raw numbers (not currency strings) so spreadsheets can calculate with them.
    s.rows.forEach((row) => lines.push(s.columns.map((c) => (row[c.key] === null || row[c.key] === undefined ? "" : c.format === "money" ? Number(row[c.key]).toFixed(2) : c.format === "date" || c.format === "text" || !c.format ? cell(row[c.key], "text") : String(row[c.key])))));
    if (!s.rows.length) lines.push(["No records for this period."]);
  }
  if (r.notes.length) { lines.push([]); r.notes.forEach((n) => lines.push([n])); }
  return "﻿" + lines.map((l) => l.map(csvField).join(",")).join("\r\n") + "\r\n";
}
