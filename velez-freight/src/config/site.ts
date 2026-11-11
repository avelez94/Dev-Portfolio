import { brand } from "@/config/brand";

/**
 * Centralized public content and verified company facts.
 *
 * The public brand name comes from src/config/brand.ts.
 *
 * RULE: only put facts here that the owner has confirmed. Anything unknown stays null and the
 * UI hides it. Admin editable values (email, phone, MC number, etc.) live in the
 * business_settings table and override these defaults at runtime; see src/lib/data/settings.ts.
 */
export const site = {
  name: brand.name,
  region: "Maryland, USA",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100",
  description:
    "Mary’s Logistics Group is a Maryland based freight brokerage preparing to offer personalized expedited, dedicated, and general freight coordination for businesses.",
} as const;

export const nav = [
  { href: "/", label: "Home" },
  { href: "/shippers", label: "Shippers" },
  { href: "/carriers", label: "Carriers" },
  { href: "/services", label: "Services" },
  { href: "/our-story", label: "Our Story" },
  { href: "/contact", label: "Contact" },
] as const;

/** Footer order from the approved copy. */
export const footerNav = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/shippers", label: "Shippers" },
  { href: "/carriers", label: "Carriers" },
  { href: "/our-story", label: "Our Story" },
  { href: "/contact", label: "Contact" },
] as const;

export const shipmentTypes = [
  { value: "dry_van", label: "Dry van (general freight)" },
  { value: "refrigerated", label: "Refrigerated" },
  { value: "flatbed", label: "Flatbed" },
  { value: "expedited", label: "Expedited / time sensitive" },
  { value: "ltl", label: "Less than truckload (LTL)" },
  { value: "other", label: "Other / not sure yet" },
] as const;

/**
 * Approved website copy (supplied by the owner). Printed text avoids dashes per the owner's
 * preference, so compound words from the source copy are written without hyphens.
 */
export const copy = {
  tagline: "Rooted in family. Driven by purpose.",
  hero: {
    // Owner supplied. The dash in the source is written as a comma per the no dashes preference.
    body: [
      "Your business depends on more than getting freight from one place to another. It depends on communication, thoughtful coordination, and a transportation partner who understands what’s at stake.",
      "At Mary’s Logistics Group, relationships come first, and every shipment matters.",
    ],
  },
  quick: {
    title: "Tell Us About Your Shipment",
    body: "Share where it’s going, what it is, and when it needs to be there. A real person will review it and reach out to talk through options.",
  },
  stayConnected: {
    eyebrow: "Stay in touch",
    title: "Let’s Stay Connected",
    body: "We’re completing our broker registration now. Leave your details and we’ll reach out personally when we’re ready to move freight. No commitment, and we won’t share your information.",
  },
  servicesIntro: {
    title: "Transportation Solutions for Your Business",
    body: "Every business moves freight a little differently. Whether it’s an urgent delivery or a regular shipment, we start by learning what yours needs and plan around it.",
  },
  why: {
    heading: "Why Choose Mary’s Logistics Group?",
    title: "Freight Coordination With a Personal Commitment",
    body: "Good freight coordination starts with listening. We take the time to understand your business, your customers, and what a late or mishandled load would mean for you.",
  },
  storyTeaser: {
    title: "A Legacy That Moves Us Forward",
    body: [
      "Named in honor of Mary, our company carries forward a family tradition of entrepreneurship, integrity, and lasting relationships.",
    ],
    founder: "Alante’s transportation experience began alongside her father, sourcing and booking loads through freight brokers, and is backed by a background in technology and leadership. The vision is simple: treat every customer the way you’d want your own business treated.",
  },
  carrierTitle: "Haul With Mary’s Logistics Group",
  carrierTeaser: [
    "Carriers are the people who actually move freight, and we never forget it.",
    "Expect clear load information, written agreements, honest communication, and respect for your time and your equipment.",
  ],
  carrierTeaserAsk: "Interested in working with us as we grow?",
  finalCta: {
    title: "Let’s Get Your Shipment Moving.",
    body: "Tell us about your freight and what matters most to you. We’ll review it personally and talk through the options together.",
  },
  prelaunch: {
    /** Sitewide notice: the one full disclosure, shown on every public page until operations are enabled. */
    notice: "We’re preparing to launch. Freight services begin once our broker registration is complete, and you’re welcome to reach out in the meantime.",
    /** Short contextual disclosure for pages that describe services or take inquiries. */
    short: "We’re not arranging shipments or providing quotes yet. Messages are business conversations only and don’t create a transportation order.",
    eyebrow: "Let’s start a conversation",
    title: "Tell Us About Your Business.",
    body: "We’d love to learn how your freight moves and what matters most to you. Send us a note and we’ll reply personally. We aim to respond within one business day.",
  },
  nextSteps: [
    { title: "We read it personally", body: "Every message goes to a real person, not an automated queue." },
    { title: "We reply promptly", body: "We aim to reply within one business day, with a direct answer or a few follow up questions." },
    { title: "We talk it through", body: "A conversation about your needs. No obligation, no pressure." },
  ],
} as const;

export const services = [
  {
    slug: "expedited",
    icon: "expedited",
    title: "Expedited Freight",
    summary: "Transportation coordination for time sensitive shipments that demand careful planning and responsive communication.",
    tagline: "When time is a priority.",
    detail: [
      "Unexpected delays, urgent inventory needs, and time sensitive shipments require careful planning.",
      "Our expedited freight service is designed to help businesses arrange transportation when conventional shipping schedules may not meet their requirements.",
    ],
    listTitle: "Potential applications",
    list: ["Urgent replacement parts", "Time sensitive business shipments", "Manufacturing components", "Priority inventory transfers", "Dedicated capacity for urgent moves"],
    note: "Availability depends on shipment requirements and qualified carrier capacity.",
  },
  {
    slug: "dedicated",
    icon: "dedicated",
    title: "Dedicated Transportation",
    summary: "Focused transportation arrangements tailored to your freight requirements, scheduling needs, and operational priorities.",
    tagline: "Transportation built around your priorities.",
    detail: [
      "For shipments requiring dedicated capacity, our approach focuses on selecting transportation suited to the freight, schedule, and delivery requirements.",
      "Dedicated transportation can be useful for urgent moves, recurring shipments, and specialized scheduling needs.",
    ],
    listTitle: "Useful for",
    list: ["Urgent moves", "Recurring shipments", "Specialized scheduling needs"],
    note: "Availability depends on shipment requirements and qualified carrier capacity.",
  },
  {
    slug: "general",
    icon: "general",
    title: "General Freight Coordination",
    summary: "Flexible freight solutions designed around shipment characteristics, equipment requirements, and destinations.",
    tagline: "Flexible solutions for changing freight needs.",
    detail: [
      "From palletized inventory to commercial goods, we aim to connect businesses with appropriate transportation resources based on their individual requirements.",
      "Our objective is to simplify coordination while maintaining clear communication throughout the process.",
    ],
    listTitle: "We consider",
    list: ["Freight type", "Equipment requirements", "Destination", "Timing"],
    note: "Availability depends on shipment requirements and qualified carrier capacity.",
  },
] as const;

export const processSteps = [
  { title: "Tell Us About Your Freight", body: "Share where it’s going, when it needs to be there, and anything special about it. We’ll ask the right follow up questions." },
  { title: "We Coordinate a Qualified Carrier", body: "We match your freight with a carrier whose authority, insurance, and equipment fit the job, and confirm the details in writing." },
  { title: "Stay Informed Through Delivery", body: "You’ll hear from us at the moments that matter, and right away if anything changes." },
] as const;

export const pillars = [
  { icon: "message", title: "Clear Communication", body: "Straight answers, prompt replies, and updates before you have to ask." },
  { icon: "user", title: "Personalized Service", body: "A plan shaped around your freight, your schedule, and your customers, not a one size fits all process." },
  { icon: "shield", title: "Responsible Carrier Selection", body: "Every carrier is checked for operating authority, insurance, and fit for your freight before a load is offered." },
] as const;

/**
 * Prelaunch answers are the approved copy. Operational answers drop the "planned" framing and
 * should be reviewed by the owner before BROKER_AUTHORITY_ACTIVE is turned on.
 */
export function faqs(operational: boolean) {
  return [
    {
      q: "What types of freight do you coordinate?",
      a: operational
        ? "Our services include expedited freight, dedicated transportation, and general freight coordination. Availability depends on shipment requirements and suitable carrier capacity."
        : "Our planned services include expedited freight, dedicated transportation, and general freight coordination. Availability will depend on shipment requirements and suitable carrier capacity.",
    },
    {
      q: "Do you arrange expedited transportation?",
      a: operational
        ? "Yes. Expedited requests are evaluated based on timing, cargo requirements, and available qualified carriers."
        : "Expedited freight is one of our planned areas of focus. Requests will be evaluated based on timing, cargo requirements, and available qualified carriers.",
    },
    {
      q: "Can you coordinate shipments across the United States?",
      a: operational
        ? "Our brokerage services include domestic transportation arrangements across eligible U.S. lanes, subject to qualified carrier availability and applicable requirements."
        : "Our planned brokerage services include domestic transportation arrangements across eligible U.S. lanes, subject to qualified carrier availability and applicable requirements.",
    },
    {
      q: "How do I request a freight quote?",
      a: operational
        ? "Submit your shipment details through our website or contact our team. We will review the requirements before providing transportation options."
        : "Once our brokerage services are active, you can submit shipment details through our website or contact our team. We will review the requirements before providing transportation options.",
    },
    {
      q: "How are carriers selected?",
      a: operational
        ? "We use a structured qualification process that considers relevant operating authority, insurance, equipment compatibility, and other appropriate compliance information."
        : "We intend to use a structured qualification process that considers relevant operating authority, insurance, equipment compatibility, and other appropriate compliance information.",
    },
    {
      q: "Do you provide 24/7 support?",
      a: "Our goal is to provide around the clock operational support for active shipments once our coverage arrangements are established. Confirmed support availability and contact procedures will be communicated when services launch.",
    },
    {
      q: "How can my trucking company become a carrier partner?",
      a: "Complete our carrier partnership inquiry form to introduce your company and equipment. Inquiries do not constitute approval or guarantee freight opportunities.",
    },
  ];
}
