'use client'
/**
 * On a demo deployment, a client document page (proposal, SOW, or contract)
 * opened by someone signed in to the admin demo reads and writes the demo
 * data, so a fictional proposal can be accepted or a contract signed. Anyone
 * else sees the real page.
 */
import { DEMO_LABEL } from '@/lib/demo/mode'
import { hasDemoSession, installDemoFetch } from '@/lib/demo/browser'
import { ADMIN_CORAL, ADMIN_INK } from '@/lib/admin-theme'
import { useSyncExternalStore } from 'react'

export default function DemoDocBridge() {
  // Installed while rendering (not in an effect), so it's in place before the page loads its document.
  if (typeof window !== 'undefined' && hasDemoSession()) installDemoFetch({ publicDocs: true })
  const demo = useSyncExternalStore(() => () => {}, hasDemoSession, () => false)
  if (!demo) return null
  return (
    <div role="note" style={{ background: ADMIN_CORAL, color: ADMIN_INK, borderBottom: `2px solid ${ADMIN_INK}`, padding: '6px 12px', fontSize: 13, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <strong>{DEMO_LABEL}</strong> You’re viewing the client’s page with demo data. Emails are simulated.
    </div>
  )
}
