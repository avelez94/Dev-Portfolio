import type { Metadata } from 'next'
import { careEnabled } from '@/lib/care/config'
import { ADMIN_THEMES, ADMIN_FONTS } from '@/lib/admin-theme'
import CareApp from './CareApp'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Website Care' }

export default function CarePage() {
  if (!careEnabled()) {
    const t = ADMIN_THEMES.teal
    return (
      <main id="admin-main" className="care-frame" style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: ADMIN_FONTS.body, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div role="status" style={{ maxWidth: 480, background: t.white, border: `1px solid ${t.border}`, borderRadius: 18, padding: 24 }}>
          <h1 style={{ fontFamily: ADMIN_FONTS.display, fontSize: 24, margin: '0 0 8px' }}>Website Care is switched off here</h1>
          <p style={{ color: t.text2, margin: '0 0 16px' }}>
            This environment doesn’t have WEBSITE_CARE_ENABLED set, so no care data is read or written. The setup guide in docs/WEBSITE_CARE.md explains how to turn it on.
          </p>
          <a href="/admin" style={{ color: t.accent }}>Back to the dashboard</a>
        </div>
      </main>
    )
  }
  return <CareApp />
}
