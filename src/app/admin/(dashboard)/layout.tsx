import AdminShell from './_components/AdminShell'
import { demoDeployment } from '@/lib/demo/mode'

/** One shell for Home, Pipeline, Revenue, Documents, Schedule, and Website Care. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell demo={demoDeployment()}>{children}</AdminShell>
}
