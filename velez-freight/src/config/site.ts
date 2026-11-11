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
    "Velez Freight Group is a family-owned freight brokerage being established in Maryland, focused on personalized freight coordination, responsive communication, and responsible carrier selection.",
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

export const shipmentTypes = [
  { value: "dry_van", label: "Dry van (general freight)" },
  { value: "refrigerated", label: "Refrigerated" },
  { value: "flatbed", label: "Flatbed" },
  { value: "expedited", label: "Expedited / time sensitive" },
  { value: "ltl", label: "Less than truckload (LTL)" },
  { value: "other", label: "Other / not sure yet" },
] as const;

export const services = [
  {
    slug: "expedited",
    icon: "expedited",
    title: "Expedited Freight",
    summary: "Time-sensitive shipments coordinated around urgent delivery requirements.",
    detail: [
      "Expedited freight coordination focuses on shipments where timing matters most. We start by understanding the real deadline, the pickup window, and any constraints at origin and destination.",
      "Once operating, we will work to identify an appropriately authorized and insured carrier whose equipment and availability fit the shipment, and we will keep you informed as the load moves.",
    ],
    fit: ["Production parts and time critical inventory", "Missed or rescheduled shipments that need recovery", "Shipments with firm appointment times"],
    note: "Timing commitments are confirmed shipment by shipment with the carrier. We do not promise a delivery time before a carrier has accepted the load.",
  },
  {
    slug: "dedicated",
    icon: "dedicated",
    title: "Dedicated Transportation",
    summary: "Transportation arrangements tailored to high-priority and recurring shipping needs.",
    detail: [
      "For shippers with recurring lanes or high priority freight, we plan around your schedule, your facilities, and the way your team works.",
      "The goal is consistency: a clear point of contact, documented requirements for each lane, and carriers selected for the lane rather than for a single load.",
    ],
    fit: ["Recurring weekly or monthly lanes", "Shipments with consistent handling requirements", "Customers who want one point of contact"],
    note: "Dedicated arrangements depend on carrier availability for the specific lane and are agreed in writing before service begins.",
  },
  {
    slug: "general",
    icon: "general",
    title: "General Freight Coordination",
    summary: "Flexible freight solutions using appropriately qualified carriers.",
    detail: [
      "General freight coordination covers everyday full truckload and partial shipments of palletized or boxed goods.",
      "We gather the details that matter (commodity, weight, dimensions, equipment, dock access) so the carrier receives an accurate load description from the start.",
    ],
    fit: ["Palletized and boxed commercial goods", "Dry van, refrigerated, and flatbed freight", "One time and occasional shipments"],
    note: "Freight types and equipment we can arrange will be confirmed as carrier relationships are established.",
  },
] as const;

export const processSteps = [
  { title: "Tell Us About Your Freight", body: "Share your pickup and delivery locations, dates, and freight details through our inquiry form or by contacting us directly." },
  { title: "We Coordinate a Qualified Carrier", body: "We review your requirements and look for a carrier whose authority, insurance, and equipment fit the shipment." },
  { title: "Stay Informed Through Delivery", body: "You receive clear updates from a single point of contact, from carrier confirmation through delivery." },
] as const;

export const pillars = [
  { icon: "message", title: "Clear Communication", body: "Direct, responsive coordination and clear shipment information." },
  { icon: "user", title: "Personalized Service", body: "Transportation planning tailored to the customer's actual requirements." },
  { icon: "shield", title: "Responsible Carrier Selection", body: "A deliberate verification process for carrier eligibility, authority, and insurance." },
] as const;

/** FAQ answers are written for the current business stage. Review when authority becomes active. */
export function faqs(operational: boolean) {
  return [
    {
      q: "What types of freight do you arrange?",
      a: operational
        ? "We coordinate general commercial freight, including palletized and boxed goods moving by dry van, refrigerated, and flatbed equipment. Tell us about your shipment and we will confirm whether it is a good fit before anything is booked."
        : "Our focus will be general commercial freight, such as palletized and boxed goods moving by dry van, refrigerated, and flatbed equipment. We are not arranging transportation yet while our broker registration is being completed.",
    },
    {
      q: "Do you handle expedited freight?",
      a: operational
        ? "Yes, we coordinate time-sensitive shipments. Delivery timing is confirmed with the carrier for each load, and we will tell you plainly if a deadline is not realistic."
        : "Expedited freight coordination is one of our planned services. Once we are operating, delivery timing will be confirmed with the carrier for each load before anything is promised.",
    },
    {
      q: "How does requesting a freight quote work?",
      a: operational
        ? "Submit the inquiry form with your route, dates, and freight details. A person on our team reviews every request. Pricing is prepared manually and is not binding until it is confirmed in writing."
        : "Freight quotes are not available yet. You can send us a general inquiry or ask to be notified when we begin operating, and we will follow up personally.",
    },
    {
      q: "How are carriers selected?",
      a: "Carriers are reviewed for active operating authority, insurance coverage, and safety information before they are offered a load. Selection is a deliberate, human decision, not an automated assignment.",
    },
    {
      q: "Can you arrange long-distance transportation?",
      a: operational
        ? "We coordinate shipments across the United States where a qualified carrier is available for the lane. We confirm each lane before committing to it."
        : "We plan to coordinate shipments across the United States, subject to carrier availability for each lane. We are not arranging transportation yet.",
    },
    {
      q: "How can carriers become partners?",
      a: "Authorized motor carriers can send a partnership inquiry through our Carriers page. Full onboarding, including document collection and verification, happens later through a separate secure process, never through the public form.",
    },
  ];
}
