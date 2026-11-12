/**
 * Search metadata for every public page: the single source for titles, descriptions, canonical
 * paths and sitemap dates. Each page has prelaunch wording and operating wording; the operating
 * wording (which describes services as available) is used only when operations are enabled.
 *
 * Titles: the brand is appended by the root layout template ("%s | Mary’s Logistics Group"),
 * so page titles stay near 35 characters and the full title near 60. Descriptions stay under
 * about 155 characters. No dashes in printed copy (owner preference).
 */
export type PageSeo = {
  path: string;
  /** Page part of the title. Set `absoluteTitle` instead to skip the brand template. */
  title?: string;
  absoluteTitle?: string;
  description: string;
  operational?: { title?: string; absoluteTitle?: string; description?: string };
  /** Content last reviewed (ISO date); used as the sitemap lastmod. Update when content changes. */
  updated: string;
  /** Included in the sitemap. */
  index?: boolean;
};

export const SEO = {
  home: {
    path: "/",
    absoluteTitle: "Mary’s Logistics Group | Maryland Freight Brokerage",
    description: "A family owned Maryland freight brokerage preparing to coordinate expedited, dedicated, and general freight for manufacturers, distributors, and warehouses.",
    operational: {
      description: "Maryland freight brokerage coordinating expedited, dedicated, and general freight for manufacturers, distributors, and warehouses. Request a freight quote.",
    },
    updated: "2026-11-12",
    index: true,
  },
  services: {
    path: "/services",
    title: "Freight Brokerage Services",
    description: "Expedited freight, dedicated transportation, and general freight coordination for businesses, explained: how each works, when it fits, and what to share.",
    updated: "2026-11-12",
    index: true,
  },
  expedited: {
    path: "/services/expedited-freight",
    title: "Expedited Freight Coordination",
    description: "How expedited freight works, when a time sensitive shipment calls for it, and the details that help plan an urgent move for your business.",
    operational: { description: "Expedited freight coordination for time sensitive business shipments: how it works, when it fits, and what to share for a fast, reviewed plan." },
    updated: "2026-11-12",
    index: true,
  },
  dedicated: {
    path: "/services/dedicated-transportation",
    title: "Dedicated Transportation Services",
    description: "What dedicated transportation means for business shippers, when exclusive capacity makes sense, and how recurring or sensitive moves are planned.",
    operational: { description: "Dedicated transportation for recurring, scheduled, or sensitive business freight, arranged with qualified carriers and planned around your operation." },
    updated: "2026-11-12",
    index: true,
  },
  general: {
    path: "/services/general-freight-coordination",
    title: "General Freight Coordination",
    description: "Palletized and commercial freight explained: full truckload versus partial loads, common equipment types, and the details that shape a shipment plan.",
    operational: { description: "General freight coordination for palletized and commercial shipments: equipment matched to your freight, qualified carriers, and clear updates." },
    updated: "2026-11-12",
    index: true,
  },
  shippers: {
    path: "/shippers",
    title: "Freight Coordination for Shippers",
    description: "For manufacturers, distributors, wholesalers, and warehouses: how we work with shippers, what to expect, and the details to share about your freight.",
    updated: "2026-11-12",
    index: true,
  },
  carriers: {
    path: "/carriers",
    title: "Carrier Partnerships",
    description: "Authorized motor carriers: learn how Mary’s Logistics Group plans to work with carrier partners, how qualification works, and how to introduce your company.",
    updated: "2026-11-12",
    index: true,
  },
  ourStory: {
    path: "/our-story",
    title: "Our Story and Founder",
    description: "Named in honor of Mary, our family owned Maryland freight brokerage carries a tradition of entrepreneurship. Meet founder Alante Velez and how we work.",
    updated: "2026-11-12",
    index: true,
  },
  contact: {
    path: "/contact",
    title: "Contact Our Maryland Team",
    description: "Reach Mary’s Logistics Group with a business, shipper, or carrier partnership question. A real person reads every message and replies personally.",
    operational: { title: "Contact a Maryland Freight Broker" },
    updated: "2026-11-12",
    index: true,
  },
  requestQuote: {
    path: "/request-quote",
    title: "Business Inquiry",
    description: "Tell Mary’s Logistics Group about your business and how your freight moves. We are preparing to launch and are not yet arranging transportation.",
    operational: {
      title: "Request a Freight Quote",
      description: "Request a freight quote from Mary’s Logistics Group. Share your lane, freight, and timing; a person reviews every request before discussing pricing.",
    },
    updated: "2026-11-12",
    index: true,
  },
  privacy: { path: "/privacy", title: "Privacy Policy", description: "How Mary’s Logistics Group collects, uses, and protects information submitted through this website.", updated: "2026-11-11", index: true },
  terms: { path: "/terms", title: "Terms of Use", description: "Terms that apply to the use of the Mary’s Logistics Group website.", updated: "2026-11-11", index: true },
} satisfies Record<string, PageSeo>;

export type SeoKey = keyof typeof SEO;
