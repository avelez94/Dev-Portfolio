'use client'
/** Review a document's contents before downloading or sending it. */
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { useTheme } from './theme'
import { Dialog } from './ui'
import type { PreviewDoc } from '../_lib/types'

export type PendingPreview = { doc: PreviewDoc; action: 'download' | 'send'; onConfirm: () => void }

export default function PreviewDialog({ preview, onClose }: { preview: PendingPreview; onClose: () => void }) {
  const { d } = useTheme()
  const { doc, action, onConfirm } = preview
  return (
    <Dialog label="Document preview" onClose={onClose} maxWidth={560} padding={0} z={1100}>
      <div style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid ' + d.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: ADMIN_FONTS.display, fontSize: 17, fontWeight: 600, color: d.text }}>{doc.title}</div>
            <div style={{ fontSize: 12, color: d.text3, marginTop: 2 }}>Review before {action === 'send' ? 'sending' : 'downloading'}</div>
          </div>
          <button aria-label="Close" className="icon-btn" style={{ color: d.text3, fontSize: 18 }} onClick={onClose}>x</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 24px 16px', flex: 1 }}>
          {doc.sections.map((s, i) => (
            <div key={i} className="preview-section" style={{ borderColor: d.border }}>
              <div className="preview-label" style={{ color: d.accent }}>{s.label}</div>
              <div className="preview-value" style={{ color: d.text }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid ' + d.border, display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={onClose}>Back to edit</button>
          <button className="btn-save" onClick={() => { onConfirm(); onClose() }}>{action === 'send' ? 'Confirm and Send' : 'Confirm and Download'}</button>
        </div>
      </div>
    </Dialog>
  )
}
