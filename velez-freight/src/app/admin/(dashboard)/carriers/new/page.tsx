import { requireStaff } from "@/lib/auth";
import { Panel } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { CarrierLeadForm } from "@/components/admin/record-forms";

export const metadata = { title: "Add carrier" };

export default async function NewCarrierPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Add a carrier" crumbs={[{ label: "Carriers", href: "/admin/carriers" }, { label: "Add" }]} description="Record the carrier first; verification checks are recorded on its profile." />
      <Panel className="max-w-3xl"><CarrierLeadForm /></Panel>
    </>
  );
}
