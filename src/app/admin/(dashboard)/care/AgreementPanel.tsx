'use client'
/**
 * The care agreement for a website: confirm the technical scope, send the
 * client their persistent private agreement link, see when they view and sign
 * it, download the signed PDF, and (once signed) copy the payment link. A
 * verified payment then queues the first check.
 */
import { useState } from 'react'
import { careApi, useLoad, Badge, ErrorBox, Field, Loading, Action, fmt } from './ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 })}`

const STATE: Record<string, [string, 'ok' | 'warn' | 'bad' | 'info' | 'coral']> = {
  not_ready: ['Not ready to send', 'warn'],
  ready: ['Ready to send', 'coral'],
  sent: ['Sent, not opened yet', 'info'],
  viewed: ['Opened, not signed yet', 'info'],
  signed: ['Signed, payment unlocked', 'ok'],
  paid: ['Signed and paid', 'ok'],
  outdated: ['Signature needed for the current details', 'bad'],
}

const STEPS = ['Confirm technical scope', 'Send agreement link', 'Client signs', 'Signed copy emailed', 'Payment unlocked', 'Payment queues the check']

export default function AgreementPanel({ siteId, tz, onChange }: { siteId: string; tz: string; onChange: () => void }) {
  const st = useLoad<Row>(`sites/${siteId}/agreement`)
  const [typed, setTyped] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const a = st.data
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />
  if (!a) return <section className="care-panel"><Loading lines={3} /></section>
  const [label, tone] = STATE[a.state] || [a.state, 'info']
  const done = [
    !!a.scope_confirmed,
    !!a.sent || ['signed', 'paid'].includes(a.state),
    ['signed', 'paid'].includes(a.state),
    a.current?.email_status === 'sent',
    ['signed', 'paid'].includes(a.state),
    a.state === 'paid',
  ]
  const canSend = ['ready', 'sent', 'viewed', 'outdated'].includes(a.state) && a.problems.length === 0 && a.recipient.allowed?.ok
  const again = a.state === 'sent' || a.state === 'viewed'
  const refresh = () => { st.reload(); onChange() }
  return (
    <section className="care-panel" aria-labelledby="agr-h" data-testid="agreement-panel">
      <div className="care-between"><h2 id="agr-h">Care agreement</h2><Badge tone={tone}>{label}</Badge></div>
      <p className="care-muted" style={{ margin: '4px 0 10px' }}>The client reads and signs version {a.version} on a private link that never changes. Signing stores and emails a signed PDF and unlocks payment. A verified payment queues the first check straight away; reports are still approved and sent by you.</p>
      <ol className="care-pipe" aria-label="Agreement steps" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {STEPS.map((s, i) => <li key={s} className={done[i] ? 'done' : i === done.indexOf(false) ? 'active' : ''}><b>{s}<span className="care-sr"> ({done[i] ? 'done' : 'not yet'})</span></b></li>)}
      </ol>
      {a.problems.length > 0 && !['signed', 'paid'].includes(a.state) && (
        <div className="care-sub" role="status" style={{ marginTop: 10 }}><b>Before the client can sign:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{a.problems.map((p: string) => <li key={p}>{p}</li>)}</ul></div>
      )}
      <dl className="care-dl" style={{ marginTop: 10 }}>
        <dt>To</dt><dd>{a.recipient.name ? `${a.recipient.name}, ` : ''}<b>{a.recipient.email || 'no email on file'}</b>{a.recipient.allowed && !a.recipient.allowed.ok && <span style={{ color: 'var(--redText)' }}> · {a.recipient.allowed.reason}</span>}</dd>
        <dt>Plan and price</dt><dd>{a.preview.plan.name}, <b>{usd(a.preview.price.amount_cents)} USD every month</b>, billed in advance</dd>
        <dt>Private link</dt><dd>{a.link ? <code style={{ overflowWrap: 'anywhere' }}>{a.link}</code> : 'Created when you send it'}</dd>
        {a.sent && <><dt>Sent</dt><dd>{fmt(a.sent.at, tz)} to {a.sent.to}{a.current?.viewed_at ? ` · opened ${fmt(a.current.viewed_at, tz)}` : ''}</dd></>}
        {a.current?.signed_at && <><dt>Signed</dt><dd>{fmt(a.current.signed_at, tz)} by {a.current.signer_name} · signed copy {a.current.email_status === 'sent' ? 'emailed to the client and you' : a.current.email_status === 'skipped' ? `not emailed (${a.current.email_error})` : `email failed (${a.current.email_error || 'unknown'})`}</dd></>}
      </dl>
      <div className="care-row" style={{ marginTop: 10 }}>
        <button type="button" className="care-btn small" onClick={() => setPreview(!preview)} aria-expanded={preview}>{preview ? 'Hide' : 'Preview'} what the client signs</button>
        {a.current?.has_pdf && <a className="care-btn small" href={`/api/care/admin/sites/${siteId}/agreements/${a.current.id}/pdf`}>Download signed PDF</a>}
        {a.current?.has_pdf && a.current.email_status !== 'sent' && <Action small label="Email the signed copy again" run={() => careApi(`sites/${siteId}/agreements/${a.current.id}/email`, { method: 'POST', json: {} })} done={refresh} />}
        {a.state === 'signed' && <Action small label="Copy payment link" run={() => careApi<Row>(`sites/${siteId}/checkout`, { method: 'POST', json: {} })} done={(r) => setLink((r as Row).url)} />}
      </div>
      {link && <div className="care-sub" style={{ marginTop: 8 }}><div className="care-label">Payment link (Stripe)</div><input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Payment link" /><small className="care-muted">The client can also pay from their agreement page any time. Only Stripe’s verified payment notice starts the plan and queues the check.</small></div>}
      {preview && (
        <div className="care-paper" style={{ marginTop: 10, maxHeight: 420, overflow: 'auto' }}>
          <h3>Care agreement for {a.preview.site.label}</h3>
          <p className="muted">Version {a.preview.version} · {a.preview.plan.name} · {a.preview.price.label} a month</p>
          <div className="sec">Agreed website and checks</div>
          <p>{a.preview.site.url}</p>
          <ul>{a.preview.scope.pages.map((p: Row) => <li key={p.url}>{p.label}: {p.url}</li>)}{a.preview.scope.destinations.map((d: Row) => <li key={d.url}>{d.label} (opened only): {d.url}</li>)}</ul>
          <p>Checked by hand: {a.preview.scope.checks.map((c: Row) => c.label).join('; ')}</p>
          {a.preview.terms.map((t: Row) => <div key={t.title}><div className="sec">{t.title}</div>{t.body.map((b: string) => <p key={b}>{b}</p>)}</div>)}
        </div>
      )}
      {canSend && (
        <div className="care-grid" style={{ marginTop: 12 }}>
          <Field label={`Type ${a.recipient.email} to ${again ? 'send a reminder' : 'send the agreement link'}`} id="agr-conf"><input id="agr-conf" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
          <div className="care-row">
            <Action tone="primary" label={again ? 'Send again' : a.state === 'outdated' ? 'Send updated agreement' : 'Send agreement link'} disabled={typed.trim().toLowerCase() !== a.recipient.email.toLowerCase()}
              run={() => careApi<Row>(`sites/${siteId}/agreement`, { method: 'POST', json: { confirm_email: typed, resend: again } })} done={(r) => { setMsg(`Agreement link sent to ${(r as Row).sent_to}.`); setTyped(''); refresh() }} />
            {again && <span className="care-muted">Sends the same private link again as a reminder.</span>}
          </div>
        </div>
      )}
      {msg && <div className="care-okmsg" role="status" style={{ marginTop: 10 }}>{msg}</div>}
      {a.history.length > 1 && (
        <details style={{ marginTop: 10 }}><summary>Earlier versions ({a.history.length - 1})</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{a.history.slice(1).map((h: Row) => <li key={h.id}>{h.terms_version}, {usd(h.amount_cents)}: {h.status}{h.signed_at ? ` ${fmt(h.signed_at, tz)} by ${h.signer_name}` : ''}{h.superseded_reason ? ` (${h.superseded_reason})` : ''}</li>)}</ul>
        </details>
      )}
    </section>
  )
}
