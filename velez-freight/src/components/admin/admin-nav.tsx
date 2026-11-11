"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  Bell, BarChart3, Building2, ChevronsLeft, ChevronsRight, ClipboardList, FileSpreadsheet, FileText, Globe, Inbox, LayoutDashboard,
  ListChecks, LogOut, Menu, Receipt, ScrollText, Search, Settings, Truck, Wallet, X, Package,
} from "lucide-react";
import { signOut } from "@/app/admin/actions";
import { Logo, LogoMark } from "@/components/site/logo";
import { cn } from "@/lib/utils";
import { openSearch } from "./global-search";

export type NavCounts = { tasks: number; notifications: number; inquiries: number };
type Item = { href: string; label: string; icon: typeof Bell; count?: keyof NavCounts; adminOnly?: boolean; activeOnly?: boolean; match?: string[] };

const groups: { label: string; items: Item[] }[] = [
  { label: "Overview", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/tasks", label: "My Tasks", icon: ListChecks, count: "tasks" },
    { href: "/admin/notifications", label: "Notifications", icon: Bell, count: "notifications" },
  ] },
  { label: "Relationships", items: [
    { href: "/admin/shippers", label: "Shippers", icon: Building2 },
    { href: "/admin/carriers", label: "Carriers", icon: Truck },
  ] },
  { label: "Operations", items: [
    { href: "/admin/inquiries", label: "Freight Inquiries", icon: Inbox, count: "inquiries" },
    { href: "/admin/quotes", label: "Quotes", icon: ClipboardList, activeOnly: true },
    { href: "/admin/shipments", label: "Shipments", icon: Package, activeOnly: true },
  ] },
  { label: "Financials", items: [
    { href: "/admin/invoices", label: "Invoices", icon: Receipt, adminOnly: true, match: ["/admin/expenses"] },
    { href: "/admin/payables", label: "Carrier Payables", icon: Wallet, adminOnly: true },
  ] },
  { label: "Analytics", items: [
    { href: "/admin/insights", label: "Insights", icon: BarChart3 },
    { href: "/admin/reports", label: "Reports", icon: FileSpreadsheet },
  ] },
  { label: "System", items: [
    { href: "/admin/content", label: "Website Content", icon: Globe },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
  ] },
];

// Sidebar collapse preference is a per browser convenience kept in localStorage.
const COLLAPSE_KEY = "mlg-nav-collapsed";
function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}
function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSE_KEY, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(COLLAPSE_KEY, cb); window.removeEventListener("storage", cb); };
}

export function AdminNav({ name, role, operational, counts }: { name: string; role: string; operational: boolean; counts: NavCounts }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const toggleCollapsed = () => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1"); } catch {}
    window.dispatchEvent(new Event(COLLAPSE_KEY));
  };
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setMobileOpen(false); }

  const isActive = (it: Item) =>
    it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href) || (it.match ?? []).some((m) => pathname.startsWith(m));
  const isAdmin = role !== "staff";

  const navList = (compact: boolean) => (
    <nav aria-label="Dashboard" className="space-y-5">
      {groups.map((g) => {
        const items = g.items.filter((i) => !i.adminOnly || isAdmin);
        if (!items.length) return null;
        return (
          <div key={g.label}>
            {!compact && <p className="mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/55">{g.label}</p>}
            <ul className="space-y-0.5">
              {items.map((it) => {
                const Icon = it.icon;
                const active = isActive(it);
                const n = it.count ? counts[it.count] : 0;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      title={compact ? it.label : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-white text-navy" : "text-white/85 hover:bg-white/10 hover:text-white",
                        compact && "justify-center px-2",
                      )}
                    >
                      <Icon aria-hidden="true" className={cn("size-[1.05rem] shrink-0", active && "text-brand-red")} />
                      {compact ? <span className="sr-only">{it.label}</span> : <span className="flex-1 truncate">{it.label}</span>}
                      {!compact && it.activeOnly && !operational && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-white/70">Later</span>}
                      {n > 0 && (
                        <span className={cn("rounded-full px-1.5 text-[0.7rem] font-bold leading-5", active ? "bg-navy text-white" : "bg-brand-red text-white", compact && "absolute ml-6 -mt-5")}>
                          {n > 99 ? "99+" : n}<span className="sr-only"> {it.count === "notifications" ? "unread" : "need attention"}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const footer = (compact: boolean) => (
    <div className={cn("border-t border-white/15 pt-4 text-sm", compact ? "px-1 text-center" : "px-3")}>
      {!compact && (<><p className="truncate font-semibold">{name}</p><p className="text-xs capitalize text-white/70">{role}</p></>)}
      <a href="/" target="_blank" className={cn("mt-3 flex items-center gap-2 text-white/80 hover:text-white", compact && "justify-center")} title="View website">
        <FileText aria-hidden="true" className="size-4" />{!compact && "View website"}
      </a>
      <form action={signOut} className="mt-2">
        <button className={cn("flex w-full items-center gap-2 text-white/80 hover:text-white", compact && "justify-center")} title="Sign out">
          <LogOut aria-hidden="true" className="size-4" />{!compact && "Sign out"}
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile and tablet top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-navy px-4 py-3 text-white lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="admin-drawer" className="rounded p-2 hover:bg-white/10"><Menu /></button>
        <Link href="/admin" aria-label="Dashboard home"><Logo variant="reverse" className="w-40" title={null} /></Link>
        <button type="button" onClick={openSearch} aria-label="Search records" className="rounded p-2 hover:bg-white/10"><Search /></button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation" onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}>
          {/* Backdrop: mouse and touch only; keyboard users use the Close button or Escape. */}
          <div aria-hidden="true" className="absolute inset-0 bg-navy/60" onClick={() => setMobileOpen(false)} />
          <div id="admin-drawer" className="relative flex h-full w-[min(20rem,85vw)] flex-col overflow-y-auto bg-navy px-3 py-4 text-white">
            <div className="mb-4 flex items-center justify-between px-2">
              <Logo variant="reverse" className="w-40" title={null} />
              <button type="button" autoFocus onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded p-2 hover:bg-white/10"><X /></button>
            </div>
            <ModeBadge operational={operational} />
            <div className="flex-1">{navList(false)}</div>
            <div className="mt-6">{footer(false)}</div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto bg-navy py-5 text-white transition-[width] duration-200 lg:flex", collapsed ? "w-[4.5rem] px-2" : "w-64 px-3")}>
        <div className={cn("mb-4 flex items-center", collapsed ? "justify-center" : "justify-between px-2")}>
          <Link href="/admin" aria-label="Dashboard home">{collapsed ? <LogoMark tone="light" className="w-10" /> : <Logo variant="reverse" className="w-44" title={null} />}</Link>
        </div>
        {!collapsed && <ModeBadge operational={operational} />}
        <button type="button" onClick={openSearch} className={cn("mb-5 flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10", collapsed && "justify-center px-2")}>
          <Search aria-hidden="true" className="size-4" />
          {collapsed ? <span className="sr-only">Search</span> : <><span className="flex-1">Search</span><kbd className="rounded bg-white/10 px-1.5 text-[0.7rem]">Ctrl K</kbd></>}
        </button>
        <div className="flex-1">{navList(collapsed)}</div>
        <div className="mt-6 space-y-3">
          {footer(collapsed)}
          <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-white/70 hover:bg-white/10", collapsed && "justify-center px-2")}>
            {collapsed ? <ChevronsRight aria-hidden="true" className="size-4" /> : <><ChevronsLeft aria-hidden="true" className="size-4" /> Collapse</>}
          </button>
        </div>
      </aside>
    </>
  );
}

function ModeBadge({ operational }: { operational: boolean }) {
  return (
    <Link href="/admin/settings#operating-status" className={cn("mx-1 mb-4 block rounded-md px-3 py-2 text-xs font-semibold", operational ? "bg-success/25 text-white" : "bg-white/10 text-white")}>
      {operational ? "Active brokerage mode" : "Prelaunch mode"}
      <span className="block font-normal text-white/70">{operational ? "Operations enabled" : "Brokerage features are off"}</span>
    </Link>
  );
}
