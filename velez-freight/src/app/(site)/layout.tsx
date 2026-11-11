import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { StatusBar } from "@/components/site/status-bar";
import { RevealOnScroll } from "@/components/site/reveal";
import { getSettings } from "@/lib/data/settings";

// Public pages re-read business settings (operating status, contact details) at most once a minute.
export const revalidate = 60;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <StatusBar operational={settings.operational} message={settings.statusMessage} />
      <SiteHeader ctaLabel={settings.operational ? "Request a Quote" : "Business Inquiry"} ctaHref="/request-quote" />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter settings={settings} />
      <RevealOnScroll />
    </>
  );
}
