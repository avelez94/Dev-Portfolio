import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CalendarDays, ClipboardList, Factory, MapPin, MessagesSquare, Package, RadioTower, Truck, UserRound, Warehouse, Wrench } from "lucide-react";
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

const expectations = [
  { icon: UserRound, title: "A Personal Point of Contact", body: "Clear communication and a direct approach to managing your transportation requests." },
  { icon: ClipboardList, title: "Thoughtful Freight Planning", body: "Attention to shipment details, scheduling, equipment requirements, and coordination." },
  { icon: BadgeCheck, title: "Carrier Qualification", body: "A structured process for reviewing the carriers considered for your freight." },
  { icon: RadioTower, title: "Communication Throughout the Process", body: "Relevant shipment updates, proactive issue reporting, and responsive support." },
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
        intro="Transportation affects more than delivery schedules. It affects inventory, operations, customer relationships, and the ability to keep business moving."
        image={images.trucksMountainHighway.src}
        imageAlt={images.trucksMountainHighway.alt}
        position="50% 55%"
      />

      <section className="py-16 sm:py-20">
        <div className="container-site grid gap-12 lg:grid-cols-2 lg:items-center">
          <div data-reveal className="space-y-5 text-[1.05rem] leading-relaxed text-charcoal">
            <p className="font-serif text-2xl leading-snug text-navy">At Mary’s Logistics Group, we believe your transportation partner should understand those priorities.</p>
            <p>Our approach focuses on responsive communication, thoughtful coordination, and building business relationships that extend beyond a single shipment.</p>
            {!settings.operational && (
              <PrelaunchNotice>
                {copy.prelaunch.title} We are not arranging transportation or accepting freight orders yet. {copy.prelaunch.invite}
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
          <SectionHeading id="serve-title" eyebrow="Who We Aim to Serve" title="Developing transportation solutions for" />
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
          <h2 id="expect-title" className="mt-3 text-3xl font-bold text-white sm:text-4xl">What You Can Expect</h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {expectations.map(({ icon: Icon, title, body }) => (
              <li key={title} data-reveal className="rounded-[var(--radius-card)] border border-white/15 bg-white/5 p-6">
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-8 text-brand-red" />
                <h3 className="mt-4 text-xl font-bold text-white">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-white/85">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-site">
          <SectionHeading eyebrow="Be prepared" title="Details that help us review your needs" intro="Having this information ready makes the first conversation faster and more accurate." />
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
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Your Freight Deserves Attention</h2>
            <p className="mt-3 max-w-2xl text-white/90">Whether you have an urgent shipment or are exploring a longer term transportation relationship, we welcome the opportunity to learn about your business.</p>
          </div>
          <Link href="/contact" className={buttonVariants({ size: "lg" })}>
            Contact Our Team <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
