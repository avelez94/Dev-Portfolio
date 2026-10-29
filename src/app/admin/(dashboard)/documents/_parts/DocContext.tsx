'use client'
/**
 * Details panel on the Documents page: who the open form is for, and the
 * exact address it sends to. Only that address receives the document.
 */
import Link from 'next/link'
import { useTheme } from '../../_components/theme'
import type { Client } from '../../_lib/types'

export default function DocContext({ form, kind, clients }: { form: { client_name: string; client_business: string; client_email: string } | null; kind: string; clients: Client[] }) {
  const { d } = useTheme()
  const email = (form?.client_email || '').trim()
  const match = email ? clients.find((c) => (c.email || '').toLowerCase() === email.toLowerCase()) : undefined
  return (
    <div data-testid="doc-context">
      <div className="rp-card" style={{ background: d.sand }}>
        <div className="rp-eyebrow">{form ? kind + ' for' : 'Documents'}</div>
        {form ? (
          <>
            <div className="rp-name" style={{ color: d.text }}>{form.client_name || 'No client yet'}</div>
            {form.client_business && <div className="rp-meta" style={{ color: d.text2 }}>{form.client_business}</div>}
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: d.white, border: '1px solid ' + d.border2 }}>
              <div className="rf-label">Sends to</div>
              <div className="rf-val" style={{ color: email ? d.text : d.redText }}>{email || 'Add the client email in the form'}</div>
            </div>
          </>
        ) : (
          <div className="rf-val" style={{ color: d.text2 }}>Choose a document to fill out. Its client appears here, and only that client receives it.</div>
        )}
      </div>
      {form && match && (
        <div style={{ fontSize: 13, color: d.text2, lineHeight: 1.6, marginBottom: 12 }}>
          Matches <strong style={{ color: d.text }}>{match.name}</strong> in your pipeline.{' '}
          <Link className="cr-btn" style={{ background: d.accentBg, color: d.text, border: '1px solid ' + d.border2, marginLeft: 4, textDecoration: 'none', display: 'inline-block' }} href={`/admin/pipeline?client=${encodeURIComponent(match.id)}`}>Open client</Link>
        </div>
      )}
      {form && email && !match && <div style={{ fontSize: 13, color: d.text2, lineHeight: 1.6, marginBottom: 12 }}>Not in your pipeline yet.</div>}
    </div>
  )
}
