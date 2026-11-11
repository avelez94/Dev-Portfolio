import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Unsubscribe links must keep working (at least 30 days under CAN-SPAM), so tokens do not expire.
// They prove only which address asked to unsubscribe; they grant no other access.
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.FORM_TOKEN_SECRET || "";

const sign = (payload: string) => createHmac("sha256", secret()).update(`unsubscribe:${payload}`).digest("base64url");

export function makeUnsubscribeToken(email: string) {
  if (!secret()) return null;
  const payload = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || !secret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || payload.length > 400) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const email = Buffer.from(payload, "base64url").toString("utf8");
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254 ? email : null;
}
