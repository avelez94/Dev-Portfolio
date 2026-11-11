"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, Building2, ExternalLink, Inbox, LayoutDashboard, ListChecks, LogOut, Menu, Settings, Truck, X } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/inquiries", label: "Website Inquiries", icon: Inbox },
  { href: "/admin/shippers", label: "Shipper CRM", icon: Building2 },
  { href: "/admin/carriers", label: "Carrier Leads", icon: Truck },
  { href: "/admin/tasks", label: "Follow Up Tasks", icon: ListChecks },
  { href: "/admin/activity", label: "Activity Log", icon: Activity, admin: true },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav({ name, role, operational }: { name: string; role: string; operational: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const visible = items.filter((i) => !i.admin || role !== "staff");
  return (
    <aside className="bg-navy text-white lg:sticky lg:top-0 lg:h-dvh">
      <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
        <Link href="/admin" aria-label="Dashboard home"><Logo variant="reverse" className="w-32" title={null} /></Link>
        <button type="button" className="rounded p-2 lg:hidden" aria-expanded={open} aria-controls="admin-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <div id="admin-menu" className={cn("flex-col px-3 pb-6 lg:flex", open ? "flex" : "hidden")}>
        <p className={cn("mx-2 mb-4 rounded-md px-3 py-2 text-xs font-semibold", operational ? "bg-white/10" : "bg-brand-red/20 text-white")}>
          {operational ? "Operations enabled" : "Prelaunch mode: quote intake off"}
        </p>
        <nav aria-label="Dashboard">
          <ul className="space-y-1">
            {visible.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} aria-current={active(href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", active(href) ? "bg-white text-navy" : "text-white/85 hover:bg-white/10 hover:text-white")}>
                  <Icon aria-hidden="true" className={cn("size-4", active(href) ? "text-brand-red" : "")} /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-8 border-t border-white/15 px-3 pt-5 text-sm lg:mt-auto">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs capitalize text-white/70">{role}</p>
          <a href="/" target="_blank" className="mt-4 flex items-center gap-2 text-white/80 hover:text-white"><ExternalLink aria-hidden="true" className="size-4" /> View website</a>
          <form action={signOut} className="mt-2">
            <button className="flex items-center gap-2 text-white/80 hover:text-white"><LogOut aria-hidden="true" className="size-4" /> Sign out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
