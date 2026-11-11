"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { nav, site } from "@/config/site";
import { Logo } from "./logo";
import { toPublicPath } from "@/components/preview/preview-context";
import { cn } from "@/lib/utils";

export function SiteHeader({ ctaLabel, ctaHref }: { ctaLabel: string; ctaHref: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on route change.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("nav a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button"));
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const publicPath = toPublicPath(pathname);
  const isActive = (href: string) => (href === "/" ? publicPath === "/" : publicPath.startsWith(href));

  return (
    <>
    <header className={cn("sticky top-0 z-50 border-b bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85 transition-shadow", scrolled ? "border-line shadow-[0_6px_24px_-18px_rgb(20_40_57/0.6)]" : "border-transparent")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-navy focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="container-site flex h-[4.5rem] items-center justify-between gap-6 lg:h-20">
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${site.name} home`}>
          <Logo className="w-[12rem] lg:w-[14.5rem]" title={null} />
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          <span aria-hidden="true" className="h-10 w-px bg-navy/25" />
          <nav aria-label="Primary">
            <ul className="flex items-center gap-1 xl:gap-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "relative rounded px-3 py-2 text-[0.92rem] font-semibold transition-colors",
                      isActive(item.href) ? "text-brand-red-dark" : "text-navy hover:text-brand-red-dark",
                      "after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded after:bg-brand-red after:transition-transform",
                      isActive(item.href) ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link href={ctaHref} className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-red px-5 text-[0.92rem] font-semibold text-white shadow-[0_8px_20px_-10px_rgb(225_37_47/0.8)] transition hover:-translate-y-px hover:bg-brand-red-dark">
            {ctaLabel} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md text-navy hover:bg-ivory-200 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

    </header>
      {open && (
        // Rendered outside <header>: its backdrop filter would otherwise trap this fixed panel.
        <div id="mobile-menu" ref={panelRef} role="dialog" aria-modal="true" aria-label="Site menu" className="fixed inset-0 z-[60] overflow-y-auto bg-navy text-white lg:hidden">
          <div className="container-site flex h-[4.5rem] items-center justify-between border-b border-white/10">
            <Link href="/" aria-label={`${site.name} home`} onClick={() => setOpen(false)}><Logo variant="reverse" className="w-[12rem]" title={null} /></Link>
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-md hover:bg-white/10" aria-label="Close menu" onClick={() => { setOpen(false); toggleRef.current?.focus(); }}>
              <X className="size-6" />
            </button>
          </div>
          <nav aria-label="Mobile" className="container-site py-6">
            <ul className="divide-y divide-white/10">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn("flex items-center justify-between py-4 font-serif text-2xl", isActive(item.href) ? "text-white" : "text-white/85")}
                  >
                    <span className={cn(isActive(item.href) && "border-b-2 border-brand-red pb-1")}>{item.label}</span>
                    <ArrowRight aria-hidden="true" className="size-5 text-brand-red" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={ctaHref} className="mt-8 flex h-13 items-center justify-center gap-2 rounded-md bg-brand-red text-base font-semibold text-white">
              {ctaLabel} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
