"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarRange, X } from "lucide-react";
import { presets } from "@/lib/metrics/period";

/** Date range control. State lives in the URL so views can be bookmarked and shared internally. */
export function PeriodFilter({ from, to, preset, compareLabel }: { from: string; to: string; preset: string; compareLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [custom, setCustom] = useState({ from, to });
  const push = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => (v === null ? q.delete(k) : q.set(k, v)));
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold uppercase tracking-wide text-navy">
        <span className="mb-1 flex items-center gap-1"><CalendarRange aria-hidden="true" className="size-3.5" /> Period</span>
        <select value={preset} onChange={(e) => push({ period: e.target.value, ...(e.target.value === "custom" ? { from: custom.from, to: custom.to } : { from: null, to: null }) })}
          className="h-10 rounded-md border border-input bg-white px-3 text-sm font-medium normal-case tracking-normal text-charcoal">
          {presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      {preset === "custom" && (
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); push({ period: "custom", from: custom.from, to: custom.to }); }}>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">From<input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="mt-1 block h-10 rounded-md border border-input bg-white px-2 text-sm" /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-navy">To<input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="mt-1 block h-10 rounded-md border border-input bg-white px-2 text-sm" /></label>
          <button className="h-10 rounded-md bg-navy px-3 text-sm font-semibold text-white">Apply</button>
        </form>
      )}
      <p className="pb-2 text-xs text-slate-muted">Compared {compareLabel}</p>
      {preset !== "30d" && (
        <button type="button" onClick={() => push({ period: null, from: null, to: null })} className="mb-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-navy hover:bg-ivory-200">
          <X aria-hidden="true" className="size-3.5" /> Reset to last 30 days
        </button>
      )}
    </div>
  );
}
