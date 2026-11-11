import { site } from "@/config/site";
import { companyName, type PublicSettings } from "@/lib/data/settings";

/**
 * Organization structured data built ONLY from confirmed facts. Contact details appear only when
 * set in business settings; no address, rating, or founding details are invented.
 */
export function OrganizationSchema({ settings }: { settings: PublicSettings }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/mlg-logo-stacked.png`,
    areaServed: "US",
    address: { "@type": "PostalAddress", addressRegion: "MD", addressCountry: "US" },
  };
  // The registered legal name is added only after the owner confirms it.
  if (companyName(settings) !== site.name) data.legalName = companyName(settings);
  if (settings.publicEmail) data.email = settings.publicEmail;
  if (settings.publicPhone) data.telephone = settings.publicPhone;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
