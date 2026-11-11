import { fmtMoney, toCents } from "@/lib/money";

/** Margin shown from cents to avoid rounding drift. */
export function MarginLine({ rate, cost }: { rate: unknown; cost: unknown }) {
  const r = toCents(rate as string);
  const c = toCents(cost as string);
  if (r === null || c === null) return <span className="text-slate-muted">Margin not available until carrier cost is recorded</span>;
  const m = r - c;
  return <span className={m < 0 ? "font-semibold text-danger" : "font-semibold text-navy"}>{fmtMoney(m / 100)} gross margin{r > 0 ? ` (${((100 * m) / r).toFixed(1)}%)` : ""}</span>;
}

export function Confirm({ name = "confirm", children }: { name?: string; children: React.ReactNode }) {
  return <label className="flex items-start gap-2 text-sm"><input type="checkbox" name={name} className="mt-0.5 size-4 accent-brand-red" /> <span>{children}</span></label>;
}

export const lane = (x: { origin_city: string; origin_state: string; dest_city: string; dest_state: string }) => `${x.origin_city}, ${x.origin_state} to ${x.dest_city}, ${x.dest_state}`;
