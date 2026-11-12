import { site } from "@/config/site";
import { companyName, type PublicSettings } from "@/lib/data/settings";
import { JsonLd, ORG_ID, absoluteUrl } from "@/lib/seo";

/**
 * Organization structured data built ONLY from confirmed facts. Contact details, social profiles
 * and the legal name appear only when the owner has entered or confirmed them; no street address,
 * rating, award, license or founding date is stated.
 */
export function OrganizationSchema({ settings }: { settings: PublicSettings }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID(),
    name: site.name,
    url: absoluteUrl("/"),
    description: site.description,
    logo: { "@type": "ImageObject", url: absoluteUrl("/brand/mlg-logo-stacked.png"), width: 1200, height: 625 },
    image: absoluteUrl("/og-image.jpg"),
    founder: { "@type": "Person", name: "Alante Velez", jobTitle: "Founder & CEO" },
    areaServed: { "@type": "Country", name: "United States" },
    address: { "@type": "PostalAddress", addressRegion: "MD", addressCountry: "US" },
  };
  if (companyName(settings) !== site.name) data.legalName = companyName(settings);
  if (settings.publicEmail) data.email = settings.publicEmail;
  if (settings.publicPhone) data.telephone = settings.publicPhone;
  if (settings.publicEmail || settings.publicPhone) {
    data.contactPoint = { "@type": "ContactPoint", contactType: "customer service", areaServed: "US", availableLanguage: "English", ...(settings.publicEmail ? { email: settings.publicEmail } : {}), ...(settings.publicPhone ? { telephone: settings.publicPhone } : {}) };
  }
  if (settings.social.length) data.sameAs = settings.social.map((s) => s.url);
  return <JsonLd data={data} />;
}
