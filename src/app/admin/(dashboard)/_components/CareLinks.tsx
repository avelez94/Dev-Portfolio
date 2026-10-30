'use client'
/** Links from a client's Pipeline profile to each Website Care website's review history (only where Website Care is on). Each website keeps its own history. */
import { useEffect, useState } from 'react'
import { useTheme } from './theme'

export default function CareLinks({ clientId }: { clientId: string }) {
  const { d } = useTheme()
  const [sites, setSites] = useState<{ id: string; label: string; reviews?: number }[]>([])
  useEffect(() => {
    let live = true
    fetch(`/api/care/admin/clients/${clientId}/documents`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j?.sites) setSites(j.sites) }).catch(() => {})
    return () => { live = false }
  }, [clientId])
  if (!sites.length) return null
  return <>{sites.map((s) => <a key={s.id} href={`/admin/care?site=${s.id}#review-history`} data-testid="care-site-link" style={{ color: d.accent, textTransform: 'none', letterSpacing: 0 }}>Website Care: {s.label} ({s.reviews ?? 0} review{s.reviews === 1 ? '' : 's'})</a>)}</>
}
