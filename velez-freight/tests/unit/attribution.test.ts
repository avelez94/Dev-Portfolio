import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyArrival, cleanLanding, parseArrival } from "@/lib/attribution";

const here = "maryslogistics.test";

test("search engines are organic unless tagged as paid", () => {
  assert.deepEqual(classifyArrival({ referrerHost: "www.google.com", currentHost: here }), { channel: "organic_search", engine: "google" });
  assert.deepEqual(classifyArrival({ referrerHost: "www.google.co.uk", currentHost: here }), { channel: "organic_search", engine: "google" });
  assert.deepEqual(classifyArrival({ referrerHost: "www.bing.com", currentHost: here }), { channel: "organic_search", engine: "bing" });
  assert.deepEqual(classifyArrival({ referrerHost: "duckduckgo.com", currentHost: here }), { channel: "organic_search", engine: "duckduckgo" });
  assert.deepEqual(classifyArrival({ referrerHost: "www.google.com", currentHost: here, utmMedium: "cpc" }), { channel: "paid_search", engine: "google" });
});

test("direct, internal, social, email and referral traffic", () => {
  assert.equal(classifyArrival({ referrerHost: "", currentHost: here }).channel, "direct");
  assert.equal(classifyArrival({ referrerHost: here, currentHost: here }).channel, "direct");
  assert.equal(classifyArrival({ referrerHost: "www.linkedin.com", currentHost: here }).channel, "social");
  assert.equal(classifyArrival({ referrerHost: "mail.google.com", currentHost: here }).channel, "email");
  assert.equal(classifyArrival({ referrerHost: "", currentHost: here, utmMedium: "email" }).channel, "email");
  assert.equal(classifyArrival({ referrerHost: "news.example.org", currentHost: here }).channel, "referral");
  assert.equal(classifyArrival({ referrerHost: "notgoogle.com.evil.example", currentHost: here }).channel, "referral");
});

test("landing pages keep only a clean path; untrusted input is rejected", () => {
  assert.equal(cleanLanding("/services/expedited-freight?gclid=abc#top"), "/services/expedited-freight");
  assert.equal(cleanLanding("/<script>"), "/");
  assert.equal(parseArrival({ landing: "/contact?email=x@y.z", channel: "organic_search", engine: "google" })?.landing, "/contact");
  assert.equal(parseArrival({ landing: "/", channel: "hacked", engine: "google" }), null);
  assert.equal(parseArrival({ landing: "/", channel: "direct", engine: "google" })?.engine, null);
  assert.equal(parseArrival("nope"), null);
});
