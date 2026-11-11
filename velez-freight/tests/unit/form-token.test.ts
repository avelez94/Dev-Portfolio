import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFormToken, issueFormToken } from "@/lib/security/form-token";

test("a fresh token is rejected as too fast", () => {
  assert.equal(checkFormToken(issueFormToken()), "too_fast");
});

test("a token older than the minimum fill time is accepted", () => {
  const t = issueFormToken(Date.now() - 10_000);
  assert.equal(checkFormToken(t), "ok");
});

test("expired and tampered tokens are rejected", () => {
  assert.equal(checkFormToken(issueFormToken(Date.now() - 7 * 3_600_000)), "expired");
  const [ts, sig] = issueFormToken(Date.now() - 10_000).split(".");
  assert.equal(checkFormToken(`${Number(ts) - 1}.${sig}`), "invalid");
  assert.equal(checkFormToken("garbage"), "invalid");
});
