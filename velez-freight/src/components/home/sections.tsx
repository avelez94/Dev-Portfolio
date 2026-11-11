import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LogoMark } from "@/components/site/logo";
import { copy, faqs, pillars, processSteps, services } from "@/config/site";
import { images } from "@/config/images";
import type { PublicSettings } from "@/lib/data/settings";
import { PillarIcon, RouteLine, ServiceIcon } from "./icons";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// B. Hero
// ---------------------------------------------------------------------------
export function Hero({ operational }: { operational: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-navy">
      <Image
        src={images.heroTruck.src}
        alt={images.heroTruck.alt}
        fill
        preload
        sizes="100vw"
        quality={75}
        className="-z-10 object-cover object-[68%_45%] animate-fade"
      />
      {/* Navy overlay: strong on the text side, opening up over the truck */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(20_40_57/0.93)_0%,rgb(20_40_57/0.78)_36%,rgb(20_40_57/0.25)_68%,rgb(20_40_57/0.05)_100%)]" />
      {/* Warm sunset grade over the sky, matching the approved mockup's golden hour tone */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_78%_8%,rgb(242_140_72/0.85),rgb(225_37_47/0.3)_45%,transparent_78%)] mix-blend-soft-light" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_72%_22%,rgb(246_166_96/0.38),transparent_70%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-navy/70 to-transparent" />

      <div className="container-site pb-36 pt-16 sm:pb-40 sm:pt-20 lg:pb-44 lg:pt-24">
        <div className="max-w-2xl">
          <h1 id="hero-title" className="animate-rise font-serif text-[2.35rem] font-bold leading-[1.04] text-white min-[400px]:text-[2.6rem] sm:text-6xl lg:text-[4.4rem]">
            Your freight.
            <br />
            Our commitment.
            <br />
            <span className="relative inline-block italic text-brand-red">
              Every mile.
              <svg aria-hidden="true" viewBox="0 0 300 12" className="absolute -bottom-2 left-0 w-full" preserveAspectRatio="none"><path d="M2 9 C 90 2, 200 2, 298 6" stroke="#E1252F" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
            </span>
          </h1>
          <p className="mt-8 max-w-xl animate-rise text-lg leading-relaxed text-white/90 [animation-delay:120ms]">
            {copy.hero.body}
          </p>
          <div className="mt-9 flex animate-rise flex-col gap-3 [animation-delay:220ms] sm:flex-row sm:gap-4">
            {operational ? (
              <Link href="/request-quote" className={buttonVariants({ size: "lg" })}>
                Request a Freight Quote <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/contact" className={buttonVariants({ size: "lg" })}>
                Contact Us <ArrowRight aria-hidden="true" />
              </Link>
            )}
            <Link href="/services" className={buttonVariants({ variant: "outlineLight", size: "lg" })}>
              Explore Our Services
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// D. Services
// ---------------------------------------------------------------------------
export function ServicesSection({ settings }: { settings: PublicSettings }) {
  const available = services.filter((s) => settings.services[s.slug]);
  return (
    <section aria-labelledby="services-title" className="relative overflow-hidden py-20 sm:py-24">
      <RouteLine className="pointer-events-none absolute inset-x-0 top-8 hidden h-28 w-full md:block" />
      <div className="container-site relative">
        <div data-reveal className="text-center">
          <p className="eyebrow">Our Services</p>
          <div className="mt-3 flex items-center justify-center gap-5">
            <span aria-hidden="true" className="hidden h-0.5 w-12 bg-brand-red sm:block" />
            <h2 id="services-title" className="text-3xl font-bold sm:text-[2.4rem]">{copy.servicesIntro.title}</h2>
            <span aria-hidden="true" className="hidden h-0.5 w-12 bg-brand-red sm:block" />
          </div>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-charcoal">{copy.servicesIntro.body}</p>
          {!settings.operational && (
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-muted">These services will become available once our broker registration is complete.</p>
          )}
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {available.map((s, i) => (
            <li key={s.slug} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <Link
                href={`/services#${s.slug}`}
                className="group flex h-full items-start gap-5 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:border-brand-red/40 hover:shadow-[var(--shadow-float)]"
              >
                <ServiceIcon name={s.icon} className="mt-1 size-12 shrink-0 text-brand-red" />
                <span>
                  <span className="block font-serif text-xl font-bold text-navy">{s.title}</span>
                  <span className="mt-2 block text-[0.93rem] leading-relaxed text-charcoal">{s.summary}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark">
                    Learn more <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Link href="/services" className={buttonVariants({ variant: "outline" })}>
            Explore Our Services <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// E. How it works (split: warehouse photo | navy steps)
// ---------------------------------------------------------------------------
export function ProcessSection() {
  return (
    <section aria-labelledby="process-title" className="relative grid bg-navy lg:grid-cols-[40%_60%]">
      <div className="relative h-64 sm:h-80 lg:h-auto">
        <Image src={images.loadingDocks.src} alt={images.loadingDocks.alt} fill sizes="(min-width:1024px) 40vw, 100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgb(242_140_72/0.28),rgb(20_40_57/0.25))] mix-blend-multiply" />
        {/* Diagonal edge with a red accent stripe */}
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-y-0 right-[-1px] hidden h-full w-28 lg:block">
          <polygon points="62,0 100,0 100,100 22,100" fill="#142839" />
          <polygon points="56,0 64,0 24,100 16,100" fill="#E1252F" />
        </svg>
      </div>
      <div className="px-4 py-16 sm:px-10 lg:py-20 lg:pl-6 lg:pr-12 xl:pr-20">
        <p className="eyebrow eyebrow-light">How It Works</p>
        <h2 id="process-title" className="mt-3 text-3xl font-bold text-white sm:text-[2.4rem]">A Simple, Reliable Process</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
          {processSteps.map((step, i) => (
            <li key={step.title} data-reveal style={{ transitionDelay: `${i * 110}ms` }} className="relative text-center">
              {i < processSteps.length - 1 && (
                <span aria-hidden="true" className="absolute left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] top-6 hidden border-t-2 border-dashed border-white/35 md:block">
                  <ArrowRight className="absolute -right-1 -top-[0.6rem] size-4 text-white/60" />
                </span>
              )}
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-red font-serif text-xl font-bold text-white shadow-[0_0_0_6px_rgb(225_37_47/0.18)]">
                {i + 1}
              </span>
              <h3 className="mt-5 text-xl font-bold leading-snug text-white">{step.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-[0.93rem] leading-relaxed text-white/85">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// F. Why choose
// ---------------------------------------------------------------------------
export function WhySection() {
  return (
    <section aria-labelledby="why-title" className="py-20 sm:py-24">
      <div className="container-site grid gap-12 lg:grid-cols-[20rem_1fr] lg:items-center">
        <div data-reveal>
          <p className="eyebrow flex items-center gap-3"><span aria-hidden="true" className="h-0.5 w-8 bg-brand-red" /> Why Choose</p>
          <h2 id="why-title" className="mt-3 text-4xl font-bold leading-[1.05] sm:text-[2.7rem]">Velez Freight Group</h2>
          <p className="mt-4 font-serif text-lg font-semibold leading-snug text-navy-700">{copy.why.title}</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-charcoal">{copy.why.body}</p>
        </div>
        <ul className="grid gap-10 sm:grid-cols-3 sm:gap-0">
          {pillars.map((p, i) => (
            <li key={p.title} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className={cn("text-center sm:px-6", i > 0 && "sm:border-l sm:border-navy/15")}>
              <PillarIcon name={p.icon} className="mx-auto size-11 text-brand-red" />
              <h3 className="mt-4 text-xl font-bold">{p.title}</h3>
              <p className="mx-auto mt-2 max-w-[17rem] text-[0.93rem] leading-relaxed text-charcoal">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// G. Our story teaser
// ---------------------------------------------------------------------------
export function StoryTeaser() {
  return (
    <section aria-labelledby="story-title" className="relative grid overflow-hidden bg-ivory-200/60 lg:grid-cols-[42%_58%]">
      <div className="relative h-64 sm:h-80 lg:h-auto lg:min-h-[26rem]">
        <Image src={images.roadSunriseHills.src} alt={images.roadSunriseHills.alt} fill sizes="(min-width:1024px) 42vw, 100vw" className="object-cover" />
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-y-0 right-[-1px] hidden h-full w-28 lg:block">
          <polygon points="62,0 100,0 100,100 22,100" fill="#F2EFE8" />
          <polygon points="56,0 64,0 24,100 16,100" fill="#E1252F" />
        </svg>
      </div>
      <div className="relative px-4 py-16 sm:px-10 lg:py-20 lg:pl-8 lg:pr-12 xl:pr-24">
        <LogoMark className="pointer-events-none absolute -right-16 bottom-0 w-[30rem] opacity-[0.06]" />
        <div data-reveal className="relative max-w-xl">
          <p className="eyebrow">Our Story</p>
          <h2 id="story-title" className="mt-3 text-3xl font-bold sm:text-[2.4rem]">A Family Legacy in Freight</h2>
          {copy.storyTeaser.map((p) => (
            <p key={p} className="mt-4 leading-relaxed text-charcoal">{p}</p>
          ))}
          <p className="mt-5 font-serif text-xl italic text-brand-red-dark">{copy.tagline}</p>
          <Link href="/our-story" className={cn(buttonVariants({ variant: "outline" }), "mt-7")}>
            Discover Our Story <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// H + I. Carrier partnerships and FAQ (split row)
// ---------------------------------------------------------------------------
export function CarrierAndFaq({ operational }: { operational: boolean }) {
  const items = faqs(operational).slice(0, 3);
  return (
    <section aria-label="Carrier partnerships and frequently asked questions" className="grid lg:grid-cols-2">
      <div className="relative isolate overflow-hidden bg-navy">
        <div className="relative h-56 sm:h-72 lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[42%]">
          <Image src={images.redTruck.src} alt={images.redTruck.alt} fill sizes="(min-width:1024px) 21vw, 100vw" className="object-cover object-[62%_64%]" />
        </div>
        {/* Diagonal navy panel with the signature red stripe */}
        {/* Diagonal edge confined to the photo area (28% to 42%) so it never sits behind the text */}
        <div aria-hidden="true" className="absolute inset-y-0 left-[28%] hidden w-[14%] bg-navy lg:block lg:[clip-path:polygon(100%_0,100%_100%,14.3%_100%)]" />
        <div aria-hidden="true" className="absolute inset-y-0 left-[28%] hidden w-[14%] bg-brand-red lg:block lg:[clip-path:polygon(88.6%_0,100%_0,14.3%_100%,2.9%_100%)]" />
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-y-0 right-[-1px] z-10 hidden h-full w-20 lg:block">
          <polygon points="78,0 100,0 100,100 30,100" fill="#F7F5F0" />
          <polygon points="72,0 80,0 32,100 24,100" fill="#E1252F" />
        </svg>
        <div className="relative px-4 py-14 sm:px-10 lg:py-20 lg:pl-[45%] lg:pr-20">
          <div data-reveal>
            <p className="eyebrow eyebrow-light">Carrier Partnerships</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-[2.1rem]">Haul With Velez Freight Group</h2>
            {copy.carrierTeaser.map((p) => (
              <p key={p} className="mt-4 text-[0.95rem] leading-relaxed text-white/88">{p}</p>
            ))}
            <p className="mt-4 font-semibold text-white">{copy.carrierTeaserAsk}</p>
            <Link href="/carriers#carrier-inquiry" className={cn(buttonVariants(), "mt-6")}>
              Carrier Partnership Inquiry <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
      <div className="bg-ivory px-4 py-16 sm:px-10 lg:py-20 lg:pl-14 lg:pr-12 xl:pr-20">
        <div data-reveal className="max-w-xl">
          <p className="eyebrow">Frequently Asked Questions</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-[2.2rem]">Good to Know</h2>
          <Accordion type="single" collapsible className="mt-7 space-y-3">
            {items.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Link href="/contact#faq" className="mt-6 inline-flex items-center gap-2 font-serif text-lg font-semibold italic text-brand-red-dark hover:underline">
            View All FAQs <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// J. Final call to action
// ---------------------------------------------------------------------------
export function FinalCta({ operational }: { operational: boolean }) {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-navy">
      <Image src={images.roadSunsetFields.src} alt={images.roadSunsetFields.alt} fill sizes="100vw" className="-z-10 object-cover object-[50%_60%]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(20_40_57/0.4),rgb(20_40_57/0.72))]" />
      <div className="container-site py-20 text-center sm:py-24">
        <div data-reveal>
          <p className="eyebrow eyebrow-light flex items-center justify-center gap-4">
            <span aria-hidden="true" className="h-px w-10 bg-white/60" />
            {operational ? "Ready to move your freight?" : "Preparing to launch"}
            <span aria-hidden="true" className="h-px w-10 bg-white/60" />
          </p>
          <h2 id="cta-title" className="mt-4 text-4xl font-bold text-white sm:text-5xl">
            {operational ? copy.finalCta.title : copy.prelaunch.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/90">
            {operational ? copy.finalCta.body : `${copy.prelaunch.body} ${copy.prelaunch.invite}`}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            {operational ? (
              <>
                <Link href="/request-quote" className={buttonVariants({ size: "lg" })}>
                  Request a Freight Quote <ArrowRight aria-hidden="true" />
                </Link>
                <Link href="/contact" className={buttonVariants({ variant: "outlineLight", size: "lg" })}>Contact Us</Link>
              </>
            ) : (
              <Link href="/contact" className={buttonVariants({ size: "lg" })}>
                Contact Us <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
