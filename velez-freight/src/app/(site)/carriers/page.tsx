import type { Metadata } from "next";
import { Check, FileSignature, Handshake, LockKeyhole, Mail, MessagesSquare, Truck } from "lucide-react";
import { getSettings } from "@/lib/data/settings";
import { images } from "@/config/images";
import { copy } from "@/config/site";
import { PageHero, PrelaunchNotice, SectionHeading } from "@/components/site/page-hero";
import { CarrierForm } from "@/components/forms/carrier-form";

export const metadata: Metadata = {
  title: "Carrier Partnerships",
  description: "Velez Freight Group aims to build relationships with authorized motor carriers who value communication, safety, professionalism, and consistent service.",
  alternates: { canonical: "/carriers" },
};

const equipment = ["Cargo vans and Sprinter vans", "Box trucks", "Dry vans", "Flatbeds and other appropriate equipment types"];

const approach = [
  { icon: MessagesSquare, title: "Professional Communication", body: "Clear shipment information, defined expectations, and timely coordination." },
  { icon: FileSignature, title: "Transparent Agreements", body: "Written rates, agreed payment terms, and documented responsibilities." },
  { icon: Handshake, title: "Respect for Carrier Operations", body: "A practical understanding of scheduling, equipment capabilities, and the importance of accurate freight information." },
];

const qualification = [
  "Applicable active operating authority",
  "Appropriate insurance",
  "Business identity and contact information",
  "Equipment capabilities",
  "Safety and compliance information",
  "Required onboarding documentation",
];

const onboarding = [
  ["Introduce your company", "Send the short inquiry form below. We only ask for contact, authority, equipment, and lane information."],
  ["Independent verification", "We confirm authority, insurance on file, and safety information through official FMCSA sources rather than relying on what was typed into a form."],
  ["Secure document collection", "Insurance certificates, tax forms, and payment details are collected later through a separate secure process, never through this website form or by plain email."],
  ["Written agreement", "A signed broker and carrier agreement is in place before any load is offered."],
] as const;

export default async function CarriersPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHero
        eyebrow="For Carriers"
        title="Let’s Build Strong Freight Partnerships"
        intro="Reliable transportation depends on professional carriers who take pride in their work."
        image={images.desertRoadSunset.src}
        imageAlt={images.desertRoadSunset.alt}
        position="50% 60%"
      />

      <section className="py-16 sm:py-20">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="font-serif text-2xl leading-snug text-navy">
              Velez Freight Group aims to build relationships with authorized motor carriers who value communication, safety, professionalism, and consistent service.
            </p>
            {!settings.operational && (
              <PrelaunchNotice>
                {copy.prelaunch.title} We are not offering loads yet and do not have an established carrier network. You are welcome to introduce your company now. Submitting an inquiry does not create a carrier agreement.
              </PrelaunchNotice>
            )}
          </div>
          <div className="rounded-[var(--radius-card)] bg-navy p-7 text-white sm:p-9">
            <h2 className="text-2xl font-bold text-white">Who We’re Looking to Work With</h2>
            <p className="mt-2 text-[0.95rem] text-white/85">We welcome inquiries from motor carriers operating suitable equipment, including:</p>
            <ul className="mt-5 space-y-3">
              {equipment.map((e) => (
                <li key={e} className="flex gap-3"><Truck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-red" />{e}</li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-white/75">Available opportunities will depend on shipper demand and carrier qualifications.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="approach-title" className="bg-white py-16 sm:py-20">
        <div className="container-site">
          <SectionHeading id="approach-title" eyebrow="How we work" title="Our Partnership Approach" />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {approach.map(({ icon: Icon, title, body }) => (
              <li key={title} data-reveal className="rounded-[var(--radius-card)] border border-line bg-ivory p-6">
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-9 text-brand-red" />
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-charcoal">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Eligibility" title="Carrier Qualification" intro="Before transportation is arranged, carriers may be required to provide or verify:" />
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {qualification.map((q) => (
                <li key={q} className="flex gap-3 rounded-lg border border-line bg-white p-4 text-[0.95rem]"><Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-red" />{q}</li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Secure onboarding" title="How onboarding works" />
            <ol className="mt-6 space-y-5">
              {onboarding.map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-red font-serif font-bold text-white">{i + 1}</span>
                  <div><h3 className="text-lg font-bold">{t}</h3><p className="mt-1 text-[0.95rem] leading-relaxed text-charcoal">{b}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-8 rounded-lg border border-line bg-white p-5 text-sm">
              <p className="flex items-center gap-2 font-semibold text-navy"><LockKeyhole aria-hidden="true" className="size-4 text-brand-red" /> Protecting your information</p>
              <p className="mt-2 leading-relaxed">We never ask for Social Security numbers, bank logins, or sensitive documents through a public web form. Treat any such request that appears to come from us with caution and contact us directly.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="carrier-inquiry" aria-labelledby="carrier-form-title" className="bg-white py-16 sm:py-20">
        <div className="container-site grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="eyebrow">Carrier inquiry</p>
            <h2 id="carrier-form-title" className="mt-3 text-3xl font-bold sm:text-4xl">Interested in Partnering With Us?</h2>
            <p className="mt-4 text-lg leading-relaxed">Introduce your company and equipment.</p>
            <p className="mt-4 text-sm leading-relaxed text-slate-muted">Inquiries do not constitute approval or guarantee freight opportunities.</p>
            {settings.publicEmail && (
              <p className="mt-6 flex items-center gap-2 text-sm"><Mail aria-hidden="true" className="size-4 text-brand-red" /> Questions? <a className="font-semibold text-brand-red-dark underline" href={`mailto:${settings.publicEmail}`}>{settings.publicEmail}</a></p>
            )}
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-ivory p-6 shadow-[var(--shadow-card)] sm:p-8">
            <p className="mb-6 text-sm text-slate-muted">Required fields are marked with an asterisk.</p>
            <CarrierForm />
          </div>
        </div>
      </section>
    </>
  );
}
