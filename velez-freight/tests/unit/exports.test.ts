import { test } from "node:test";
import assert from "node:assert/strict";
import { csvField, reportToCsv } from "@/lib/reports/csv";
import { pdfSafe, reportToPdf } from "@/lib/reports/pdf";
import type { Report } from "@/lib/reports/types";

const report: Report = {
  key: "t", title: "Test Report", description: "Description", period: "Last 30 days", generatedAt: "now", source: "unit",
  summary: [{ label: "Total", value: "$1,000" }],
  sections: [{ title: "Rows", columns: [{ key: "name", label: "Name" }, { key: "amount", label: "Amount", format: "money" }], rows: [{ name: "=HYPERLINK(\"x\")", amount: 1234.5 }, { name: "Plain, with comma", amount: null }] }],
  notes: ["Note"],
};

test("CSV neutralizes formula injection and quotes fields", () => {
  assert.equal(csvField("=1+1"), "'=1+1");
  assert.equal(csvField("@cmd"), "'@cmd");
  assert.equal(csvField('a "b", c'), '"a ""b"", c"');
  const csv = reportToCsv(report);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")",1234.50`));
  assert.ok(csv.includes('"Plain, with comma",'));
});

test("PDF is a real text document and tolerates unicode punctuation", async () => {
  assert.equal(pdfSafe("Let’s go — now…"), "Let's go - now...");
  const bytes = await reportToPdf({ ...report, title: "Café “Report”" });
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  assert.ok(bytes.length > 1500);
});
