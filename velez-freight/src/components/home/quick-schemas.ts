import { z } from "zod";
import { emailField, shipmentTypeField } from "@/lib/validation";

// Quick inquiry schemas, loaded only when the form is first validated (see lazy-resolver).

export const quickQuote = z.object({
  pickup: z.string().trim().min(2, "Enter a pickup city, state or ZIP.").max(300),
  delivery: z.string().trim().min(2, "Enter a delivery city, state or ZIP.").max(300),
  type: shipmentTypeField,
  weight: z.string().trim().regex(/^\d{0,6}$/, "Use whole pounds.").optional(),
  date: z.string().optional(),
});
export type QuickQuoteInput = z.input<typeof quickQuote>;

export const launchForm = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(120),
  email: emailField,
  company: z.string().trim().max(160).optional(),
  shipmentType: z.union([z.literal(""), shipmentTypeField]).optional(),
  privacyAck: z.literal(true, { error: "Please confirm the privacy notice." }),
});
export type LaunchFormInput = z.input<typeof launchForm>;
