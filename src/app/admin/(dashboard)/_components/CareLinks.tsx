'use client'
/** Links from a client's Pipeline profile to their Website Care websites (only where Website Care is on). */
import { useEffect, useState } from 'react'
import { useTheme } from './theme'

export default function CareLinks({ clientId }: { clientId: string }) {
  const { d } = useTheme()
  const [sites, setSites] = useState<{ id: string; label: string }[]>([])
  useEffect(() => {
    let live = true
    fetch(`/api/care/admin/clients/${clientId}/documents`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j?.sites) setSites(j.sites) }).catch(() => {})
    return () => { live = false }
  }, [clientId])
  if (!sites.length) return null
  return <>{sites.map((s) => <a key={s.id} href={`/admin/care?site=${s.id}`} style={{ color: d.accent, textTransform: 'none', letterSpacing: 0 }}>Website Care: {s.label}</a>)}</>
}
