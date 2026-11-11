import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhook } from "@/lib/email/webhook-signature";

const secretBytes = Buffer.from("test webhook secret bytes");
const secret = `whsec_${secretBytes.toString("base64")}`;
const now = 1_800_000_000;
const sign = (id: string, ts: number, body: string) => `v1,${createHmac("sha256", secretBytes).update(`${id}.${ts}.${body}`).digest("base64")}`;

test("webhook: a correctly signed, fresh request is accepted", () => {
  const body = '{"type":"email.delivered"}';
  assert.equal(verifyWebhook(secret, { id: "msg_1", timestamp: String(now), signature: `v1,bogus ${sign("msg_1", now, body)}` }, body, now), true);
});

test("webhook: tampered body, wrong secret, stale timestamp and missing headers are refused", () => {
  const body = '{"type":"email.delivered"}';
  const sig = sign("msg_1", now, body);
  assert.equal(verifyWebhook(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body.replace("delivered", "bounced"), now), false);
  assert.equal(verifyWebhook(`whsec_${Buffer.from("other").toString("base64")}`, { id: "msg_1", timestamp: String(now), signature: sig }, body, now), false);
  assert.equal(verifyWebhook(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body, now + 600), false);
  assert.equal(verifyWebhook(secret, { id: null, timestamp: String(now), signature: sig }, body, now), false);
  assert.equal(verifyWebhook("", { id: "msg_1", timestamp: String(now), signature: sig }, body, now), false);
});
