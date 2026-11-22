'use client'
/**
 * Marking a project complete (Active Project to Closed). Offers the Website
 * Care introduction, ticked by default, with the recipient and the email
 * itself shown before you confirm. It is sent once per project (the server
 * enforces it) and recorded under the client; it's skipped when the client
 * already has active Care or the introduction was already sent. Completing
 * the project never depends on the email.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { useTheme } from '../../_components/theme'
import { Dialog } from '../../_components/ui'
import type { Client } from '../../_lib/types'

type Preview = {
  recipient: { name: string; email: string }
  project: { id: string; name: string } | null
  can_send: boolean
  skip: string | null
  email: { subject: string; html: string }
}

/** `sendOnly`: for a client already in Closed (a failed send, or a project completed before this existed); the stage isn't touched. */
export default function CompleteProjectDialog({ client, onClose, onDone, sendOnly = false }: { client: Client; onClose: () => void; onDone: () => void; sendOnly?: boolean }) {
  const { d } = useTheme()
  const [pre, setPre] = useState<Preview | null>(null)
  const [careOff, setCareOff] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [send, setSend] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/care/admin/clients/${client.id}/introduction`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 404) { if (live) setCareOff(true); return }
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
        if (live) { setPre(data); setSend(!!data.can_send) }
      })
      .catch((e) => { if (live) setLoadErr(String(e.message || e)) })
    return () => { live = false }
  }, [client.id])

  async function confirm() {
    setBusy(true)
    try {
      if (!sendOnly) {
        await supabase.from('clients').update({ pipeline_stage: 'closed' }).eq('id', client.id)
        if (pre?.project) await supabase.from('projects').update({ status: 'completed' }).eq('id', pre.project.id).eq('status', 'active')
      }
      const done = sendOnly ? 'Done.' : 'Project complete.'
      if (send && pre?.can_send) {
        const r = await fetch(`/api/care/admin/clients/${client.id}/introduction`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project_id: pre.project?.id || null }) })
        const data = await r.json().catch(() => ({}))
        setResult(r.ok ? { ok: true, text: `${done} Website Care introduction sent to ${data.sent_to}.` } : { ok: false, text: `${sendOnly ? 'The' : 'Project complete, but the'} introduction wasn’t sent: ${data.error || `HTTP ${r.status}`}` })
      } else {
        setResult({ ok: true, text: `${done} No introduction was sent.` })
      }
      onDone()
    } finally { setBusy(false) }
  }

  const loading = !pre && !careOff && !loadErr
  return (
    <Dialog label={sendOnly ? 'Website Care introduction' : 'Mark project complete'} onClose={onClose} maxWidth={640} closeOnBackdrop={false}>
      <div style={{ fontFamily: ADMIN_FONTS.display, fontSize: 18, fontWeight: 600, color: d.text, marginBottom: 6 }}>{sendOnly ? 'Website Care introduction' : 'Mark project complete'}</div>
      <div style={{ fontSize: 13, color: d.text2, marginBottom: 16 }}>
        {client.name}{client.business ? `, ${client.business}` : ''}{pre?.project ? ` · ${pre.project.name}` : ''}{sendOnly ? '' : ' moves to Closed.'}
      </div>
      {result ? (
        <>
          <p role="status" style={{ fontSize: 13, color: result.ok ? d.greenText : d.accent, margin: '0 0 16px' }}>{result.text}</p>
          <div className="form-actions"><button className="btn-save" onClick={onClose}>Close</button></div>
        </>
      ) : (
        <>
          <div data-testid="care-intro" style={{ border: '1px solid ' + d.border, borderRadius: 10, padding: 14, marginBottom: 16, background: d.surface }}>
            {loading && <div style={{ fontSize: 12, color: d.text3 }}>Checking the Website Care introduction…</div>}
            {careOff && <div style={{ fontSize: 12, color: d.text3 }}>Website Care is switched off here, so there’s no introduction to send.</div>}
            {loadErr && <div role="alert" style={{ fontSize: 12, color: d.accent }}>The Website Care introduction couldn’t be prepared ({loadErr}). You can still complete the project.</div>}
            {pre && (
              <>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: d.text, cursor: pre.can_send ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={send && pre.can_send} disabled={!pre.can_send} onChange={(e) => setSend(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>Send a Website Care introduction{pre.can_send ? <> to <b>{pre.recipient.name ? `${pre.recipient.name}, ` : ''}{pre.recipient.email}</b></> : ''}</span>
                </label>
                {!pre.can_send && <div role="status" style={{ fontSize: 12, color: d.amberText, margin: '6px 0 0 26px' }}>Not sent: {pre.skip}</div>}
                <div style={{ fontSize: 12, color: d.text3, margin: '8px 0 0 26px', lineHeight: 1.6 }}>
                  It explains the optional plans and links to Website Care. It’s sent once per project. If they choose a plan, you confirm the scope and send their online agreement as usual.
                </div>
                <details open={pre.can_send} style={{ margin: '10px 0 0 26px' }}>
                  <summary style={{ fontSize: 12, color: d.text2, cursor: 'pointer' }}>Preview: {pre.email.subject}</summary>
                  <iframe title="Website Care introduction preview" sandbox="" srcDoc={pre.email.html} style={{ width: '100%', height: 420, border: '1px solid ' + d.border, borderRadius: 8, marginTop: 8, background: '#fff' }} />
                </details>
              </>
            )}
          </div>
          <div className="form-actions">
            <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-save" onClick={confirm} disabled={busy || loading || (sendOnly && !(send && pre?.can_send))}>
              {busy ? 'Working…' : sendOnly ? 'Send introduction' : send && pre?.can_send ? 'Complete and send introduction' : 'Complete project'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
