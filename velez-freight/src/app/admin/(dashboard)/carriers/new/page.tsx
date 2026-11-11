import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { PageTitle, Panel } from "@/components/admin/admin-ui";
import { CarrierLeadForm } from "@/components/admin/record-forms";

export const metadata = { title: "New carrier lead" };

export default async function NewCarrierPage() {
  await requireStaff();
  return (
    <>
      <Link href="/admin/carriers" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark"><ArrowLeft aria-hidden="true" className="size-4" /> Carrier Leads</Link>
      <PageTitle title="New carrier lead" />
      <Panel className="max-w-3xl"><CarrierLeadForm /></Panel>
    </>
  );
}
