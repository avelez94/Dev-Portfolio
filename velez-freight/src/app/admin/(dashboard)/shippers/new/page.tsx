import { requireStaff } from "@/lib/auth";
import { Panel } from "@/components/admin/admin-ui";
import { PageHeader } from "@/components/admin/page-header";
import { ProspectForm } from "@/components/admin/record-forms";

export const metadata = { title: "Add shipper" };

export default async function NewShipperPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Add a shipper" crumbs={[{ label: "Shippers", href: "/admin/shippers" }, { label: "Add" }]} description="Start with the company name. Everything else can be added later from the shipper's profile." />
      <Panel className="max-w-3xl"><ProspectForm /></Panel>
    </>
  );
}
