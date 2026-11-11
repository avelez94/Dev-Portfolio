import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSettings } from "@/lib/data/settings";
import { AdminNav } from "@/components/admin/admin-nav";
import { NotConfigured } from "@/components/admin/admin-ui";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <main className="px-4 py-24"><NotConfigured /></main>;
  // Pages and actions re-check authorization themselves; this only shapes the shell.
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  const settings = await getSettings();
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]">
      <AdminNav name={s.name ?? s.email} role={s.role} operational={settings.operational} />
      <main id="main" className="px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
