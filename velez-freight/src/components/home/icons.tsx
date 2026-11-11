import { Boxes, MessagesSquare, ShieldCheck, Truck, UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Red line icons matching the mockup's service illustrations. */
export function ServiceIcon({ name, className }: { name: "expedited" | "dedicated" | "general"; className?: string }) {
  if (name === "expedited") {
    return (
      <span className={cn("relative inline-flex", className)} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="absolute -left-3 top-1/2 h-[60%] w-3 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 7h8M0 12h9M3 17h7" />
        </svg>
        <Truck strokeWidth={1.75} className="size-full" />
      </span>
    );
  }
  const Icon = name === "dedicated" ? Truck : Boxes;
  return <Icon aria-hidden="true" strokeWidth={1.75} className={className} />;
}

export function PillarIcon({ name, className }: { name: "message" | "user" | "shield"; className?: string }) {
  const Icon = name === "message" ? MessagesSquare : name === "user" ? UserRoundCheck : ShieldCheck;
  return <Icon aria-hidden="true" strokeWidth={1.6} className={className} />;
}

/** Dashed route line with location pins, used as quiet decoration behind section headings. */
export function RouteLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={className} aria-hidden="true" fill="none">
      <path d="M0 90 C 140 90, 160 40, 300 46 S 520 96, 640 70 S 900 20, 1040 44 S 1160 70, 1200 30" stroke="#142839" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="5 7" />
      <g fill="#E1252F">
        <path d="M120 30c-8 0-14 6-14 14 0 10 14 24 14 24s14-14 14-24c0-8-6-14-14-14Zm0 19a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
        <path d="M1090 6c-8 0-14 6-14 14 0 10 14 24 14 24s14-14 14-24c0-8-6-14-14-14Zm0 19a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
      </g>
    </svg>
  );
}
