import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { images } from "@/config/images";
import { PageHero } from "@/components/site/page-hero";
import { LogoMark } from "@/components/site/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Our Story",
  description: "Velez Freight Group was inspired by Elanisoa Devon Velez and a family tradition of entrepreneurship, dedication, and building opportunities for future generations.",
  alternates: { canonical: "/our-story" },
};

const values = [
  { title: "Work ethic", body: "Showing up prepared, following through, and doing the unglamorous details well." },
  { title: "Integrity and accountability", body: "Saying what we can do, doing what we said, and being honest when something is not a fit." },
  { title: "Relationships", body: "Treating customers and carriers as long term partners, not single transactions." },
  { title: "The next generation", body: "Building something that lasts and that the family can be proud to carry forward." },
];

export default async function OurStoryPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHero
        eyebrow="Our Story"
        title="Built on Family. Driven to Move Forward."
        intro="Behind Velez Freight Group is a meaningful family legacy."
        image={images.openRoadSunrise.src}
        imageAlt={images.openRoadSunrise.alt}
        position="50% 60%"
      />

      <section className="relative overflow-hidden py-16 sm:py-24">
        <LogoMark className="pointer-events-none absolute -right-24 top-10 w-[36rem] opacity-[0.05]" />
        <div className="container-site relative grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <article className="prose-site max-w-2xl text-[1.05rem] text-charcoal">
            <p className="font-serif text-2xl leading-snug text-navy">
              The company was inspired by Elanisoa Devon Velez and a family tradition of entrepreneurship, dedication, and building opportunities for future generations.
            </p>
            <p>He has always honored his mother, Mary, through his businesses. Velez Freight Group carries that legacy forward.</p>
            <p>
              That inspiration helped shape our vision: to establish a freight brokerage grounded in integrity, accountability, and genuine business relationships.
            </p>
            <p>
              We believe successful transportation partnerships require more than rates and schedules. They require attention to detail, clear communication, and respect for the people and businesses involved.
            </p>
            <p>
              Velez Freight Group carries forward the values that inspired its beginning while looking toward the future of freight and logistics.
            </p>
            <p className="font-serif text-xl leading-snug text-navy">Our name reflects where we come from. Our commitment reflects where we’re going.</p>
            <p className="font-serif text-xl italic text-brand-red-dark">Built on family. Driven to move forward.</p>
          </article>

          <aside className="space-y-6">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)]">
              <Image src={images.roadSunriseHills.src} alt={images.roadSunriseHills.alt} fill sizes="(min-width:1024px) 35vw, 100vw" className="object-cover" />
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-navy py-16 sm:py-20">
        <div className="container-site">
          <p className="eyebrow eyebrow-light">What guides us</p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">The values we carry forward</h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <li key={v.title} data-reveal className="border-t-2 border-brand-red pt-5">
                <h3 className="text-xl font-bold text-white">{v.title}</h3>
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
            <p className="mt-4 leading-relaxed">Velez Freight Group is operating as a licensed freight broker{settings.mcNumber ? ` (MC ${settings.mcNumber})` : ""}. Contact us to discuss your shipment.</p>
          ) : (
            <>
              <p className="mt-4 leading-relaxed text-charcoal">
                We are being transparent about where the company stands. Velez Freight Group is in its prelaunch stage, and we will not arrange transportation until every requirement below is complete and verified.
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
