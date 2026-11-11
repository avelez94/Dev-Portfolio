export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <section className="border-b-4 border-brand-red bg-navy">
        <div className="container-site py-14 sm:py-16">
          <p className="eyebrow eyebrow-light">Legal</p>
          <h1 className="mt-3 text-4xl font-bold text-white sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-white/80">Last updated {updated}</p>
        </div>
      </section>
      <section className="py-14 sm:py-16">
        <article className="container-site prose-site max-w-3xl text-[1.02rem] text-charcoal">{children}</article>
      </section>
    </>
  );
}
