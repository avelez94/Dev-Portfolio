import { demoDeployment } from '@/lib/demo/mode'
import DemoDocBridge from '../../admin/_demo/DemoDocBridge'

/** On demo deployments, a signed in demo session sees this client page with demo data. */
export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {demoDeployment() && <DemoDocBridge />}
      {children}
    </>
  )
}
