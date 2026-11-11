import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEmail, fillVariables, markdownToHtml } from "@/lib/email/render";

const footer = { businessName: "Mary’s Logistics Group", mailingAddress: "PO Box 1\nBaltimore, MD 21201", unsubscribeUrl: "https://example.test/unsubscribe?t=abc", reason: "You are receiving this because we spoke about freight." };

test("variables: values, fallbacks, missing and unknown are reported", () => {
  const r = fillVariables("Hi {{contact.first_name|there}}, {{company.name}} {{sender.name}} {{nope.field}}", { "company.name": "Harbor Supply" });
  assert.equal(r.text, "Hi there, Harbor Supply  ");
  assert.deepEqual(r.missing, ["sender.name"]);
  assert.deepEqual(r.unknown, ["nope.field"]);
});

test("variables: a value wins over the fallback, and malformed placeholders are flagged", () => {
  assert.equal(fillVariables("Hi {{contact.first_name|there}}", { "contact.first_name": "Avery" }).text, "Hi Avery");
  assert.deepEqual(fillVariables("Hi {{ Contact Name }}", {}).unknown, ["{{ Contact Name }}"]);
});

test("markdown: HTML is escaped and only https or mailto links are kept", () => {
  const html = markdownToHtml("<script>alert(1)</script> **bold** [site](https://example.test) [bad](javascript:alert(1))");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes('<a href="https://example.test"'));
  assert.ok(!html.includes('href="javascript'));
});

test("markdown: bullet lists and paragraphs", () => {
  const html = markdownToHtml("Intro line\nsecond line\n\n* one\n* two");
  assert.match(html, /<p[^>]*>Intro line<br>second line<\/p>/);
  assert.match(html, /<ul[^>]*><li>one<\/li><li>two<\/li><\/ul>/);
});

test("built email always carries identity, postal address and unsubscribe link in both versions", () => {
  const e = buildEmail({ subject: "Hello {{company.name}}", body: "Hi {{contact.first_name|there}}", vars: { "company.name": "Acme" }, footer });
  assert.equal(e.subject, "Hello Acme");
  assert.deepEqual(e.missing, []);
  for (const part of [e.html, e.text]) {
    assert.ok(part.includes("Mary’s Logistics Group"));
    assert.ok(part.includes("Baltimore, MD 21201"));
    assert.ok(part.includes("https://example.test/unsubscribe?t=abc"));
  }
});
