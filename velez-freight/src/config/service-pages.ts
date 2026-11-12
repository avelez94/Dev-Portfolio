import { images } from "./images";
import type { SeoKey } from "./seo";

/**
 * Dedicated service pages. Content is educational and factual: it explains how each kind of
 * freight move generally works and how we approach it, without transit time promises, rates,
 * statistics, fleet claims or testimonials. Wording that describes the service as available
 * appears only once operating (`op`); prelaunch wording (`pre`) describes plans.
 * No dashes in printed copy (owner preference).
 */
type Pair = { pre: string; op: string };
export type ServicePage = {
  slug: "expedited" | "dedicated" | "general";
  route: string;
  seoKey: SeoKey;
  name: string;
  eyebrow: string;
  h1: string;
  intro: string;
  image: { src: string; alt: string; position: string };
  lead: Pair;
  explainTitle: string;
  explain: string[];
  usesTitle: string;
  uses: string[];
  approachTitle: string;
  approachIntro: Pair;
  approach: { title: string; body: string }[];
  share: string[];
  compare?: { title: string; intro: string; rows: [string, string, string][]; head: [string, string, string] };
  note: string;
};

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "expedited",
    route: "/services/expedited-freight",
    seoKey: "expedited",
    name: "Expedited Freight",
    eyebrow: "Expedited Freight",
    h1: "Expedited Freight for Time Sensitive Shipments",
    intro: "When a production line is waiting or a customer can’t wait, the plan matters as much as the truck. Expedited freight is about moving urgent shipments with fewer delays and more attention.",
    image: { ...images.redTruck, position: "62% 60%" },
    lead: {
      pre: "We plan to make expedited freight a focus once our broker registration is complete. Here is how it works and how we intend to approach it.",
      op: "Expedited freight is one of our areas of focus. Here is how it works and how we approach each urgent request.",
    },
    explainTitle: "What expedited freight means",
    explain: [
      "Expedited freight is transportation planned around a deadline rather than a standard schedule. Instead of waiting to share a trailer or follow a regular route, an urgent shipment usually moves on a truck or van dedicated to that load, directly from pickup to delivery.",
      "For long distances, carriers may use team drivers so the truck can keep moving within federal hours of service rules. For small urgent loads, a cargo van, Sprinter van, or box truck is often a better fit than a full size tractor trailer.",
      "Because the equipment is used for one shipment and planned on short notice, expedited service generally costs more than standard freight. It makes sense when the cost of a late delivery is higher.",
    ],
    usesTitle: "When businesses use expedited freight",
    uses: ["Replacement parts for equipment that is down", "Components a production line is waiting on", "Inventory needed to meet a customer commitment", "Time sensitive business shipments with a firm delivery window", "Recovering from a missed pickup or an earlier delay"],
    approachTitle: "How an expedited move is planned",
    approachIntro: { pre: "Once services begin, each urgent request will be planned step by step:", op: "Each urgent request is planned step by step:" },
    approach: [
      { title: "Confirm the deadline", body: "When the freight is ready, when it must arrive, and whether the delivery has a firm appointment." },
      { title: "Match the equipment", body: "Weight, dimensions, and piece count decide whether a van, box truck, or tractor trailer fits." },
      { title: "Check the route and timing", body: "Distance, driver hours, and facility hours shape whether a solo or team driver is needed." },
      { title: "Choose a qualified carrier", body: "Operating authority, insurance, and equipment are checked before the load is offered." },
      { title: "Stay in touch", body: "You hear from us at pickup, at delivery, and right away if anything changes." },
    ],
    share: ["Pickup and delivery addresses", "Ready time and required delivery time", "Weight, dimensions, and number of pieces or pallets", "How the freight is packaged and loaded", "Dock, liftgate, or appointment requirements", "A contact at pickup and at delivery"],
    compare: {
      title: "Expedited or standard freight?",
      intro: "A general comparison. The right choice depends on your deadline, freight, and budget.",
      head: ["", "Expedited", "Standard"],
      rows: [
        ["Planned around", "A specific deadline", "Regular schedules and routes"],
        ["Equipment", "Usually dedicated to one shipment", "Often shared or scheduled"],
        ["Notice", "Short notice is common", "More lead time"],
        ["Cost", "Generally higher", "Generally lower"],
      ],
    },
    note: "Availability depends on shipment requirements and qualified carrier capacity. No delivery time is promised until a carrier confirms the plan in writing.",
  },
  {
    slug: "dedicated",
    route: "/services/dedicated-transportation",
    seoKey: "dedicated",
    name: "Dedicated Transportation",
    eyebrow: "Dedicated Transportation",
    h1: "Dedicated Transportation Built Around Your Operation",
    intro: "Some freight needs a truck that is there for your shipment and nothing else. Dedicated transportation gives a move focused capacity, planned around your schedule and facility.",
    image: { ...images.trucksMountainHighway, position: "50% 55%" },
    lead: {
      pre: "Dedicated transportation is one of the services we are preparing to offer. Here is what it means and how we intend to plan it.",
      op: "Here is what dedicated transportation means and how we plan it with you.",
    },
    explainTitle: "What dedicated transportation means",
    explain: [
      "With dedicated transportation, a truck and driver are assigned to your shipment exclusively. Your freight is not combined with other customers’ freight, and the truck goes where your schedule needs it to go.",
      "As a freight broker, we don’t own trucks. We arrange dedicated capacity with qualified motor carriers whose equipment and availability fit your needs, and we coordinate the details with them on your behalf.",
      "For freight that moves regularly, the same lane and timing can be planned again and again, which makes appointments and dock schedules easier to manage on both ends.",
    ],
    usesTitle: "When dedicated transportation makes sense",
    uses: ["Recurring shipments on the same lane", "Deliveries with firm appointment times", "Freight that should not be combined with other loads", "Moves with more than one pickup or delivery stop", "Urgent shipments that need a truck right away"],
    approachTitle: "How a dedicated move is planned",
    approachIntro: { pre: "Once services begin, dedicated moves will be planned with you in these steps:", op: "Dedicated moves are planned with you in these steps:" },
    approach: [
      { title: "Understand the pattern", body: "Lanes, volumes, days of the week, and how much notice you usually have." },
      { title: "Know both facilities", body: "Dock hours, appointment rules, loading method, and any site requirements." },
      { title: "Select suitable carriers", body: "Equipment, authority, insurance, and availability are confirmed before anything is booked." },
      { title: "Confirm in writing", body: "Pickup and delivery times, equipment, and special instructions are written down for everyone." },
      { title: "Review together", body: "As shipments repeat, we look at what is working and adjust the plan with you." },
    ],
    share: ["Lanes: where freight picks up and delivers", "How often it ships and on which days", "Typical weight, pallets, and equipment", "Appointment and dock requirements", "Handling or security needs", "Who to contact at each facility"],
    note: "Availability depends on shipment requirements and qualified carrier capacity. Recurring arrangements are confirmed in writing before they begin.",
  },
  {
    slug: "general",
    route: "/services/general-freight-coordination",
    seoKey: "general",
    name: "General Freight Coordination",
    eyebrow: "General Freight",
    h1: "General Freight Coordination for Business Shipments",
    intro: "Palletized inventory, packaged goods, and commercial freight all move a little differently. General freight coordination starts with your shipment and finds transportation that fits it.",
    image: { ...images.whiteTruckMotion, position: "50% 60%" },
    lead: {
      pre: "General freight coordination is part of our planned services. Here is how business freight is usually moved and what shapes the plan.",
      op: "Here is how business freight is usually moved and what shapes each plan we put together.",
    },
    explainTitle: "How business freight moves",
    explain: [
      "Most commercial freight moves either as a full truckload, where one shipment uses the whole trailer, or as a partial or less than truckload shipment, where smaller freight shares space with other shipments. Full truckload is usually simpler and faster for large shipments; partial loads can make sense for a few pallets.",
      "The freight itself decides the equipment. Packaged and palletized goods usually ride in an enclosed dry van. Temperature sensitive goods need a refrigerated trailer. Oversized or irregular items may need a flatbed. Smaller loads may fit a box truck or cargo van.",
      "Getting these details right at the start avoids surprises at the dock: the wrong equipment, a missing liftgate, or an appointment nobody booked.",
    ],
    usesTitle: "Common equipment types",
    uses: ["Dry van: enclosed trailer for palletized and packaged goods", "Refrigerated: temperature controlled freight", "Flatbed: oversized, irregular, or crane loaded items", "Box truck: smaller loads and local deliveries", "Cargo or Sprinter van: small, urgent shipments"],
    approachTitle: "What shapes the plan",
    approachIntro: { pre: "Once services begin, every general freight request will start with these questions:", op: "Every general freight request starts with these questions:" },
    approach: [
      { title: "Freight type", body: "What it is, how it is packaged, and whether it needs special handling." },
      { title: "Size and weight", body: "Pallet count, dimensions, and total weight decide the right equipment and load type." },
      { title: "Locations", body: "Pickup and delivery addresses, dock access, and whether a liftgate is needed." },
      { title: "Timing", body: "When it is ready, when it must arrive, and any appointment windows." },
      { title: "Carrier fit", body: "A qualified carrier with the right authority, insurance, and equipment for the job." },
    ],
    share: ["Pickup and delivery locations", "Commodity and how it is packaged", "Weight, dimensions, and pallet or piece count", "Equipment needs, if known", "Ready date and delivery requirements", "Liftgate, dock, or appointment details"],
    note: "Availability depends on shipment requirements and qualified carrier capacity.",
  },
];

export const servicePageFor = (slug: string) => SERVICE_PAGES.find((s) => s.slug === slug);
