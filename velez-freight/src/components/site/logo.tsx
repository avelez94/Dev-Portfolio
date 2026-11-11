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
