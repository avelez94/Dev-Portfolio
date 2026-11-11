"use server";

import { randomBytes } from "node:crypto";
import { carrierSchema, contactSchema, quoteSchema } from "@/lib/validation";
import { flattenErrors, type ActionResult } from "@/lib/security/submission";
import { getStaff, isAdminRole } from "@/lib/auth";

const schemas = { contact: contactSchema, carrier: carrierSchema, quote: quoteSchema } as const;
export type PreviewForm = keyof typeof schemas;

/**
 * Launch preview submissions. Validates with exactly the same schemas as the public forms so the
 * owner sees real validation, but never writes to the database, never sends email, and never
 * creates tasks or notifications. Requires an admin session on every call.
 */
export async function simulatePreviewSubmission(form: PreviewForm, input: unknown): Promise<ActionResult> {
  const staff = await getStaff();
  if (!staff || !isAdminRole(staff.role)) return { ok: false, code: "server", error: "The launch preview is only available to signed in administrators." };
  const schema = schemas[form];
  if (!schema) return { ok: false, code: "server", error: "Unknown form." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation", error: "Please correct the highlighted fields.", fieldErrors: flattenErrors(parsed.error.issues) };
  const reference = `PREVIEW-${randomBytes(3).toString("hex").toUpperCase()}`;
  return {
    ok: true,
    reference,
    message: "Launch preview: this submission passed validation but was not saved, sent, or shared with anyone. No record, task, or email was created.",
  };
}
