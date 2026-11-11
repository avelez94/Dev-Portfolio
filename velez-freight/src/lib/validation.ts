import { z } from "zod";
import { shipmentTypes } from "@/config/site";

/** Shared by client forms (instant feedback) and server actions (authoritative validation). */

const trimmed = (max: number) => z.string().trim().max(max, `Please keep this under ${max} characters.`);
const required = (label: string, max: number) => trimmed(max).min(1, `${label} is required.`);
const optional = (max: number) => trimmed(max).optional().or(z.literal("")).transform((v) => (v ? v : undefined));

export const emailField = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address."));
export const phoneField = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+()\d\s.-]{7,32}$/, "Enter a valid phone number.");
const optionalPhone = z.union([z.literal(""), phoneField]).optional().transform((v) => (v ? v : undefined));
const digits = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/^(mc|usdot|dot)[\s#-]*/i, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\d{1,8}$/, `${label} should be numbers only.`)]))
    .optional()
    .transform((v) => (v ? v : undefined));

export const privacyAck = z.literal(true, { error: "Please confirm you have read the privacy notice." });

const shipmentTypeValues = shipmentTypes.map((s) => s.value) as [string, ...string[]];
export const shipmentTypeField = z.enum(shipmentTypeValues, { error: "Select a shipment type." });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
function notInPast(value: string) {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return value >= yesterday;
}

// ---------------------------------------------------------------------------
export const inquiryTypes = ["general", "shipper", "carrier", "launch_notification"] as const;

export const contactSchema = z
  .object({
    inquiryType: z.enum(inquiryTypes),
    name: required("Your name", 120),
    email: emailField,
    phone: optionalPhone,
    company: optional(160),
    shipmentType: z.union([z.literal(""), shipmentTypeField]).optional().transform((v) => (v ? v : undefined)),
    message: optional(4000),
    privacyAck,
  })
  .superRefine((v, ctx) => {
    if (v.inquiryType !== "launch_notification" && (!v.message || v.message.length < 10)) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Please include a short message (at least 10 characters)." });
    }
  });
export type ContactInput = z.input<typeof contactSchema>;

// ---------------------------------------------------------------------------
export const equipmentOptions = [
  { value: "dry_van", label: "Dry van" },
  { value: "reefer", label: "Refrigerated (reefer)" },
  { value: "flatbed", label: "Flatbed" },
  { value: "step_deck", label: "Step deck" },
  { value: "box_truck", label: "Box truck" },
  { value: "sprinter", label: "Cargo van / Sprinter" },
  { value: "power_only", label: "Power only" },
  { value: "other", label: "Other" },
] as const;
const equipmentValues = equipmentOptions.map((e) => e.value) as [string, ...string[]];

export const carrierSchema = z.object({
  companyName: required("Company name", 160),
  contactName: required("Contact name", 120),
  email: emailField,
  phone: phoneField,
  mcNumber: digits("MC number"),
  usdotNumber: digits("USDOT number"),
  equipment: z.array(z.enum(equipmentValues)).min(1, "Select at least one equipment type.").max(8),
  operatingRegion: required("Operating region", 300),
  fleetSize: z.coerce.number().int().min(1).max(100000).optional().or(z.literal("").transform(() => undefined)),
  message: optional(2000),
  privacyAck,
});
export type CarrierInput = z.input<typeof carrierSchema>;

// ---------------------------------------------------------------------------
export const quoteRouteSchema = z
  .object({
    pickupAddress: required("Pickup location", 300).min(2),
    deliveryAddress: required("Delivery location", 300).min(2),
    pickupDate: isoDate.refine(notInPast, "Pickup date cannot be in the past."),
    deliveryDeadline: z.union([z.literal(""), isoDate]).optional().transform((v) => (v ? v : undefined)),
    stops: z.array(z.object({ location: trimmed(300) })).max(5, "Up to 5 additional stops.").default([]),
  })
  .refine((v) => !v.deliveryDeadline || v.deliveryDeadline >= v.pickupDate, {
    path: ["deliveryDeadline"],
    message: "Delivery deadline must be on or after the pickup date.",
  });

export const quoteFreightSchema = z.object({
  description: required("Freight description", 1000).min(5, "Briefly describe the freight."),
  commodity: required("Commodity", 200).min(2, "Describe the commodity."),
  weightLbs: z.coerce.number({ error: "Enter the weight in pounds." }).int("Use whole pounds.").min(1, "Enter the weight in pounds.").max(200000, "That weight is above what we can review online."),
  dimensions: optional(200),
  pieceCount: z.coerce.number().int().min(1).max(10000).optional().or(z.literal("").transform(() => undefined)),
  pieceType: z.enum(["pallets", "pieces", "crates", "other"]).default("pallets"),
  equipment: shipmentTypeField,
  specialHandling: optional(1000),
  loadingRequirements: optional(1000),
});

export const quoteContactSchema = z.object({
  companyName: required("Company name", 160),
  contactName: required("Contact name", 120),
  email: emailField,
  phone: phoneField,
  notes: optional(4000),
});

export const quoteSchema = z.object({
  route: quoteRouteSchema,
  freight: quoteFreightSchema,
  contact: quoteContactSchema,
  privacyAck,
});
export type QuoteInput = z.input<typeof quoteSchema>;

/** Anti spam envelope sent with every public submission. */
export const spamEnvelope = z.object({
  token: z.string().max(200),
  website: z.string().max(200).optional(), // honeypot: real users never fill this
});
