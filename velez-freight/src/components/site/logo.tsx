import { LOGO } from "./logo-paths";
import { cn } from "@/lib/utils";

type Variant = "primary" | "reverse";

const palette: Record<Variant, { road: string; dashes: string; text: string; red: string }> = {
  primary: { road: "#142839", dashes: "#FFFFFF", text: "#142839", red: "#E1252F" },
  reverse: { road: "#FFFFFF", dashes: "#142839", text: "#FFFFFF", red: "#E1252F" },
};

/**
 * Interim vector recreation of the supplied logo (road symbol, VELEZ, FREIGHT GROUP).
 * Lettering is outlined, so the logo does not depend on web fonts.
 */
export function Logo({ variant = "primary", className, title = "Velez Freight Group" }: { variant?: Variant; className?: string; title?: string | null }) {
  const c = palette[variant];
  return (
    <svg viewBox={LOGO.viewBox} className={cn("h-auto", className)} role={title ? "img" : undefined} aria-label={title ?? undefined} aria-hidden={title ? undefined : true} focusable="false">
      <path fill={c.red} d={LOGO.wings + LOGO.lines} />
      <path fill={c.road} d={LOGO.roadOuter + LOGO.roadMain} />
      <path fill={c.dashes} d={LOGO.dashes} />
      <path fill={c.text} d={LOGO.velez + LOGO.freightGroup} />
    </svg>
  );
}

/** Road symbol only, for compact placements and decorative accents. */
export function LogoMark({ className, tone = "brand" }: { className?: string; tone?: "brand" | "light" }) {
  return (
    <svg viewBox="480 30 1040 260" className={className} aria-hidden="true" focusable="false">
      <path fill="#E1252F" d={LOGO.wings} />
      <path fill={tone === "light" ? "#FFFFFF" : "#142839"} d={LOGO.roadOuter + LOGO.roadMain} />
      <path fill={tone === "light" ? "#142839" : "#FFFFFF"} d={LOGO.dashes} />
    </svg>
  );
}
