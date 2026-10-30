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
  // After a link is replaced, a signed but unpaid client gets the new link (nothing to sign again).
  const signedNewLink = a.state === 'signed' && !a.sent && !!a.link
  const canSend = !a.link_off && (['ready', 'sent', 'viewed', 'outdated'].includes(a.state) || signedNewLink) && (a.problems.length === 0 || signedNewLink) && a.recipient.allowed?.ok
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
        <dt>Private link</dt><dd>{a.link ? <code style={{ overflowWrap: 'anywhere' }}>{a.link}</code> : a.link_off ? <b style={{ color: 'var(--redText)' }}>Turned off. The client’s old link is refused.</b> : 'Created when you send it'}</dd>
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
            <Action tone="primary" label={again ? 'Send again' : signedNewLink ? 'Send the new link' : a.state === 'outdated' ? 'Send updated agreement' : 'Send agreement link'} disabled={typed.trim().toLowerCase() !== a.recipient.email.toLowerCase()}
              run={() => careApi<Row>(`sites/${siteId}/agreement`, { method: 'POST', json: { confirm_email: typed, resend: again } })} done={(r) => { setMsg(`Agreement link sent to ${(r as Row).sent_to}.`); setTyped(''); refresh() }} />
            {again && <span className="care-muted">Sends the same private link again as a reminder.</span>}
          </div>
        </div>
      )}
      {msg && <div className="care-okmsg" role="status" style={{ marginTop: 10 }}>{msg}</div>}
      {(a.link || a.link_off) && <LinkControls siteId={siteId} active={!!a.link} signed={a.state === 'signed'} onDone={(m) => { setMsg(m); setLink(null); refresh() }} />}
      {a.links?.length > 0 && (
        <details style={{ marginTop: 10 }} data-testid="agreement-links"><summary>Link history ({a.links.length})</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{a.links.map((l: Row) => (
            <li key={l.id}><code>{l.token}</code>: {l.status === 'active' ? <b>active</b> : 'turned off'}, created {fmt(l.created_at, tz)}{l.sent_at ? `, sent ${fmt(l.sent_at, tz)} to ${l.sent_to}` : ''}{l.revoked_at ? `, turned off ${fmt(l.revoked_at, tz)} (${l.revoked_reason})` : ''}{l.replaced_by ? ', replaced' : ''}{l.closed_checkout_session ? ', its open checkout was closed' : ''}</li>
          ))}</ul>
        </details>
      )}
      {a.history.length > 0 && <AgreementVersions siteId={siteId} tz={tz} history={a.history} currentId={a.current?.id} />}
    </section>
  )
}

/** Turn the private link off, or replace it. Signed agreements and their PDFs are kept either way. */
function LinkControls({ siteId, active, signed, onDone }: { siteId: string; active: boolean; signed: boolean; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sure, setSure] = useState(false)
  if (!open) return <div className="care-row" style={{ marginTop: 10 }}><button type="button" className="care-btn small" onClick={() => setOpen(true)} data-testid="link-controls">{active ? 'Turn off or replace this link' : 'Issue a new link'}</button></div>
  return (
    <div className="care-sub" style={{ marginTop: 10 }} data-testid="link-form">
      <p style={{ margin: '0 0 8px' }}>{active ? 'The client’s current link will stop working for viewing, signing and payment, and any checkout opened from it is closed so it can’t be paid.' : 'Issues a new private link. The old one stays refused.'} {signed ? 'The signed agreement and its PDF stay on file; the client won’t sign again because the link changed.' : 'Nothing already signed is affected.'}</p>
      <Field label="Why" id="link-reason"><input id="link-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example, sent to the wrong address" /></Field>
      {active && <label className="care-row" style={{ marginTop: 6 }}><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I understand the client’s current link stops working</label>}
      <div className="care-row" style={{ marginTop: 8 }}>
        <Action tone="primary" label={active ? 'Replace link' : 'Issue new link'} disabled={reason.trim().length < 3 || (active && !sure)}
          run={() => careApi<Row>(`sites/${siteId}/agreement/replace`, { method: 'POST', json: { reason } })} done={() => { setOpen(false); onDone('New link issued. The old link no longer works. Send the new link when you’re ready.') }} />
        {active && <Action label="Turn off only" disabled={reason.trim().length < 3 || !sure}
          run={() => careApi<Row>(`sites/${siteId}/agreement/revoke`, { method: 'POST', json: { reason, confirm: true } })} done={(r) => { setOpen(false); onDone(`Link turned off.${(r as Row).closed_checkout ? ' Its open checkout was closed.' : ''}`) }} />}
        <button type="button" className="care-btn small" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

/** Every issued version: open any one as the client read it; signed versions download their stored PDF. */
function AgreementVersions({ siteId, tz, history, currentId }: { siteId: string; tz: string; history: Row[]; currentId?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const v = useLoad<Row>(open ? `sites/${siteId}/agreements/${open}` : null, [open])
  const label = (h: Row) => h.status === 'signed' ? `signed ${fmt(h.signed_at, tz)} by ${h.signer_name}` : h.status === 'superseded' ? (h.signed_at ? `signed ${fmt(h.signed_at, tz)} by ${h.signer_name}, later replaced` : 'not signed, replaced') : 'issued, not signed yet'
  return (
    <details style={{ marginTop: 10 }} data-testid="agreement-versions"><summary>All agreement versions ({history.length})</summary>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{history.map((h: Row) => (
        <li key={h.id} style={{ marginBottom: 4 }}>
          {h.terms_version}, {usd(h.amount_cents)}, issued {fmt(h.issued_at, tz)}: {label(h)}{h.superseded_reason ? ` (${h.superseded_reason})` : ''}{h.id === currentId ? ' · current' : ''}{' '}
          <button type="button" className="care-btn small" aria-expanded={open === h.id} onClick={() => setOpen(open === h.id ? null : h.id)}>{open === h.id ? 'Hide' : 'View'}</button>{' '}
          {h.has_pdf && <a className="care-btn small" href={`/api/care/admin/sites/${siteId}/agreements/${h.id}/pdf`}>Signed PDF</a>}
        </li>
      ))}</ul>
      {open && (v.error ? <ErrorBox error={v.error} onRetry={v.reload} /> : !v.data ? <Loading lines={2} /> : (
        <div className="care-paper" style={{ marginTop: 8, maxHeight: 420, overflow: 'auto' }} data-testid="agreement-version">
          <h3>Care agreement for {v.data.snapshot.site.label}</h3>
          <p className="muted">Version {v.data.terms_version} · {v.data.snapshot.plan.name} · {v.data.snapshot.price.label} a month · issued {v.data.snapshot.issued_on}{v.data.signed_at ? ` · signed by ${v.data.signer_name} (${v.data.signer_email})` : ''}</p>
          <div className="sec">Agreed website and checks</div>
          <p>{v.data.snapshot.site.url}</p>
          <ul>{v.data.snapshot.scope.pages.map((p: Row) => <li key={p.url}>{p.label}: {p.url}</li>)}{v.data.snapshot.scope.destinations.map((d: Row) => <li key={d.url}>{d.label} (opened only): {d.url}</li>)}</ul>
          <p>Checked by hand: {v.data.snapshot.scope.checks.map((c: Row) => c.label).join('; ')}</p>
          {v.data.snapshot.terms.map((t: Row) => <div key={t.title}><div className="sec">{t.title}</div>{t.body.map((b: string) => <p key={b}>{b}</p>)}</div>)}
        </div>
      ))}
    </details>
  )
}
