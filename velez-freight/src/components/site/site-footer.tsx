import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { copy, footerNav, site } from "@/config/site";
import { companyName, type PublicSettings } from "@/lib/data/settings";
import { LogoImage } from "./logo";

export function SiteFooter({ settings }: { settings: PublicSettings }) {
  const year = new Date().getFullYear();
  const legalName = companyName(settings);
  return (
    <footer className="bg-navy text-white">
      <div className="container-site grid gap-10 py-12 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-0">
        <div className="md:border-r md:border-white/20 md:pr-10">
          <Link href="/" aria-label={`${site.name} home`} className="inline-block">
            <LogoImage variant="reverse" layout="stacked" className="w-44" />
          </Link>
          <p className="mt-4 font-serif text-[0.95rem] italic text-white/90">{copy.tagline}</p>
          <p className="mt-1 text-sm text-white/75">{settings.serviceArea}</p>
          {!settings.operational && <p className="mt-3 inline-block rounded-full border border-white/25 px-3 py-1 text-xs text-white/80">Prelaunch: not yet arranging transportation</p>}
        </div>

        <nav aria-label="Footer" className="md:px-10">
          <ul className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium md:justify-center">
            {footerNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-block py-1 text-white/85 transition-colors hover:text-white hover:underline hover:decoration-brand-red hover:underline-offset-4">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/request-quote" className="inline-block py-1 text-white/85 hover:text-white hover:underline hover:decoration-brand-red hover:underline-offset-4">
                {settings.operational ? "Request a Quote" : "Business Inquiry"}
              </Link>
            </li>
          </ul>
        </nav>

        <address className="space-y-2.5 text-sm not-italic md:border-l md:border-white/20 md:pl-10">
          {settings.publicEmail && (
            <a href={`mailto:${settings.publicEmail}`} className="flex items-center gap-2.5 text-white/85 hover:text-white">
              <Mail aria-hidden="true" className="size-4 text-brand-red" /> {settings.publicEmail}
            </a>
          )}
          {settings.publicPhone && (
            <a href={`tel:${settings.publicPhone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2.5 text-white/85 hover:text-white">
              <Phone aria-hidden="true" className="size-4 text-brand-red" /> {settings.publicPhone}
            </a>
          )}
          <p className="flex items-center gap-2.5 text-white/85">
            <MapPin aria-hidden="true" className="size-4 text-brand-red" /> {settings.serviceArea}
          </p>
          <Link href="/contact" className="inline-block py-1 font-semibold text-white underline decoration-brand-red underline-offset-4">
            Contact us
          </Link>
        </address>
      </div>

      <div className="border-t border-white/10">
        <div className="container-site flex flex-col gap-3 py-5 text-xs text-white/70 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {legalName}. All rights reserved.
            {settings.preview
              ? // Launch preview: verified credentials, or a placeholder where MC and USDOT will appear.
                (["mc_number", "usdot_number"] as const).map((kind) => {
                  const c = settings.credentials.find((x) => x.kind === kind);
                  return <span key={kind} className="ml-2" data-preview-credential>{kind === "mc_number" ? "MC" : "USDOT"} {c?.value ?? "[pending verification]"}</span>;
                })
              : settings.operational &&
                settings.credentials.map((c) => <span key={c.kind} className="ml-2" data-credential={c.kind}>{c.label} {c.value}</span>)}
          </p>
          {settings.social.length > 0 && (
            <ul aria-label="Social media" className="flex gap-4">
              {settings.social.map((n) => (
                <li key={n.key}><a href={n.url} rel="noopener noreferrer me" target="_blank" className="inline-block py-1.5 hover:text-white">{n.label}<span className="sr-only"> (opens in a new tab)</span></a></li>
              ))}
            </ul>
          )}
          <ul className="flex gap-5">
            <li><Link href="/privacy" className="inline-block py-1.5 hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/terms" className="inline-block py-1.5 hover:text-white">Terms of Use</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
