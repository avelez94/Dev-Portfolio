import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/outreach", label: "Overview" },
  { href: "/admin/outreach/compose", label: "Compose" },
  { href: "/admin/outreach/templates", label: "Email Templates" },
  { href: "/admin/outreach/setup", label: "Sending Setup" },
];

export function OutreachTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Outreach sections" className="-mx-1 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-line px-1">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={t.href === current ? "page" : undefined} className={cn("-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold", t.href === current ? "border-brand-red text-navy" : "border-transparent text-slate-muted hover:text-navy")}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
