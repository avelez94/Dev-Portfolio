import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// A random per process secret is acceptable for local development only; production must set FORM_TOKEN_SECRET.
const secret = process.env.FORM_TOKEN_SECRET || (process.env.NODE_ENV === "production" ? "" : randomBytes(32).toString("hex"));

const MIN_AGE_MS = Number(process.env.FORM_MIN_FILL_MS ?? 2500);
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueFormToken(now = Date.now()) {
  if (!secret) throw new Error("FORM_TOKEN_SECRET is not configured");
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export type TokenCheck = "ok" | "invalid" | "too_fast" | "expired";

/** Verifies the token was issued by this server and the form was not submitted implausibly fast. */
export function checkFormToken(token: string, now = Date.now()): TokenCheck {
  if (!secret) return "invalid";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d{10,16}$/.test(ts)) return "invalid";
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = now - Number(ts);
  if (age < MIN_AGE_MS) return "too_fast";
  if (age > MAX_AGE_MS) return "expired";
  return "ok";
}
