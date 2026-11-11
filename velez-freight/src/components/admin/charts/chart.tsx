"use client";

import dynamic from "next/dynamic";
import type { ChartProps } from "./types";
import { formatChartValue } from "./types";

// Charts load on demand so the dashboard shell stays fast.
const ChartImpl = dynamic(() => import("./chart-impl"), { ssr: false, loading: () => <div className="h-[260px] animate-pulse rounded-lg bg-ivory" /> });

/**
 * Accessible chart: the visual is decorative for assistive technology, and the same numbers are
 * available in a data table directly below it.
 */
export function Chart({ title, description, empty, ...props }: ChartProps & { title: string; description?: string; empty?: string | null }) {
  const hasData = props.data.length > 0 && props.data.some((d) => props.series.some((s) => Number(d[s.key]) !== 0 && d[s.key] !== null));
  return (
    <figure className="rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
      <figcaption>
        <h3 className="font-sans text-sm font-bold text-navy">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-muted">{description}</p>}
      </figcaption>
      <div className="mt-4">
        {hasData ? <ChartImpl {...props} /> : <p className="flex h-40 items-center justify-center rounded-lg bg-ivory px-4 text-center text-sm text-slate-muted">{empty ?? "No recorded data for this period yet."}</p>}
      </div>
      {hasData && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-navy">View data table</summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{title}</caption>
              <thead><tr><th scope="col" className="py-1 pr-3">{props.xKey === "bucket" ? "Period" : "Item"}</th>{props.series.map((s) => <th key={s.key} scope="col" className="py-1 pr-3 text-right">{s.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {props.data.map((d, i) => <tr key={i}><th scope="row" className="py-1 pr-3 font-normal">{String(d[props.xKey])}</th>{props.series.map((s) => <td key={s.key} className="py-1 pr-3 text-right tabular-nums">{d[s.key] === null ? "Not available" : formatChartValue(Number(d[s.key]), props.format ?? "count")}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
