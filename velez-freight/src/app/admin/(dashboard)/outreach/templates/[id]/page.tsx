import { notFound } from "next/navigation";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { duplicateTemplate, setTemplateArchived } from "@/app/admin/outreach-actions";
import { fmtDateTime } from "@/config/admin";
import { Panel } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { OutreachTabs } from "../../outreach-tabs";
import { TemplateEditor } from "../template-editor";

export const metadata = { title: "Email template" };

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: t } = await s.db.from("email_templates").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: versions } = await s.db.from("email_template_versions").select("id, version, subject, body, created_at").eq("template_id", id).order("version", { ascending: false });
  const admin = isAdminRole(s.role);
  return (
    <>
      <PageHeader title={t.name} crumbs={[{ label: "Outreach", href: "/admin/outreach" }, { label: "Email Templates", href: "/admin/outreach/templates" }, { label: t.name }]}
        description={`${t.status === "archived" ? "Archived. " : ""}Version ${t.version}.`}
        actions={admin ? (
          <div className="flex gap-2">
            <form action={duplicateTemplate}><input type="hidden" name="id" value={t.id} /><button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory">Duplicate</button></form>
            <form action={setTemplateArchived}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="archived" value={t.status === "archived" ? "false" : "true"} /><button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory">{t.status === "archived" ? "Restore" : "Archive"}</button></form>
          </div>
        ) : undefined} />
      <OutreachTabs current="/admin/outreach/templates" />
      {saved && <p role="status" className="mb-4 rounded-md bg-success/10 p-3 text-sm text-navy">Template created.</p>}
      <TemplateEditor s={s} t={t} />
      <Panel title="Version history" className="mt-6">
        <ol className="divide-y divide-line">
          {(versions ?? []).map((v) => (
            <li key={v.id} className="py-3 text-sm">
              <details>
                <summary className="cursor-pointer"><span className="font-semibold text-navy">Version {v.version}</span> <span className="text-xs text-slate-muted">{fmtDateTime(v.created_at)}{v.version === t.version ? ", current" : ""}</span></summary>
                <p className="mt-2"><span className="text-slate-muted">Subject:</span> {v.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-ivory p-3 font-sans text-sm">{v.body}</pre>
              </details>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
