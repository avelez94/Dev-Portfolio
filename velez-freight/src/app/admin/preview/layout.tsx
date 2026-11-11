import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { enablePreviewMode } from "@/lib/preview-mode";
import { getSettings } from "@/lib/data/settings";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RevealOnScroll } from "@/components/site/reveal";
import { PreviewProvider } from "@/components/preview/preview-context";
import { PreviewBar } from "@/components/preview/preview-bar";

export const metadata: Metadata = {
  title: { default: "Launch preview", template: "%s | Launch preview" },
  robots: { index: false, follow: false, nocache: true },
};

// Authenticated, per request, never cached, never indexed (see also the /admin headers).
export const dynamic = "force-dynamic";

export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  enablePreviewMode();
  const settings = await getSettings();
  return (
    <PreviewProvider>
      <div className="bg-ivory">
        <SiteHeader ctaLabel="Request a Quote" ctaHref="/request-quote" />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <SiteFooter settings={settings} />
        {/* Room for the fixed preview bar so it never covers the footer. */}
        <div aria-hidden="true" className="h-32 bg-navy sm:h-20" />
      </div>
      <RevealOnScroll />
      <PreviewBar />
    </PreviewProvider>
  );
}
