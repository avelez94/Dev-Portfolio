import { requireStaff } from "@/lib/auth";
import { PageTitle } from "@/components/admin/admin-ui";
import { TasksPanel } from "@/components/admin/panels";

export const metadata = { title: "Follow Up Tasks" };

export default async function TasksPage() {
  const s = await requireStaff();
  return (
    <>
      <PageTitle title="Follow Up Tasks" description="Everything that needs a next step, across inquiries, prospects, and carriers." />
      <div className="max-w-4xl"><TasksPanel s={s} showLinked /></div>
    </>
  );
}
