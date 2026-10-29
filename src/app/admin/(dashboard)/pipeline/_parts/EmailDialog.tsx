'use client'
/** Email one client. The recipient is fixed when the dialog opens. */
import { useState } from 'react'
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { useTheme } from '../../_components/theme'
import { Dialog, Field } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import { MY_EMAIL, postJson } from '../../_lib/api'
import type { Client } from '../../_lib/types'

export default function EmailDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { d, inputStyle } = useTheme()
  const [form, setForm] = useState({ subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  useUnsaved(Boolean(!sent && (form.subject || form.message)))
  const first = client.name.split(' ')[0]

  async function send() {
    if (!form.subject || !form.message) return
    setSending(true)
    try {
      await postJson('/api/email/send', { clientEmail: client.email, clientName: client.name, cc: MY_EMAIL, subject: form.subject, message: form.message })
      setSent(true)
      setTimeout(onClose, 1500)
    } catch (e) { console.error(e) }
    setSending(false)
  }

  return (
    <Dialog label="Email client" onClose={onClose} maxWidth={520}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontFamily: ADMIN_FONTS.display, fontSize: 18, fontWeight: 600, color: d.text }}>Email {first}</div>
        <button aria-label="Close" className="icon-btn" style={{ color: d.text3, fontSize: 18 }} onClick={onClose}>x</button>
      </div>
      <div style={{ fontSize: 12, color: d.text3, marginBottom: 20 }}>{client.email} · CC: {MY_EMAIL}</div>
      {sent ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 14, color: d.greenText, fontWeight: 500 }}>Email sent</div>
        </div>
      ) : (
        <>
          <Field label="Subject" style={{ marginBottom: 12 }}><input style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Project update, quick question..." /></Field>
          <Field label="Message" style={{ marginBottom: 20 }}><textarea className="form-input" style={{ background: d.surface, borderColor: d.border, color: d.text, minHeight: 140 }} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={'Hi ' + first + ','} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-cancel" style={{ borderColor: d.border, color: d.text2 }} onClick={onClose}>Cancel</button>
            <button className="btn-save" disabled={sending || !form.subject || !form.message} onClick={send}>{sending ? 'Sending...' : 'Send Email'}</button>
          </div>
        </>
      )}
    </Dialog>
  )
}
