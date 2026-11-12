import { test } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { serviceAccountAssertion } from "@/lib/search/search-console";

test("service account assertion is a valid RS256 JWT with the read only Search Console scope", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const jwt = serviceAccountAssertion({ clientEmail: "seo@example.iam.gserviceaccount.com", privateKey }, 1_800_000_000);
  const [h, c, sig] = jwt.split(".");
  const v = createVerify("RSA-SHA256");
  v.update(`${h}.${c}`);
  assert.ok(v.verify(publicKey, Buffer.from(sig, "base64url")));
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.scope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.equal(claims.iss, "seo@example.iam.gserviceaccount.com");
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(JSON.parse(Buffer.from(h, "base64url").toString()).alg, "RS256");
});
