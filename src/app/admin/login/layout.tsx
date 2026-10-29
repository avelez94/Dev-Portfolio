import { ADMIN_CORAL, ADMIN_INK } from '@/lib/admin-theme'
import { DEMO_LABEL, demoDeployment } from '@/lib/demo/mode'

/** On demo deployments, says up front that the admin here runs on fictional data. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  if (!demoDeployment()) return children
  return (
    <>
      <div role="note" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, background: ADMIN_CORAL, color: ADMIN_INK, borderBottom: `2px solid ${ADMIN_INK}`, padding: '8px 16px', fontSize: 14, textAlign: 'center' }}>
        <strong>{DEMO_LABEL}</strong> This preview’s admin uses fictional data and simulated email, meetings, checks, and payments. Sign in with the admin password.
      </div>
      {children}
    </>
  )
}
