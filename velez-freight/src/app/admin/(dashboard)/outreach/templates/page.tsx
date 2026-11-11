import Link from "next/link";
import { Plus } from "lucide-react";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { TEMPLATE_CATEGORIES } from "@/config/outreach";
import { fmtDateTime } from "@/config/admin";
import { Panel } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { OutreachTabs } from "../outreach-tabs";

export const metadata = { title: "Email Templates" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const s = await requireStaff();
  const { show } = await searchParams;
  const settings = await getSettings();
  const { data: templates } = await s.db.from("email_templates").select("id, name, category, description, status, requires_operational, version, updated_at").order("name");
  const list = (templates ?? []).filter((t) => (show === "archived" ? t.status === "archived" : t.status === "active"));
  return (
    <>
      <PageHeader title="Email Templates" crumbs={[{ label: "Outreach", href: "/admin/outreach" }, { label: "Email Templates" }]} description="Reusable emails with your own wording. Every edit is kept as a version."
        actions={isAdminRole(s.role) ? <Link href="/admin/outreach/templates/new" className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"><Plus aria-hidden="true" className="size-4" /> New template</Link> : undefined} />
      <OutreachTabs current="/admin/outreach/templates" />
      <p className="mb-4 text-sm">
        <Link href="/admin/outreach/templates" aria-current={show !== "archived" ? "page" : undefined} className={show !== "archived" ? "font-semibold text-navy" : "text-brand-red-dark underline"}>Active</Link>{" "}
        <span aria-hidden="true">·</span>{" "}
        <Link href="/admin/outreach/templates?show=archived" aria-current={show === "archived" ? "page" : undefined} className={show === "archived" ? "font-semibold text-navy" : "text-brand-red-dark underline"}>Archived</Link>
      </p>
      <div className="space-y-6">
        {TEMPLATE_CATEGORIES.map((c) => {
          const items = list.filter((t) => t.category === c.value);
          if (!items.length) return null;
          return (
            <Panel key={c.value} title={c.label}>
              <ul className="divide-y divide-line">
                {items.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/outreach/templates/${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:bg-ivory">
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-navy">{t.name}</span>{t.description && <span className="block text-xs text-slate-muted">{t.description}</span>}</span>
                      {t.requires_operational && <StatusPill tone={settings.operational ? "ok" : "muted"}>{settings.operational ? "Operating only" : "Locked until operating"}</StatusPill>}
                      <span className="text-xs text-slate-muted">Version {t.version}, updated {fmtDateTime(t.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
        {!list.length && <p className="text-sm text-slate-muted">No {show === "archived" ? "archived" : "active"} templates.</p>}
      </div>
    </>
  );
}
