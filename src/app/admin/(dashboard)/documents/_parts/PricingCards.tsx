'use client'
/** My Pricing: the reference prices shown on the Documents page. */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { useTheme } from '../../_components/theme'
import { useUnsaved } from '../../_components/unsaved'
import type { Pricing } from '../../_lib/types'

export default function PricingCards({ pricing, onSaved }: { pricing: Pricing[]; onSaved: () => Promise<unknown> }) {
  const { d, inputStyle } = useTheme()
  const [editing, setEditing] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { price: string; description: string }>>({})
  const current = pricing.find((p) => p.id === editing)
  useUnsaved(Boolean(current && edits[current.id] && (edits[current.id].price !== current.price || edits[current.id].description !== current.description)))

  async function save(id: string) {
    const e = edits[id]
    if (!e) return
    await supabase.from('pricing').update({ price: e.price, description: e.description, updated_at: new Date().toISOString() }).eq('id', id)
    setEditing(null)
    await onSaved()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
      {pricing.map((p) => {
        const isEditing = editing === p.id
        const e = edits[p.id] || { price: p.price, description: p.description }
        return (
          <div key={p.id} style={{ background: d.surface, borderRadius: 12, padding: '12px 14px', border: '1px solid ' + (isEditing ? d.accent : d.border), transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: d.text }}>{p.name}</div>
              <button className="icon-btn" style={{ color: isEditing ? d.accent : d.text3, fontSize: 12 }} onClick={() => {
                if (isEditing) setEditing(null)
                else { setEditing(p.id); setEdits((prev) => ({ ...prev, [p.id]: { price: p.price, description: p.description } })) }
              }}>{isEditing ? 'cancel' : 'edit'}</button>
            </div>
            {isEditing ? (
              <>
                <input style={{ ...inputStyle, marginBottom: 6, fontSize: 12, fontWeight: 600 }} value={e.price} onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { ...e, price: ev.target.value } }))} placeholder="Price" />
                <input style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }} value={e.description} onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { ...e, description: ev.target.value } }))} placeholder="Description" />
                <button className="btn-save" style={{ width: '100%' }} onClick={() => save(p.id)}>Save</button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: ADMIN_FONTS.display, fontSize: 14, fontWeight: 600, color: d.accent, marginBottom: 4 }}>{p.price}</div>
                <div style={{ fontSize: 12, color: d.text3, lineHeight: 1.5 }}>{p.description}</div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
