'use client'
/** A project's details and notes. */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { useTheme } from '../../_components/theme'
import { DetailRows, Dialog, DialogTitle } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import { fmtMoney, fmtShort } from '../../_lib/format'
import type { Project } from '../../_lib/types'

export default function ProjectDialog({ project: p, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { d } = useTheme()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(p.notes || '')
  useUnsaved(editing && notes !== (p.notes || ''))
  async function save() {
    await supabase.from('projects').update({ notes }).eq('id', p.id)
    setEditing(false)
    await onSaved()
  }
  return (
    <Dialog label="Project details" onClose={onClose}>
      <DialogTitle onClose={onClose}>{p.name}</DialogTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 20 }}>
        <DetailRows pad={10} rows={[
          { label: 'Type', val: p.type },
          { label: 'Value', val: fmtMoney(p.value) },
          { label: 'Platform', val: p.platform },
          { label: 'Status', val: p.status },
          { label: 'Deadline', val: p.end_date ? fmtShort(p.end_date) : 'None set' },
        ]} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: d.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</div>
          <button className="icon-btn" style={{ color: d.accent, fontSize: 12 }} onClick={() => setEditing(!editing)}>{editing ? 'cancel' : 'edit'}</button>
        </div>
        {editing ? (
          <div>
            <textarea className="form-input" style={{ background: d.surface, borderColor: d.border, color: d.text, marginBottom: 8 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Project notes, links, login credentials, anything relevant..." />
            <button className="btn-save" onClick={save}>Save Notes</button>
          </div>
        ) : (
          <div className="notes-box" role="button" tabIndex={0} style={{ background: d.surface, borderColor: d.border, color: p.notes ? d.text : d.text3 }} onClick={() => setEditing(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true) } }}>
            {p.notes || 'Click to add notes...'}
          </div>
        )}
      </div>
      <button className="btn-cancel" style={{ width: '100%', borderColor: d.border, color: d.text2 }} onClick={onClose}>Close</button>
    </Dialog>
  )
}
