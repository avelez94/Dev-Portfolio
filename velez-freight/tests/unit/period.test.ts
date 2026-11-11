import { test } from "node:test";
import assert from "node:assert/strict";
import { dayStartUtc, resolvePeriod } from "@/lib/metrics/period";

test("business day start handles standard and daylight time", () => {
  assert.equal(dayStartUtc("2026-01-15"), "2026-01-15T05:00:00.000Z");
  assert.equal(dayStartUtc("2026-07-15"), "2026-07-15T04:00:00.000Z");
});

test("default period is the last 30 days with an equal length comparison period", () => {
  const p = resolvePeriod({}, new Date("2026-11-11T15:00:00Z"));
  assert.equal(p.from, "2026-10-13");
  assert.equal(p.to, "2026-11-11");
  assert.equal(p.days, 30);
  assert.equal(p.prevTo, "2026-10-12");
  assert.equal(p.prevFrom, "2026-09-13");
});

test("presets and custom ranges", () => {
  const now = new Date("2026-11-11T15:00:00Z");
  assert.equal(resolvePeriod({ period: "mtd" }, now).from, "2026-11-01");
  assert.equal(resolvePeriod({ period: "qtd" }, now).from, "2026-10-01");
  assert.equal(resolvePeriod({ period: "ytd" }, now).from, "2026-01-01");
  const c = resolvePeriod({ period: "custom", from: "2026-03-10", to: "2026-03-01" }, now);
  assert.deepEqual([c.from, c.to], ["2026-03-01", "2026-03-10"], "reversed custom range is corrected");
  assert.equal(resolvePeriod({ period: "custom", from: "bad", to: "x" }, now).preset, "custom");
});

test("late evening in New York still counts as that business day", () => {
  // 11:30 pm Eastern on Nov 10 is 04:30 UTC on Nov 11.
  assert.equal(resolvePeriod({ period: "today" }, new Date("2026-11-11T04:30:00Z")).from, "2026-11-10");
});
