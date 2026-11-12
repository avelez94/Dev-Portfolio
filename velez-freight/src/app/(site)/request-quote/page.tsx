import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ShieldCheck } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { copy } from "@/config/site";
import { images } from "@/config/images";
import { PageHero, PrelaunchNotice } from "@/components/site/page-hero";
import { QuoteWizard } from "@/components/forms/quote-wizard";
import { ContactForm } from "@/components/forms/contact-form";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("requestQuote", (await getSettings()).operational);
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 300);

export default async function RequestQuotePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const settings = await getSettings();
  const sp = await searchParams;
  const prefill = { pickup: one(sp.pickup), delivery: one(sp.delivery), type: one(sp.type), weight: one(sp.weight)?.replace(/\D/g, ""), date: one(sp.date)?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] };

  return (
    <>
      <PageHero
        eyebrow={settings.operational ? "Freight Inquiry" : "Business Inquiry"}
        title={settings.operational ? "Tell Us About Your Freight" : "Tell Us About Your Business"}
        intro={
          settings.operational
            ? "Every shipment begins with the details. Share what you can, and a real person will review it and reach out to talk through options."
            : "We’d love to learn how your freight moves and what matters most to you. We’ll reply personally."
        }
        image={images.desertHighwayDusk.src}
        imageAlt={images.desertHighwayDusk.alt}
        position="50% 65%"
      />
      <section className="py-14 sm:py-20">
        <div className="container-site grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[var(--radius-card)] border border-line bg-ivory p-6 shadow-[var(--shadow-card)] sm:p-9">
            {settings.operational ? (
              <QuoteWizard prefill={prefill} />
            ) : (
              <>
                <h2 className="text-2xl font-bold">Start the conversation</h2>
                <p className="mb-6 mt-2 text-sm text-slate-muted">A few details are all we need. Required fields are marked with an asterisk.</p>
                <ContactForm defaultType="shipper" sourcePage="/request-quote" operational={false} />
              </>
            )}
          </div>
          <aside className="space-y-6">
            {settings.operational ? (
              <div className="rounded-[var(--radius-card)] bg-navy p-7 text-white">
                <h2 className="text-xl font-bold text-white">What happens next</h2>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-[0.95rem] text-white/90">
                  <li>Your inquiry is saved as pending review.</li>
                  <li>We review the route, freight, and requirements.</li>
                  <li>We contact you to confirm details and discuss options.</li>
                  <li>Any price is prepared manually and confirmed in writing before anything is booked.</li>
                </ol>
              </div>
            ) : (
              <>
                <div className="rounded-[var(--radius-card)] bg-navy p-7 text-white">
                  <h2 className="text-xl font-bold text-white">What happens next</h2>
                  <ol className="mt-4 space-y-4">
                    {copy.nextSteps.map((st, i) => (
                      <li key={st.title} className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-red font-serif text-sm font-bold">{i + 1}</span>
                        <span><span className="block font-semibold">{st.title}</span><span className="text-sm text-white/80">{st.body}</span></span>
                      </li>
                    ))}
                  </ol>
                </div>
                <PrelaunchNotice title="Opening soon">{copy.prelaunch.short}</PrelaunchNotice>
              </>
            )}
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-sm leading-relaxed">
              <p className="flex items-center gap-2 font-semibold text-navy"><ShieldCheck aria-hidden="true" className="size-4 text-brand-red" /> Privacy</p>
              <p className="mt-2">We collect only what is needed to respond to your inquiry and never sell your information. See our <a href="/privacy" className="font-semibold text-brand-red-dark underline">privacy policy</a>.</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
