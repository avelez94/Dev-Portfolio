import { createHmac } from "node:crypto";
const SECRET = process.env.FAKE_JWT_SECRET ?? "e2e-test-secret-not-for-production";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function signJwt(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  return `${head}.${body}.${createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
