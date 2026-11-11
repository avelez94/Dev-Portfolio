import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { copy, services } from "@/config/site";
import { images } from "@/config/images";
import { PageHero, PrelaunchNotice } from "@/components/site/page-hero";
import { ServiceIcon } from "@/components/home/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Freight Services",
  description: "Expedited freight, dedicated transportation, and general freight coordination from Mary’s Logistics Group, a family owned freight brokerage being established in Maryland.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Transportation Solutions Built Around Your Business"
        intro="No two shipments are exactly alike. Different freight requires different equipment, timelines, and transportation arrangements."
        image={images.whiteTruckMotion.src}
        imageAlt={images.whiteTruckMotion.alt}
        position="50% 60%"
      />

      <section className="py-16 sm:py-20">
        <div className="container-site space-y-6">
          {!settings.operational && (
            <PrelaunchNotice title="Planned services">
              {copy.prelaunch.title} The services below describe how we will work once our broker registration is complete. We are not arranging transportation, accepting freight orders, or providing quotes yet.
            </PrelaunchNotice>
          )}
          <p className="max-w-3xl font-serif text-2xl leading-snug text-navy">
            Mary’s Logistics Group focuses on understanding those details and helping businesses navigate their transportation needs with confidence.
          </p>
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold">What a freight broker does</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-charcoal">
              A freight broker arranges transportation between a shipper and an authorized motor carrier. Mary’s Logistics Group does not own trucks or employ drivers. Our role is to understand your shipment, select an appropriately authorized and insured carrier, and coordinate communication from pickup through delivery.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-0">
        {services.map((s, i) => {
          const enabled = settings.services[s.slug];
          return (
            <section key={s.slug} id={s.slug} aria-labelledby={`${s.slug}-title`} className={cn("py-16 sm:py-20", i % 2 === 0 ? "bg-white" : "bg-ivory")}>
              <div className="container-site grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
                <div data-reveal>
                  <ServiceIcon name={s.icon} className="size-14 text-brand-red" />
                  <h2 id={`${s.slug}-title`} className="mt-5 text-3xl font-bold sm:text-4xl">{s.title}</h2>
                  <p className="mt-3 font-serif text-xl italic text-navy-700">{s.tagline}</p>
                  {s.detail.map((p) => <p key={p} className="mt-4 leading-relaxed text-charcoal">{p}</p>)}
                  {!enabled && <p className="mt-4 text-sm font-semibold text-brand-red-dark">This service is not currently offered.</p>}
                </div>
                <div data-reveal className="space-y-5">
                  <div className="rounded-[var(--radius-card)] border border-line bg-ivory p-6">
                    <h3 className="font-sans text-sm font-bold uppercase tracking-wider text-navy">{s.listTitle}</h3>
                    <ul className="mt-4 space-y-3">
                      {s.list.map((f) => (
                        <li key={f} className="flex gap-3 text-[0.95rem]"><Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-red" />{f}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="border-l-2 border-navy/20 pl-4 text-sm leading-relaxed text-slate-muted">{s.note}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="relative isolate overflow-hidden bg-navy py-16 sm:py-20">
        <Image src={images.desertRoadSunset.src} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-30" />
        <div className="container-site grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="eyebrow eyebrow-light">Next step</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Looking for Transportation Support?</h2>
            <p className="mt-3 max-w-xl text-white/85">
              {settings.operational ? "Tell us about your freight requirements and desired timeline." : `${copy.prelaunch.invite}`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={settings.operational ? "/request-quote" : "/contact"} className={buttonVariants({ size: "lg" })}>
              {settings.operational ? "Request a Freight Quote" : "Contact Us"} <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/shippers" className={buttonVariants({ variant: "outlineLight", size: "lg" })}>Information for Shippers</Link>
          </div>
        </div>
      </section>
    </>
  );
}
