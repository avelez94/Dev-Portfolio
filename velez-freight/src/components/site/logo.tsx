import { LOGO, LOGO_LAYOUTS, LOGO_ROLE, type LogoLayer } from "./logo-paths";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

type Variant = "primary" | "reverse";
type Layout = "horizontal" | "stacked";

const palette: Record<Variant, Record<"red" | "navy" | "light", string>> = {
  primary: { red: "#E1252F", navy: "#142839", light: "#FFFFFF" },
  reverse: { red: "#E1252F", navy: "#FFFFFF", light: "#142839" },
};

function Layers({ layers, variant }: { layers: readonly (readonly [LogoLayer, string])[]; variant: Variant }) {
  const c = palette[variant];
  return (
    <>
      {layers.map(([layer, t]) => (
        <path key={layer} fill={c[LOGO_ROLE[layer]]} transform={t || undefined} d={LOGO[layer]} />
      ))}
    </>
  );
}

/**
 * The Mary's Logistics Group logo, traced to vector from the owner supplied artwork so it stays
 * sharp at every size. "horizontal" is the compact header version; "stacked" is the full logo.
 */
export function Logo({ variant = "primary", layout = "horizontal", className, title = brand.name }: { variant?: Variant; layout?: Layout; className?: string; title?: string | null }) {
  const l = LOGO_LAYOUTS[layout];
  return (
    <svg viewBox={l.viewBox} className={cn("h-auto", className)} role={title ? "img" : undefined} aria-label={title ?? undefined} aria-hidden={title ? undefined : true} focusable="false">
      <Layers layers={l.layers} variant={variant} />
    </svg>
  );
}

/** Symbol only (the ML monogram with the road), for compact placements and decorative accents. */
export function LogoMark({ className, tone = "brand" }: { className?: string; tone?: "brand" | "light" }) {
  return (
    <svg viewBox={LOGO_LAYOUTS.mark.viewBox} className={className} aria-hidden="true" focusable="false">
      <Layers layers={LOGO_LAYOUTS.mark.layers} variant={tone === "light" ? "reverse" : "primary"} />
    </svg>
  );
}

const FILES: Record<Layout, Record<Variant, { src: string; w: number; h: number }>> = {
  horizontal: { primary: { src: "/brand/mlg-logo-horizontal.svg", w: 2483, h: 400 }, reverse: { src: "/brand/mlg-logo-horizontal-reverse.svg", w: 2483, h: 400 } },
  stacked: { primary: { src: "/brand/mlg-logo-stacked.svg", w: 1424, h: 820 }, reverse: { src: "/brand/mlg-logo-stacked-reverse.svg", w: 1424, h: 820 } },
};

/**
 * The same logo as <Logo>, served from the static SVG files generated from the same paths. Used
 * on public pages so the artwork is cached by the browser instead of repeated in every page's
 * HTML and JavaScript. Pass alt="" when a surrounding link already names it.
 */
export function LogoImage({ variant = "primary", layout = "horizontal", className, alt = "", eager = false }: { variant?: Variant; layout?: Layout; className?: string; alt?: string; eager?: boolean }) {
  const f = FILES[layout][variant];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={f.src} width={f.w} height={f.h} alt={alt} className={cn("h-auto", className)} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

/** Decorative monogram from the static file (same artwork as <LogoMark>). */
export function LogoMarkImage({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mlg-mark.svg" width={1113} height={477} alt="" aria-hidden="true" className={className} loading="lazy" decoding="async" />;
}
