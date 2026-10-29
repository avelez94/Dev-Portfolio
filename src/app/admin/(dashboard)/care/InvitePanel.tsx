'use client'
/**
 * Send subscription invitation: shows who it goes to, the plan, and the
 * monthly amount checked against the real Stripe price, before anything is
 * sent. Sending needs the recipient address typed in. A blocked price, a
 * missing address, or an existing subscription stops it here and on the
 * server.
 */
import { useState } from 'react'
import { careApi, useLoad, Badge, ErrorBox, Field, Loading, fmt } from './ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 })}`

export default function InvitePanel({ siteId, tz, onSent }: { siteId: string; tz: string; onSent: () => void }) {
  const [open, setOpen] = useState(false)
  const pre = useLoad<Row>(open ? `sites/${siteId}/invitation` : null, [open])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState<Row | null>(null)
  const p = pre.data
  const again = !!(p?.last_sent && p?.link?.open)

  async function send() {
    setBusy(true); setErr(null)
    try {
      setSent(await careApi<Row>(`sites/${siteId}/invitation`, { method: 'POST', json: { confirm_email: typed, resend: again } }))
      setTyped(''); pre.reload(); onSent()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (!open) return <div><button type="button" className="care-btn primary" onClick={() => setOpen(true)}>Send subscription invitation</button></div>
  return (
    <section className="care-sub" aria-labelledby="inv-h" data-testid="invite-panel">
      <div className="care-between"><h3 id="inv-h" style={{ margin: 0, fontSize: 16 }}>Send subscription invitation</h3><button type="button" className="care-btn small" onClick={() => { setOpen(false); setSent(null); setErr(null) }}>Close</button></div>
      <ErrorBox error={pre.error} onRetry={pre.reload} />
      {!p ? <Loading /> : (
        <div className="care-grid" style={{ marginTop: 8 }}>
          <dl className="care-dl">
            <dt>To</dt><dd>{p.recipient.name ? `${p.recipient.name}, ` : ''}<b>{p.recipient.email || 'no email on file'}</b></dd>
            <dt>Plan</dt><dd>{p.plan.name} ({p.plan.included_minutes} included minutes a month)</dd>
            <dt>Recurring amount</dt><dd><b>{usd(p.amount_cents)} {p.currency} every month</b>{p.check.price && <span className="care-muted"> · Stripe price <code>{p.check.price.id}</code></span>}</dd>
            <dt>Checkout link</dt><dd>{p.link ? (p.link.open ? `Open until ${fmt(p.link.expires_at, tz)}` : 'Expired; a new link will be created') : 'A new link will be created (good for 24 hours)'}</dd>
            {p.last_sent && <><dt>Last sent</dt><dd>{fmt(p.last_sent.at, tz)} to {p.last_sent.to}</dd></>}
          </dl>
          {p.check.ok
            ? <div><Badge tone="ok">Price verified</Badge> <span className="care-muted">The Stripe price matches the agreed amount, in USD, billed monthly.</span></div>
            : null}
          {p.blockers.length > 0 && (
            <div className="care-err" role="alert">
              <b>Can’t send yet.</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{p.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
          {sent ? (
            <div className="care-okmsg" role="status">Invitation sent to {sent.sent_to}. The link works until {fmt(sent.expires_at, tz)}.{sent.reused_link ? ' It is the same link as before.' : ''}</div>
          ) : p.ok && (
            <>
              <Field label={`Type ${p.recipient.email} to confirm`} id="inv-conf"><input id="inv-conf" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
              <div className="care-row">
                <button type="button" className="care-btn primary" disabled={busy || typed.trim().toLowerCase() !== p.recipient.email.toLowerCase()} onClick={send}>{busy ? 'Sending…' : again ? 'Send again' : 'Send invitation'}</button>
                {again && <span className="care-muted">Sends the same open link again as a reminder.</span>}
              </div>
            </>
          )}
          {err && <div role="alert" style={{ color: 'var(--redText)', fontSize: 13 }}>{err}</div>}
        </div>
      )}
    </section>
  )
}
