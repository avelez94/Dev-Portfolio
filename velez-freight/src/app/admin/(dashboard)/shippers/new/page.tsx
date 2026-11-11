import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { PageTitle, Panel } from "@/components/admin/admin-ui";
import { ProspectForm } from "@/components/admin/record-forms";

export const metadata = { title: "New prospect" };

export default async function NewProspectPage() {
  await requireStaff();
  return (
    <>
      <Link href="/admin/shippers" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark"><ArrowLeft aria-hidden="true" className="size-4" /> Shipper CRM</Link>
      <PageTitle title="New shipper prospect" />
      <Panel className="max-w-3xl"><ProspectForm /></Panel>
    </>
  );
}
