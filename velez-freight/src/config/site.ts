/**
 * Centralized public content and verified company facts.
 *
 * RULE: only put facts here that the owner has confirmed. Anything unknown stays null and the
 * UI hides it. Admin editable values (email, phone, MC number, etc.) live in the
 * business_settings table and override these defaults at runtime; see src/lib/data/settings.ts.
 */
export const site = {
  name: "Velez Freight Group",
  /** Show the legal name only after LLC registration is confirmed (business_settings.legal_name_confirmed). */
  legalName: "Velez Freight Group LLC",
  region: "Maryland, USA",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100",
  description:
    "Velez Freight Group is a family owned freight brokerage being established in Maryland, bringing a personalized approach to freight coordination, clear communication, and responsible carrier selection.",
  founder: {
    inspiration: "Elanisoa Devon Velez",
    honoring: "Mary",
  },
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
  tagline: "Built on family. Driven to move forward.",
  hero: {
    body: "Freight transportation should feel straightforward. Velez Freight Group brings a personalized approach to freight coordination, connecting businesses with transportation solutions built around their needs.",
  },
  quick: {
    title: "Tell Us About Your Shipment",
    body: "From pickup to delivery, every detail matters. Share your freight requirements, and our team will review your transportation needs.",
  },
  servicesIntro: {
    title: "Transportation Solutions for Your Business",
    body: "From urgent deliveries to ongoing transportation needs, Velez Freight Group is being built to provide flexible freight coordination for businesses across different industries.",
  },
  why: {
    title: "Freight Coordination With a Personal Commitment",
    body: "We believe successful freight transportation begins with understanding the customer, not simply moving a shipment from one point to another.",
  },
  storyTeaser: [
    "Velez Freight Group was inspired by a family tradition of entrepreneurship and a belief that meaningful businesses are built through hard work, integrity, and lasting relationships.",
    "Our name honors the legacy behind us while representing the future we\u2019re building.",
  ],
  carrierTeaser: [
    "Strong carrier relationships are an essential part of successful freight coordination.",
    "We believe in professional partnerships, transparent communication, and treating the businesses responsible for transporting freight with respect.",
  ],
  carrierTeaserAsk: "Interested in working with us as we grow?",
  finalCta: {
    title: "Let\u2019s Get Your Shipment Moving.",
    body: "Transportation begins with understanding your needs. Tell us about your freight, and let\u2019s explore how we can support your business.",
  },
  prelaunch: {
    title: "Velez Freight Group is preparing to launch.",
    body: "We\u2019re building a freight brokerage focused on personalized transportation coordination and strong business relationships.",
    invite: "We welcome general business inquiries while we complete our registration and operational preparations.",
  },
} as const;

export const services = [
  {
    slug: "expedited",
    icon: "expedited",
    title: "Expedited Freight",
    summary: "When timing matters, every minute counts. Our expedited freight service is designed for businesses that need time sensitive transportation arrangements with clear communication and careful coordination.",
    tagline: "When time is a priority.",
    detail: [
      "Unexpected delays, urgent inventory needs, and time sensitive shipments require careful planning.",
      "Our expedited freight service is designed to help businesses arrange transportation when conventional shipping schedules may not meet their requirements.",
    ],
    listTitle: "Potential applications",
    list: ["Urgent replacement parts", "Time sensitive business shipments", "Manufacturing components", "Priority inventory transfers", "Dedicated cargo van transportation"],
    note: "Availability depends on shipment requirements and qualified carrier capacity.",
  },
  {
    slug: "dedicated",
    icon: "dedicated",
    title: "Dedicated Transportation",
    summary: "Some shipments require a more focused approach. Dedicated transportation provides capacity arranged around your freight requirements, delivery schedules, and operational priorities.",
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
    summary: "Every shipment is different. We work to identify appropriate transportation options based on freight type, equipment requirements, destination, and timing.",
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
  { title: "Tell Us About Your Freight", body: "Share your shipment details, pickup and delivery locations, timeline, and any special requirements." },
  { title: "We Coordinate the Right Carrier", body: "We review your requirements and work to arrange transportation with an appropriately qualified carrier." },
  { title: "Stay Informed Through Delivery", body: "Clear communication and shipment updates help you stay informed throughout the transportation process." },
] as const;

export const pillars = [
  { icon: "message", title: "Clear Communication", body: "Straightforward answers, responsive coordination, and a commitment to keeping customers informed." },
  { icon: "user", title: "Personalized Service", body: "Transportation solutions shaped around your business, your freight, and your priorities." },
  { icon: "shield", title: "Responsible Carrier Selection", body: "A deliberate approach to reviewing carrier qualifications, operating authority, and appropriate insurance before transportation is arranged." },
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
