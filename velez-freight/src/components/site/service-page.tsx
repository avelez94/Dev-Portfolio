import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ClipboardList } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { SERVICE_PAGES, servicePageFor } from "@/config/service-pages";
import { SEO, type PageSeo } from "@/config/seo";
import { copy } from "@/config/site";
import { images } from "@/config/images";
import { JsonLd, ORG_ID, absoluteUrl } from "@/lib/seo";
import { PageHero, PrelaunchNotice } from "@/components/site/page-hero";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ServiceIcon } from "@/components/home/icons";
import { buttonVariants } from "@/components/ui/button";

/** One service page: education first, then how we approach it, what to share, and next steps. */
export async function ServicePageView({ slug }: { slug: "expedited" | "dedicated" | "general" }) {
  const page = servicePageFor(slug);
  if (!page) notFound();
  const settings = await getSettings();
  const op = settings.operational;
  const offered = settings.services[slug];
  const others = SERVICE_PAGES.filter((s) => s.slug !== slug);

  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.h1} intro={page.intro} image={page.image.src} imageAlt={page.image.alt} position={page.image.position} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Services", path: "/services" }, { name: page.name, path: page.route }]} />

      <section className="py-16 sm:py-20">
        <div className="container-site grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <div data-reveal className="space-y-5">
            {!op && <PrelaunchNotice title="Planned service">{copy.prelaunch.short}</PrelaunchNotice>}
            {!offered && <p className="rounded-md border border-line bg-white p-4 text-sm font-semibold text-brand-red-dark">This service is not currently offered.</p>}
            <p className="font-serif text-2xl leading-snug text-navy">{op ? page.lead.op : page.lead.pre}</p>
            <h2 className="pt-2 text-3xl font-bold">{page.explainTitle}</h2>
            {page.explain.map((p) => <p key={p} className="leading-relaxed text-charcoal">{p}</p>)}
          </div>
          <div data-reveal className="space-y-5">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <ServiceIcon name={slug} className="size-12 text-brand-red" />
              <h2 className="mt-4 font-sans text-sm font-bold uppercase tracking-wider text-navy">{page.usesTitle}</h2>
              <ul className="mt-4 space-y-3">
                {page.uses.map((u) => <li key={u} className="flex gap-3 text-[0.95rem]"><Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-red" />{u}</li>)}
              </ul>
            </div>
            <p className="border-l-2 border-navy/20 pl-4 text-sm leading-relaxed text-slate-muted">{page.note}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="approach-title" className="bg-navy py-16 sm:py-20">
        <div className="container-site">
          <p className="eyebrow eyebrow-light">Our approach</p>
          <h2 id="approach-title" className="mt-3 text-3xl font-bold text-white sm:text-4xl">{page.approachTitle}</h2>
          <p className="mt-4 max-w-2xl text-white/85">{op ? page.approachIntro.op : page.approachIntro.pre}</p>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {page.approach.map((a, i) => (
              <li key={a.title} data-reveal className="rounded-[var(--radius-card)] border border-white/15 bg-white/[0.06] p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-red font-serif text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold text-white">{a.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/85">{a.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-site grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <p className="eyebrow">Getting started</p>
            <h2 className="mt-3 text-3xl font-bold">What to share about your shipment</h2>
            <p className="mt-4 leading-relaxed text-charcoal">Have these handy if you can. If you don’t have everything yet, we’ll work through it together.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {page.share.map((s) => <li key={s} className="flex gap-3 rounded-md border border-line bg-white p-3 text-[0.95rem]"><ClipboardList aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-red" />{s}</li>)}
            </ul>
          </div>
          {page.compare ? (
            <div data-reveal>
              <h2 className="text-3xl font-bold">{page.compare.title}</h2>
              <p className="mt-3 text-charcoal">{page.compare.intro}</p>
              <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
                <table className="w-full text-left text-[0.95rem]">
                  <thead className="bg-ivory"><tr>{page.compare.head.map((h, i) => <th key={i} scope="col" className="px-4 py-3 font-semibold text-navy">{h || <span className="sr-only">Aspect</span>}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {page.compare.rows.map((r) => <tr key={r[0]}><th scope="row" className="px-4 py-3 font-semibold text-navy">{r[0]}</th><td className="px-4 py-3">{r[1]}</td><td className="px-4 py-3">{r[2]}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div data-reveal className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)]">
              <Image src={images.loadingDocks.src} alt={images.loadingDocks.alt} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="related-title" className="bg-white py-16 sm:py-20">
        <div className="container-site">
          <h2 id="related-title" className="text-2xl font-bold sm:text-3xl">Related services</h2>
          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={o.route} className="group flex h-full items-start gap-4 rounded-[var(--radius-card)] border border-line bg-ivory p-5 hover:border-brand-red/40">
                  <ServiceIcon name={o.slug} className="mt-0.5 size-9 shrink-0 text-brand-red" />
                  <span><span className="block font-serif text-lg font-bold text-navy">{o.name}</span><span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark">Learn more <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></span></span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/shippers" className="group flex h-full items-start gap-4 rounded-[var(--radius-card)] border border-line bg-ivory p-5 hover:border-brand-red/40">
                <span><span className="block font-serif text-lg font-bold text-navy">Working with us as a shipper</span><span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark">What to expect <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></span></span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-navy py-16 sm:py-20">
        <Image src={images.roadSunsetFields.src} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-30" />
        <div className="container-site grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">{op ? "Have a shipment coming up?" : "Let’s talk about your freight"}</h2>
            <p className="mt-3 max-w-xl text-white/85">{op ? "Share the details and a person will review your request and reply with options." : "Tell us how your freight moves today. We’ll reply personally, and there’s no commitment."}</p>
          </div>
          <Link href={op ? "/request-quote" : "/contact"} className={buttonVariants({ size: "lg" })}>
            {op ? "Request a Freight Quote" : "Let’s Talk Freight"} <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      {op && offered && (
        <JsonLd data={{
          "@context": "https://schema.org", "@type": "Service", name: page.name, serviceType: page.name,
          description: (SEO[page.seoKey] as PageSeo).operational?.description ?? SEO[page.seoKey].description,
          url: absoluteUrl(page.route), provider: { "@id": ORG_ID() }, areaServed: { "@type": "Country", name: "United States" },
        }} />
      )}
    </>
  );
}
