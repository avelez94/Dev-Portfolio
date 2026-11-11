import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { OutreachTabs } from "../../outreach-tabs";
import { TemplateEditor } from "../template-editor";

export const metadata = { title: "New template" };

export default async function NewTemplatePage() {
  const s = await requireAdmin();
  return (
    <>
      <PageHeader title="New template" crumbs={[{ label: "Outreach", href: "/admin/outreach" }, { label: "Email Templates", href: "/admin/outreach/templates" }, { label: "New" }]} />
      <OutreachTabs current="/admin/outreach/templates" />
      <TemplateEditor s={s} t={null} />
    </>
  );
}
