import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtMoney, pct, toCents } from "@/lib/money";

test("money is converted to integer cents without floating point drift", () => {
  assert.equal(toCents("0.1")! + toCents("0.2")!, 30);
  assert.equal(toCents(1234.565), 123457);
  assert.equal(toCents(null), null);
  const lines = ["1999.99", "0.01", "250.10"];
  assert.equal(lines.reduce((a, v) => a + toCents(v)!, 0), 225010);
});

test("unknown values are shown as not available, never as zero", () => {
  assert.equal(fmtMoney(null), "Not available");
  assert.equal(fmtMoney("0"), "$0.00");
  assert.equal(pct(5, 0), null);
  assert.equal(pct(1, 3), 33.3);
});
