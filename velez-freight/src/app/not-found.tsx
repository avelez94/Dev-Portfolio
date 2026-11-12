import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { buttonVariants } from "@/components/ui/button";

// Next.js adds `noindex` to not found responses automatically.
export const metadata: Metadata = { title: "Page not found" };

/** Branded 404: returns status 404 and points visitors back to the main pages. */
export default function NotFound() {
  const links = [
    { href: "/services", label: "Freight services" },
    { href: "/shippers", label: "For shippers" },
    { href: "/carriers", label: "For carriers" },
    { href: "/contact", label: "Contact us" },
  ];
  return (
    <main id="main" className="flex min-h-dvh items-center bg-ivory py-16">
      <div className="container-site max-w-xl">
        <Link href="/" aria-label="Mary’s Logistics Group home" className="inline-block"><Logo layout="horizontal" className="w-56" title={null} /></Link>
        <p className="eyebrow mt-10">Page not found</p>
        <h1 className="mt-3 text-4xl font-bold">We couldn’t find that page</h1>
        <p className="mt-4 leading-relaxed text-charcoal">The link may be out of date, or the address may have a typo. These pages are a good place to start:</p>
        <ul className="mt-6 space-y-2">
          {links.map((l) => <li key={l.href}><Link href={l.href} className="font-semibold text-brand-red-dark underline underline-offset-4">{l.label}</Link></li>)}
        </ul>
        <Link href="/" className={`${buttonVariants({ size: "lg" })} mt-8`}>Go to the homepage <ArrowRight aria-hidden="true" /></Link>
      </div>
    </main>
  );
}
