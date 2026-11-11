import type { Metadata } from "next";
import { HelpCircle, Mail, MapPin, Phone, Truck, Warehouse } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { images } from "@/config/images";
import { copy, faqs } from "@/config/site";
import { PageHero, SectionHeading } from "@/components/site/page-hero";
import { ContactForm } from "@/components/forms/contact-form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Mary’s Logistics Group, a family owned freight brokerage in Maryland, with business, shipper, or carrier partnership inquiries.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSettings();
  const items = faqs(settings.operational);
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let’s Connect"
        intro="Whether you’re exploring transportation solutions, interested in becoming a carrier partner, or simply have a question, we’d welcome the opportunity to hear from you."
        image={images.desertHighwayDusk.src}
        imageAlt={images.desertHighwayDusk.alt}
        position="50% 65%"
      />
      <section aria-label="Inquiry types" className="pt-14">
        <ul className="container-site grid gap-5 md:grid-cols-3">
          {[
            { icon: HelpCircle, title: "General Questions", body: "Curious about who we are or what we’re building? Ask away." },
            { icon: Warehouse, title: "Shippers", body: "Tell us how your freight moves and what you need from a partner." },
            { icon: Truck, title: "Carriers", body: "Authorized carrier? Introduce your company and equipment." },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-8 shrink-0 text-brand-red" />
              <div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-charcoal">{body}</p></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="py-12 sm:py-16">
        <div className="container-site grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            <h2 className="text-2xl font-bold">Send us a message</h2>
            <p className="mb-6 mt-2 text-sm text-slate-muted">Tell us a little about your business and what’s on your mind. Required fields are marked with an asterisk.</p>
            <ContactForm operational={settings.operational} />
          </div>
          <aside className="space-y-6">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-7 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-bold">What happens next</h2>
              <ol className="mt-4 space-y-4">
                {copy.nextSteps.map((st, i) => (
                  <li key={st.title} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-red font-serif text-sm font-bold text-white">{i + 1}</span>
                    <span><span className="block font-semibold text-navy">{st.title}</span><span className="text-sm leading-relaxed text-charcoal">{st.body}</span></span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-[var(--radius-card)] bg-navy p-7 text-white">
              <h2 className="text-xl font-bold text-white">Contact information</h2>
              <ul className="mt-5 space-y-4 text-[0.95rem]">
                {settings.publicEmail && (
                  <li className="flex gap-3"><Mail aria-hidden="true" className="mt-0.5 size-5 text-brand-red" /><a className="underline-offset-4 hover:underline" href={`mailto:${settings.publicEmail}`}>{settings.publicEmail}</a></li>
                )}
                {settings.publicPhone && (
                  <li className="flex gap-3"><Phone aria-hidden="true" className="mt-0.5 size-5 text-brand-red" /><a className="underline-offset-4 hover:underline" href={`tel:${settings.publicPhone.replace(/[^\d+]/g, "")}`}>{settings.publicPhone}</a></li>
                )}
                <li className="flex gap-3"><MapPin aria-hidden="true" className="mt-0.5 size-5 text-brand-red" /><span>Based in {settings.serviceArea}</span></li>
              </ul>
              {!settings.publicEmail && !settings.publicPhone && (
                <p className="mt-5 text-sm text-white/75">A direct business email and phone number will be listed here once they are confirmed. Until then, the form is the best way to reach us.</p>
              )}
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-7">
              <h2 className="text-xl font-bold">Service location</h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed">We’re based in Maryland. As a freight broker we coordinate shipments with authorized carriers rather than running from a single facility, and we confirm lane availability for each shipment.</p>
            </div>
          </aside>
        </div>
      </section>
      <section id="faq" aria-labelledby="faq-title" className="bg-white py-16 sm:py-20">
        <div className="container-site max-w-3xl">
          <SectionHeading eyebrow="Frequently Asked Questions" title="Answers to common questions" id="faq-title" />
          <Accordion type="single" collapsible className="mt-8 space-y-3">
            {items.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
