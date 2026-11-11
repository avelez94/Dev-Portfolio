import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const adminInput = "w-full rounded-md border border-input bg-white px-3 h-10 text-sm text-charcoal focus-visible:outline-none focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/20";
export const adminTextarea = "w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-charcoal min-h-24 focus-visible:outline-none focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/20";

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)]", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-navy">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy">{label}</label>
      {children}
    </div>
  );
}

const tone: Record<string, "neutral" | "red" | "navy" | "green" | "amber" | "danger" | "info"> = {
  new: "info", pending_review: "info", unverified: "amber", open: "info", in_review: "amber", follow_up: "amber", overdue: "danger",
  draft: "neutral", pending_approval: "amber", approved: "info", sent: "info", accepted: "green", issued: "info", received: "info", paid: "green", void: "neutral",
  booked: "info", dispatched: "info", in_transit: "info", delivered: "green", completed: "green", lost: "neutral", researching: "neutral",
  contact_identified: "neutral", contacted: "info", pass: "green", fail: "danger", needs_review: "amber",
  resolved: "green", verified: "green", done: "green", active_customer: "green", responded: "navy", qualified: "navy",
  potential_customer: "navy", spam: "neutral", closed: "neutral", declined: "neutral", rejected: "neutral", expired: "neutral", cancelled: "neutral",
};
export function StatusBadge({ value, label }: { value: string; label: string }) {
  return <Badge tone={tone[value] ?? "neutral"}>{label}</Badge>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line bg-ivory p-6 text-center text-sm text-slate-muted">{children}</p>;
}

export function FilterLinks({ base, param, current, options }: { base: string; param: string; current?: string; options: { value: string; label: string }[] }) {
  const all = [{ value: "", label: "All" }, ...options];
  return (
    <nav aria-label={`Filter by ${param}`} className="flex flex-wrap gap-2">
      {all.map((o) => {
        const active = (current ?? "") === o.value;
        const url = new URLSearchParams();
        if (o.value) url.set(param, o.value);
        return (
          <Link key={o.value || "all"} href={`${base}${o.value ? `?${url}` : ""}`} aria-current={active ? "true" : undefined} className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition-colors", active ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40")}>
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NotConfigured() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
      <h1 className="text-2xl font-bold">Dashboard not connected</h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal">Supabase environment variables are not set, so the dashboard cannot load data or sign anyone in. Follow docs/SETUP.md to connect the database.</p>
    </div>
  );
}

/** Previous and next page links that keep the current filters. */
export function Pager({ base, params, page, pageSize, total }: { base: string; params: Record<string, string | undefined>; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <p className="text-slate-muted">Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className="rounded-md border border-line bg-white px-3 py-1.5 font-semibold text-navy hover:bg-ivory">Previous</Link> : <span className="rounded-md border border-line px-3 py-1.5 text-slate-muted">Previous</span>}
        {page < pages ? <Link href={href(page + 1)} className="rounded-md border border-line bg-white px-3 py-1.5 font-semibold text-navy hover:bg-ivory">Next</Link> : <span className="rounded-md border border-line px-3 py-1.5 text-slate-muted">Next</span>}
      </div>
    </nav>
  );
}

/** Small GET filter form: selects submit on change through the Apply button; Clear resets. */
export function FilterBar({ base, children, active }: { base: string; children: React.ReactNode; active: boolean }) {
  return (
    <form method="get" action={base} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
      {children}
      <button className="h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white">Apply</button>
      {active && <Link href={`${base}?clear=1`} className="h-10 rounded-md px-3 py-2.5 text-sm font-semibold text-navy hover:bg-ivory-200">Clear filters</Link>}
    </form>
  );
}

export const filterSelect = "h-10 rounded-md border border-input bg-white px-3 text-sm";
