import { requireStaff } from "@/lib/auth";
import { Panel } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { IntegrationsList } from "@/components/admin/integrations-status";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Integrations" crumbs={[{ label: "Integrations" }]} description="Outside services this dashboard uses, and what each one is for. Read only: keys live in the hosting environment, and adding a paid service always needs your approval." />
      <Panel><IntegrationsList /></Panel>
    </>
  );
}
