import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, Minus } from "lucide-react";
import type { MetricDef } from "@/lib/metrics/definitions";
import { fmtCount, fmtMoney } from "@/lib/money";
import { formatValue } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";

export { formatValue };

/** KPI card: value, honest comparison, definition on demand, and a link to the records. */
export function KpiCard({ def, value, previous, snapshot = false, extraQuery = "" }: { def: MetricDef; value: number | null | undefined; previous?: number | null; snapshot?: boolean; extraQuery?: string }) {
  const unavailable = value === null || value === undefined;
  let delta: React.ReactNode = null;
  if (snapshot) delta = <span className="text-slate-muted">Current snapshot</span>;
  else if (!unavailable && previous !== null && previous !== undefined) {
    const diff = (value as number) - previous;
    const good = def.higherIsBetter === undefined ? null : (diff > 0) === def.higherIsBetter;
    const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
    const amount = def.unit === "percent" ? `${Math.abs(diff).toFixed(1)} pts` : def.unit === "money" ? fmtMoney(Math.abs(diff) / 100, { whole: true }) : fmtCount(Math.abs(diff));
    const rel = previous !== 0 && def.unit !== "percent" ? ` (${diff > 0 ? "+" : diff < 0 ? "-" : ""}${Math.abs((100 * diff) / previous).toFixed(0)}%)` : "";
    delta = (
      <span className={cn("inline-flex items-center gap-1", diff === 0 ? "text-slate-muted" : good === null ? "text-navy" : good ? "text-success" : "text-danger")}>
        <Icon aria-hidden="true" className="size-3.5" />
        {diff === 0 ? "No change" : `${diff > 0 ? "Up" : "Down"} ${amount}${rel}`}
        <span className="sr-only"> compared with the previous period</span>
      </span>
    );
  } else if (!unavailable) delta = <span className="text-slate-muted">No comparison available</span>;
  const href = extraQuery ? `${def.drill}${def.drill.includes("?") ? "&" : "?"}${extraQuery}` : def.drill;
  return (
    <div role="group" aria-label={def.label} className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-sans text-[0.8rem] font-semibold leading-snug text-slate-muted">{def.label}</h3>
        <details className="group relative">
          <summary className="cursor-pointer list-none rounded p-0.5 text-slate-muted hover:text-navy" aria-label={`How ${def.label} is calculated`}><Info aria-hidden="true" className="size-4" /></summary>
          <p className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-line bg-white p-3 text-xs leading-relaxed text-charcoal shadow-[var(--shadow-float)]">{def.definition}</p>
        </details>
      </div>
      <p className={cn("mt-2 font-serif text-[1.9rem] font-bold leading-none", unavailable ? "text-base font-sans font-semibold text-slate-muted" : "text-navy")}>{formatValue(def.unit, value)}</p>
      <p className="mt-2 text-xs">{delta}</p>
      <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-red-dark hover:underline">
        View records <ArrowRight aria-hidden="true" className="size-3.5" /><span className="sr-only"> for {def.label}</span>
      </Link>
    </div>
  );
}
