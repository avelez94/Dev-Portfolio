import { test } from "node:test";
import assert from "node:assert/strict";
import { carrierSchema, contactSchema, quoteSchema } from "@/lib/validation";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);

test("contact: valid general inquiry passes and is normalized", () => {
  const r = contactSchema.safeParse({ inquiryType: "general", name: "  Pat Lee ", email: "PAT@Example.com", message: "We ship pallets weekly.", privacyAck: true });
  assert.ok(r.success);
  assert.equal(r.data.name, "Pat Lee");
  assert.equal(r.data.email, "pat@example.com");
});

test("contact: message required except for launch notifications", () => {
  assert.equal(contactSchema.safeParse({ inquiryType: "general", name: "Pat", email: "p@example.com", privacyAck: true }).success, false);
  assert.equal(contactSchema.safeParse({ inquiryType: "launch_notification", name: "Pat", email: "p@example.com", privacyAck: true }).success, true);
});

test("contact: privacy acknowledgement is mandatory", () => {
  assert.equal(contactSchema.safeParse({ inquiryType: "launch_notification", name: "Pat", email: "p@example.com", privacyAck: false }).success, false);
});

test("contact: unknown inquiry types and oversized input are rejected", () => {
  assert.equal(contactSchema.safeParse({ inquiryType: "sales", name: "Pat", email: "p@example.com", message: "hello world!", privacyAck: true }).success, false);
  assert.equal(contactSchema.safeParse({ inquiryType: "general", name: "x".repeat(121), email: "p@example.com", message: "hello world!", privacyAck: true }).success, false);
});

test("carrier: MC and USDOT prefixes are stripped, letters rejected", () => {
  const base = { companyName: "Road Co", contactName: "Sam", email: "s@example.com", phone: "410 555 0100", equipment: ["dry_van"], operatingRegion: "Mid Atlantic", privacyAck: true };
  const ok = carrierSchema.safeParse({ ...base, mcNumber: "MC 123456", usdotNumber: "USDOT#7654321" });
  assert.ok(ok.success);
  assert.equal(ok.data.mcNumber, "123456");
  assert.equal(ok.data.usdotNumber, "7654321");
  assert.equal(carrierSchema.safeParse({ ...base, mcNumber: "12A" }).success, false);
  assert.equal(carrierSchema.safeParse({ ...base, equipment: [] }).success, false);
});

test("quote: valid inquiry passes; past pickup and inverted deadline fail", () => {
  const q = {
    route: { pickupAddress: "Baltimore, MD", deliveryAddress: "Richmond, VA", pickupDate: future, deliveryDeadline: "", stops: [] },
    freight: { description: "Ten pallets of boxed parts", commodity: "Auto parts", weightLbs: "8000", pieceCount: "", pieceType: "pallets", equipment: "dry_van" },
    contact: { companyName: "Acme", contactName: "Pat", email: "p@example.com", phone: "410 555 0100" },
    privacyAck: true,
  };
  const r = quoteSchema.safeParse(q);
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  assert.equal(r.data.freight.weightLbs, 8000);
  assert.equal(quoteSchema.safeParse({ ...q, route: { ...q.route, pickupDate: "2020-01-01" } }).success, false);
  assert.equal(quoteSchema.safeParse({ ...q, route: { ...q.route, deliveryDeadline: "2020-01-01" } }).success, false);
  assert.equal(quoteSchema.safeParse({ ...q, freight: { ...q.freight, weightLbs: "250000" } }).success, false);
});
