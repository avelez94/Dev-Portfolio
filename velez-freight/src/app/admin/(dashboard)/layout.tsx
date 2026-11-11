import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSettings } from "@/lib/data/settings";
import { AdminNav } from "@/components/admin/admin-nav";
import { GlobalSearch } from "@/components/admin/global-search";
import { NotConfigured } from "@/components/admin/admin-ui";
import { loadNavCounts } from "@/lib/nav-counts";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <main className="px-4 py-24"><NotConfigured /></main>;
  // Pages and actions re-check authorization themselves; this only shapes the shell.
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  const [settings, counts] = await Promise.all([getSettings(), loadNavCounts(s)]);
  return (
    <div className="min-h-dvh bg-ivory lg:flex">
      <AdminNav name={s.name ?? s.email} role={s.role} operational={settings.operational} counts={counts} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-10">{children}</main>
      <GlobalSearch />
    </div>
  );
}
