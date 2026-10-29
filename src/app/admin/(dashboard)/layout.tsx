import AdminShell from './_components/AdminShell'

/** One shell for Home, Pipeline, Revenue, Documents, Schedule, and Website Care. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
