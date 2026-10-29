import { ADMIN_THEMES } from '@/lib/admin-theme'

/** Shown while a dashboard page's code loads; each page then shows its own data loading state. */
export default function Loading() {
  return (
    <div className="center" role="status" style={{ padding: 60, color: ADMIN_THEMES.teal.text2, fontSize: 14 }}>
      Loading…
    </div>
  )
}
