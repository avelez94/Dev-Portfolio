import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd, breadcrumbData } from "@/lib/seo";

/** Visible breadcrumb trail with matching BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
      <ol className="container-site flex flex-wrap items-center gap-1.5 py-3 text-sm">
        {items.map((it, i) => (
          <li key={it.path} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-slate-muted" />}
            {i < items.length - 1 ? (
              <Link href={it.path} className="text-charcoal underline-offset-4 hover:text-navy hover:underline">{it.name}</Link>
            ) : (
              <span aria-current="page" className="font-semibold text-navy">{it.name}</span>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={breadcrumbData(items)} />
    </nav>
  );
}
