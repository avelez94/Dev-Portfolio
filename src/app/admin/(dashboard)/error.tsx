'use client'
import { useTheme } from './_components/theme'

/** Unexpected page errors: say so plainly and offer a retry. Nothing is sent or saved. */
export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const { d } = useTheme()
  return (
    <main id="admin-main" className="center" style={{ padding: 28 }}>
      <div role="alert" className="form-card" style={{ background: d.red, borderColor: d.redText, color: d.text, maxWidth: 560 }}>
        <div className="form-title" style={{ color: d.redText }}>This page couldn’t load</div>
        <div style={{ fontSize: 13, color: d.text2, marginBottom: 12 }}>{error.message || 'Something went wrong.'} Nothing was sent or saved.</div>
        <button className="btn-save" onClick={() => unstable_retry()}>Try Again</button>
      </div>
    </main>
  )
}
