import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CalendarDays, ClipboardList, Clock, Factory, LifeBuoy, MapPin, MessagesSquare, Package, Route, Truck, Warehouse, Wrench } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { images } from "@/config/images";
import { copy } from "@/config/site";
import { PageHero, PrelaunchNotice, SectionHeading } from "@/components/site/page-hero";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For Shippers",
  description: "A freight partner that understands your business: responsive communication, thoughtful coordination, and relationships that extend beyond a single shipment.",
  alternates: { canonical: "/shippers" },
};

const audiences = [
  { icon: Factory, label: "Manufacturers" },
  { icon: Package, label: "Wholesale distributors" },
  { icon: Wrench, label: "Automotive and industrial suppliers" },
  { icon: Building2, label: "Commercial businesses" },
  { icon: Warehouse, label: "Warehouses and distribution operations" },
  { icon: CalendarDays, label: "Businesses with occasional or recurring freight needs" },
];

/** How we intend to work. Commitments, not guarantees or a claimed track record. */
const expectations = [
  { icon: Clock, title: "You won’t be left waiting", body: "We aim to reply within one business day and prioritize time sensitive requests. You’ll always know who to reach." },
  { icon: MessagesSquare, title: "Straight answers, in plain language", body: "No jargon and no runaround. If we can help, we’ll explain how. If something isn’t a fit, we’ll tell you that too." },
  { icon: ClipboardList, title: "Your requirements, taken seriously", body: "Equipment, handling, dock access, appointments. We ask the questions up front so the carrier arrives prepared." },
  { icon: CalendarDays, title: "Plans built around your schedule", body: "Pickup windows, delivery appointments, and production timelines shape the plan, not the other way around." },
  { icon: Route, title: "Coordination handled for you", body: "We work through the details with the carrier and confirm them in writing, so you can stay focused on your business." },
  { icon: BadgeCheck, title: "Carriers you can rely on", body: "Every carrier is checked for operating authority, insurance, and fit for your freight before a load is offered." },
];

const checklist = [
  { icon: MapPin, title: "Pickup and delivery locations", body: "Addresses or city, state and ZIP, plus any additional stops." },
  { icon: CalendarDays, title: "Dates and time windows", body: "When the freight is ready, required delivery dates, and appointments." },
  { icon: Package, title: "Commodity, weight and dimensions", body: "What is shipping, total weight, piece or pallet count, and dimensions." },
  { icon: Truck, title: "Equipment needs", body: "Cargo van, box truck, dry van, refrigerated, flatbed, or other equipment." },
  { icon: MessagesSquare, title: "Special instructions", body: "Liftgate or dock access, loading method, and handling requirements." },
];

export default async function ShippersPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHero
        eyebrow="For Shippers"
        title="A Freight Partner That Understands Your Business"
        intro="You have customers counting on you, schedules to keep, and inventory that can’t sit on a dock. We understand what’s riding on every shipment."
        image={images.trucksMountainHighway.src}
        imageAlt={images.trucksMountainHighway.alt}
        position="50% 55%"
      />

      <section className="py-16 sm:py-20">
        <div className="container-site grid gap-12 lg:grid-cols-2 lg:items-center">
          <div data-reveal className="space-y-5 text-[1.05rem] leading-relaxed text-charcoal">
            <p className="font-serif text-2xl leading-snug text-navy">When you hand over a shipment, you’re trusting someone with your reputation. We take that seriously.</p>
            <p>That means listening first, asking good questions, keeping you informed, and earning your trust one load at a time. We’re building relationships meant to last well beyond a single shipment.</p>
            {!settings.operational && (
              <PrelaunchNotice title="Opening soon">
                {copy.prelaunch.short} We’d still love to hear about your business now.
              </PrelaunchNotice>
            )}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)]">
            <Image src={images.loadingDocks.src} alt={images.loadingDocks.alt} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      <section aria-labelledby="serve-title" className="bg-white py-16 sm:py-20">
        <div className="container-site">
          <SectionHeading id="serve-title" eyebrow="Who we work with" title="Built for businesses like yours" intro="If your business ships freight, occasionally or every week, we’d like to understand how it moves." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map(({ icon: Icon, label }) => (
              <li key={label} data-reveal className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-ivory p-5">
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-8 shrink-0 text-brand-red" />
                <span className="font-semibold text-navy">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="expect-title" className="bg-navy py-16 sm:py-20">
        <div className="container-site">
          <p className="eyebrow eyebrow-light">Working together</p>
          <h2 id="expect-title" className="mt-3 text-3xl font-bold text-white sm:text-4xl">What Working With Us Will Look Like</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/85">The questions shippers ask most are about people, not trucks. Here is how we intend to answer them.</p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {expectations.map(({ icon: Icon, title, body }) => (
              <li key={title} data-reveal className="rounded-[var(--radius-card)] border border-white/15 bg-white/[0.06] p-6 transition-colors duration-300 hover:border-white/30 hover:bg-white/[0.09]">
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-8 text-brand-red" />
                <h3 className="mt-4 text-xl font-bold text-white">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-white/85">{body}</p>
              </li>
            ))}
          </ul>
          <div data-reveal className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] border-l-4 border-brand-red bg-white p-6 sm:flex-row sm:items-start sm:gap-5 sm:p-7">
            <LifeBuoy aria-hidden="true" strokeWidth={1.75} className="size-9 shrink-0 text-brand-red" />
            <div>
              <h3 className="text-xl font-bold">When plans change, you’ll hear it from us first</h3>
              <p className="mt-2 max-w-3xl leading-relaxed text-charcoal">Freight doesn’t always go as planned. Weather, traffic, and dock delays happen. If something comes up, we’ll let you know promptly, explain what it means for you, and work through the options with you, not leave you guessing.</p>
            </div>
          </div>
          {!settings.operational && <p className="mt-5 text-sm text-white/70">This is how we will work once our broker registration is complete.</p>}
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-site">
          <SectionHeading eyebrow="Getting started" title="Helpful details to share" intro="Have these handy if you can, but don’t worry if you don’t have everything yet. We’re happy to work through it together." />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {checklist.map(({ icon: Icon, title, body }) => (
              <li key={title} data-reveal className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-7 text-brand-red" />
                <h3 className="mt-3 text-base font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-navy py-16 sm:py-20">
        <Image src={images.roadSunsetFields.src} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-35" />
        <div className="container-site grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Let’s Talk About Your Freight</h2>
            <p className="mt-3 max-w-2xl text-white/90">
              {settings.operational
                ? "Whether you have an urgent shipment coming up or you’re planning a longer term relationship, we’d like to hear what you need."
                : "Whether you’re planning for upcoming shipments or looking for a long term partner, we’d like to hear what you need. We’ll reply personally."}
            </p>
          </div>
          <Link href={settings.operational ? "/request-quote" : "/contact"} className={buttonVariants({ size: "lg" })}>
            {settings.operational ? "Request a Freight Quote" : "Let’s Talk Freight"} <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
