import Image from "next/image";

export function PageHero({ eyebrow, title, intro, image, imageAlt, position = "50% 50%" }: { eyebrow: string; title: string; intro?: string; image: string; imageAlt: string; position?: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-navy">
      <Image src={image} alt={imageAlt} fill preload sizes="100vw" className="-z-10 object-cover" style={{ objectPosition: position }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(20_40_57/0.93)_0%,rgb(20_40_57/0.78)_50%,rgb(20_40_57/0.45)_100%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-1.5 bg-brand-red" />
      <div className="container-site py-16 sm:py-20 lg:py-24">
        <div className="max-w-2xl animate-rise">
          <p className="eyebrow eyebrow-light flex items-center gap-3"><span aria-hidden="true" className="h-0.5 w-8 bg-brand-red" />{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.08] text-white sm:text-5xl">{title}</h1>
          {intro && <p className="mt-5 text-lg leading-relaxed text-white/90">{intro}</p>}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, intro, align = "left", id }: { eyebrow: string; title: string; intro?: string; align?: "left" | "center"; id?: string }) {
  return (
    <div data-reveal className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-bold sm:text-[2.2rem]">{title}</h2>
      {intro && <p className="mt-4 leading-relaxed text-charcoal">{intro}</p>}
    </div>
  );
}

/** Clear notice used wherever a capability depends on the company becoming operational. */
export function PrelaunchNotice({ children, title = "Not yet operating" }: { children: React.ReactNode; title?: string }) {
  return (
    <div role="note" className="rounded-lg border-l-4 border-brand-red bg-white p-5 shadow-[var(--shadow-card)]">
      <p className="font-sans text-sm font-bold uppercase tracking-wider text-brand-red-dark">{title}</p>
      <div className="mt-2 text-[0.95rem] leading-relaxed text-charcoal">{children}</div>
    </div>
  );
}
