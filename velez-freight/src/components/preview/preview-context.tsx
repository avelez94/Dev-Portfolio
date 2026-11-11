"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitCarrier, submitContact, submitQuote } from "@/app/actions/public";
import { simulatePreviewSubmission } from "@/app/admin/preview/actions";

export const PREVIEW_BASE = "/admin/preview";

const PreviewContext = createContext(false);

export function usePreview() {
  return useContext(PreviewContext);
}

/** Maps a public path to its launch preview twin when the preview is active. */
export function usePreviewHref() {
  const preview = usePreview();
  return (href: string) => (preview && href.startsWith("/") && !href.startsWith("/admin") ? `${PREVIEW_BASE}${href === "/" ? "" : href}` : href);
}

/** Strips the preview prefix so navigation highlighting works the same in both modes. */
export function toPublicPath(pathname: string) {
  return pathname.startsWith(PREVIEW_BASE) ? pathname.slice(PREVIEW_BASE.length) || "/" : pathname;
}

/**
 * Form submitters. On the public site they call the real server actions. Inside the launch
 * preview they call a simulation that validates and returns a PREVIEW reference without saving.
 */
export function useSubmitters() {
  const preview = usePreview();
  return {
    contact: (values: unknown, envelope: unknown, sourcePage?: string) => (preview ? simulatePreviewSubmission("contact", values) : submitContact(values, envelope, sourcePage)),
    carrier: (values: unknown, envelope: unknown) => (preview ? simulatePreviewSubmission("carrier", values) : submitCarrier(values, envelope)),
    quote: (values: unknown, envelope: unknown) => (preview ? simulatePreviewSubmission("quote", values) : submitQuote(values, envelope)),
  };
}

/** Keeps navigation inside the preview: internal links are rewritten to their preview twins. */
function LinkInterceptor() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/admin") || /\.\w{2,5}$/.test(href.split(/[?#]/)[0])) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(`${PREVIEW_BASE}${href === "/" ? "" : href}`);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [router]);
  return null;
}

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <PreviewContext.Provider value={true}>
      <LinkInterceptor />
      {children}
    </PreviewContext.Provider>
  );
}
