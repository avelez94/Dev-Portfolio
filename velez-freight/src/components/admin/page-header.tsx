import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/** Consistent page header: breadcrumbs, title, one line "what is this page", and the primary action. */
export function PageHeader({ title, description, crumbs = [], actions, children }: { title: string; description?: string; crumbs?: Crumb[]; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-muted">
            <li><Link href="/admin" className="hover:text-navy hover:underline">Dashboard</Link></li>
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                <ChevronRight aria-hidden="true" className="size-3.5" />
                {c.href && i < crumbs.length - 1 ? <Link href={c.href} className="hover:text-navy hover:underline">{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className="font-medium text-navy">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.9rem] font-bold leading-tight">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Explains why a module is unavailable and what must happen first. Never a dead end. */
export function GatedModule({ title, reason, children }: { title: string; reason: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-8 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase tracking-wider text-warning">Available after brokerage activation</p>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-charcoal">{reason}</p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/settings#operating-status" className="rounded-md bg-navy px-4 py-2 font-semibold text-white">Review activation checklist</Link>
        <Link href="/admin/shippers" className="rounded-md border border-line px-4 py-2 font-semibold text-navy">Work on shipper prospecting</Link>
      </div>
      {children}
    </section>
  );
}
