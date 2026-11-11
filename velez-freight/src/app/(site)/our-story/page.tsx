import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed, ClipboardCheck, Cpu, Handshake, MessageSquareText, MonitorSmartphone, ShieldCheck, Truck, UserRound } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { images } from "@/config/images";
import { PageHero } from "@/components/site/page-hero";
import { LogoMark } from "@/components/site/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Our Story",
  description: "Mary’s Logistics Group is named in honor of Mary and inspired by a family tradition of entrepreneurship. Meet founder Alante Velez and learn how we approach freight coordination.",
  alternates: { canonical: "/our-story" },
};

const founder = {
  name: "Alante Velez",
  title: "Founder & CEO",
  photo: { src: "/images/founder-alante-velez.jpg", width: 1122, height: 1402 },
};

/**
 * Founder strengths, drawn only from the owner approved biography. No years of experience,
 * prior licensed brokerage operation or business results are stated or implied.
 */
const strengths = [
  { icon: Truck, title: "Transportation Experience", body: "Hands on experience as her father’s agent, sourcing and booking loads through freight brokers and supporting transportation coordination." },
  { icon: Cpu, title: "Technology & Innovation", body: "A strong background in information technology and graduate studies in cybersecurity, applied to building efficient, dependable systems." },
  { icon: Handshake, title: "Leadership & Relationships", body: "Professional experience in technical operations and team leadership, and a commitment to lasting business relationships." },
];

const approach = [
  { icon: UserRound, title: "Personalized service", body: "Each shipment is planned around your freight, schedule and priorities, not a one size fits all process." },
  { icon: MessageSquareText, title: "Clear communication", body: "Straightforward answers and timely updates, so you always know where things stand." },
  { icon: ShieldCheck, title: "Responsible carrier selection", body: "Carriers are reviewed for operating authority, insurance and fit for the freight before any shipment is arranged." },
  { icon: ClipboardCheck, title: "Organization", body: "Documents, details and deadlines are tracked carefully, so nothing important slips through." },
  { icon: MonitorSmartphone, title: "Technology enabled operations", body: "Modern systems keep shipment information, records and follow ups organized and accurate." },
];

export default async function OurStoryPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHero
        eyebrow="Our Story"
        title="A Legacy That Moves Us Forward"
        intro="Rooted in family. Driven by purpose."
        image={images.openRoadSunrise.src}
        imageAlt={images.openRoadSunrise.alt}
        position="50% 60%"
      />

      {/* 1. Our Story */}
      <section aria-labelledby="story-title" className="relative overflow-hidden py-16 sm:py-24">
        <LogoMark className="pointer-events-none absolute -right-24 top-10 w-[36rem] opacity-[0.05]" />
        <div className="container-site relative grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-16">
          <div className="max-w-2xl">
            <p className="eyebrow flex items-center gap-3"><span aria-hidden="true" className="h-0.5 w-8 bg-brand-red" /> Our Story</p>
            <h2 id="story-title" className="mt-3 text-3xl font-bold sm:text-[2.4rem]">Named in honor of Mary</h2>
            <div className="prose-site mt-6 text-[1.05rem] text-charcoal">
              <p className="font-serif text-2xl leading-snug text-navy">
                Mary’s Logistics Group is named in honor of Mary, our founder’s grandmother, whose legacy continues to inspire generations of our family.
              </p>
              <p>
                Honoring her through the businesses we build is part of a family tradition of entrepreneurship, and this company continues it. We carry the values behind that tradition into every conversation with shippers and carriers: integrity, hard work and lasting relationships.
              </p>
              <p className="font-serif text-xl italic text-brand-red-dark">Rooted in family. Driven by purpose.</p>
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] lg:aspect-[4/5]">
            <Image src={images.roadSunriseHills.src} alt={images.roadSunriseHills.alt} fill sizes="(min-width:1024px) 35vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* 2. Meet Our Founder */}
      <section aria-labelledby="founder-title" className="border-y border-line bg-ivory-200/60 py-16 sm:py-24">
        <div className="container-site grid items-center gap-12 lg:grid-cols-[minmax(0,25rem)_1fr] lg:gap-20 xl:grid-cols-[minmax(0,28rem)_1fr]">
          <figure className="relative mx-auto w-[calc(100%_-_1.5rem)] max-w-[22rem] sm:w-full sm:max-w-sm lg:max-w-none">
            {/* Offset red frame and navy block: restrained editorial accents behind the portrait. */}
            <div aria-hidden="true" className="absolute -bottom-3 -right-3 left-5 top-5 rounded-[var(--radius-card)] border-2 border-brand-red sm:-bottom-5 sm:-right-5 sm:left-6 sm:top-6" />
            <div aria-hidden="true" className="absolute -left-3 bottom-10 h-24 w-1.5 rounded-full bg-navy sm:-left-5 sm:h-28 sm:w-2" />
            <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[0_24px_60px_-30px_rgb(20_40_57/0.55)]">
              <Image
                src={founder.photo.src}
                alt={`${founder.name}, ${founder.title} of Mary’s Logistics Group`}
                width={founder.photo.width}
                height={founder.photo.height}
                sizes="(min-width:1280px) 28rem, (min-width:1024px) 25rem, (min-width:640px) 24rem, 22rem"
                quality={85}
                className="h-auto w-full"
              />
            </div>
            <figcaption className="relative -mt-10 ml-6 mr-10 rounded-lg border border-line bg-white px-5 py-4 shadow-[0_16px_40px_-24px_rgb(20_40_57/0.5)] sm:ml-8">
              <span className="block font-serif text-lg font-bold text-navy sm:text-xl">{founder.title}</span>
              <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.18em] text-brand-red-dark">Mary’s Logistics Group</span>
            </figcaption>
          </figure>

          <div className="max-w-2xl">
            <p className="eyebrow flex items-center gap-3"><span aria-hidden="true" className="h-0.5 w-8 bg-brand-red" /> Meet Our Founder</p>
            <h2 id="founder-title" className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">{founder.name}</h2>
            <div className="mt-6 space-y-4 text-[1.05rem] leading-relaxed text-charcoal">
              <p className="font-serif text-xl leading-snug text-navy">
                Alante Velez founded Mary’s Logistics Group with a vision of bringing together hands on transportation experience, modern technology, and a commitment to building lasting business relationships.
              </p>
              <p>
                Her experience in the transportation industry began working alongside her father, assisting with load sourcing, communicating with freight brokers, and coordinating transportation arrangements. That firsthand exposure gave her an understanding of the logistics process, the importance of reliable carrier relationships, and the coordination required to keep freight moving.
              </p>
              <p>
                Complementing her industry experience, Alante has a strong background in information technology, graduate studies in cybersecurity, and professional experience in technical operations and team leadership. She brings a strategic, solutions focused approach to building efficient systems and delivering dependable service.
              </p>
              <p>
                Inspired by her family’s entrepreneurial legacy, Alante established Mary’s Logistics Group to combine practical industry knowledge with innovation, accountability, and a personalized approach to freight coordination.
              </p>
            </div>
            <ul className="mt-9 grid gap-6 sm:grid-cols-3" aria-label="Strengths Alante brings to the company">
              {strengths.map((x) => (
                <li key={x.title} className="border-t-2 border-brand-red pt-4">
                  <x.icon aria-hidden="true" className="size-5 text-brand-red" />
                  <h3 className="mt-3 text-base font-bold text-navy">{x.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-charcoal">{x.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Our Approach */}
      <section aria-labelledby="approach-title" className="bg-navy py-16 sm:py-20">
        <div className="container-site">
          <p className="eyebrow eyebrow-light">Our Approach</p>
          <h2 id="approach-title" className="mt-3 text-3xl font-bold text-white sm:text-4xl">How we work with you</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/85">Freight coordination built on the fundamentals: knowing your needs, keeping you informed and choosing carriers responsibly.</p>
          <ul className="mt-10 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {approach.map((v) => (
              <li key={v.title} data-reveal className="border-t-2 border-brand-red pt-5">
                <v.icon aria-hidden="true" className="size-6 text-brand-red" />
                <h3 className="mt-4 text-xl font-bold text-white">{v.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-white/85">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="status" aria-labelledby="status-title" className="py-16 sm:py-20">
        <div className="container-site max-w-4xl">
          <p className="eyebrow">Where we are today</p>
          <h2 id="status-title" className="mt-3 text-3xl font-bold sm:text-4xl">Our operating status</h2>
          {settings.operational ? (
            <p className="mt-4 leading-relaxed">Mary’s Logistics Group is operating as a licensed freight broker{settings.mcNumber ? ` (MC ${settings.mcNumber})` : ""}. Contact us to discuss your shipment.</p>
          ) : (
            <>
              <p className="mt-4 leading-relaxed text-charcoal">
                We are being transparent about where the company stands. Mary’s Logistics Group is in its prelaunch stage, and we will not arrange transportation until every requirement below is complete and verified.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "Freight broker operating authority granted and active with FMCSA",
                  "Required broker financial security (surety bond or trust fund) in effect",
                  "Process agent designation on file",
                  "Business registration and insurance confirmed",
                  "Carrier vetting procedures in place",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-lg border border-line bg-white p-4">
                    <CircleDashed aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-red" />
                    <span>{item}<span className="sr-only"> (in progress)</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex items-start gap-2 text-sm text-slate-muted"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> This page will be updated when these steps are complete.</p>
            </>
          )}
          <Link href="/contact" className={`${buttonVariants({ size: "lg" })} mt-10`}>
            Get in Touch <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
