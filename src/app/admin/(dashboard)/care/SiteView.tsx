'use client'
import { useEffect, useMemo, useState } from 'react'
import WorkPanel from './WorkPanel'
import InvitePanel from './InvitePanel'
import PracticePanel from './PracticePanel'
import { useLoad, careApi, Badge, SiteBilling, Field, Loading, ErrorBox, Empty, Action, fmt, workStatus } from './ui'
import { SitesTable } from './CareApp'
import { CARE_TERMS_VERSION } from '@/content/care-terms'
import { STANDARD_HOURLY_RATE } from '@/lib/terms'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Go = (n: { view?: 'sites'; site?: string | null; cycle?: string | null }) => void

export default function SiteView({ id, go }: { id: string | null; go: Go }) {
  if (!id) return <SiteList go={go} />
  if (id === 'new') return <SiteEditor go={go} />
  return <SiteDetail id={id} go={go} />
}

function SiteList({ go }: { go: Go }) {
  const { data, error, reload } = useLoad<Row>('overview')
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <div className="care-panel"><Loading /></div>
  return (
    <section className="care-panel">
      <div className="care-between" style={{ marginBottom: 10 }}><h2>Websites</h2><button className="care-btn primary" onClick={() => go({ site: 'new' })}>Enroll a website</button></div>
      <SitesTable data={data} go={go} />
    </section>
  )
}

const blankSite = {
  client_id: '', label: 'Main website', plan: 'essential', agreed_monthly_price: '', site_url: '', approved_domains: '', pages: [{ url: '', label: 'Home' }], destinations: [] as Row[],
  features: '', manual_checklist: [] as Row[], recipient_name: '', recipient_email: '', review_window_days: '', scan_limits: {} as Row,
  is_additional_site: false, additional_site_terms: '', internal_notes: '',
}

function SiteEditor({ go, site, onSaved }: { go: Go; site?: Row; onSaved?: () => void }) {
  const tpl = useLoad<Row>('template')
  const cl = useLoad<{ clients: Row[] }>('clients')
  const [f, setF] = useState<Row>(() => site ? { ...site, approved_domains: (site.approved_domains || []).join(', '), features: site.features ?? '', recipient_name: site.recipient_name ?? '', recipient_email: site.recipient_email ?? '', review_window_days: site.review_window_days ?? '', agreed_monthly_price: site.agreed_monthly_price ?? '' } : blankSite)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dns, setDns] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }))
  const linked = !!site?.stripe_subscription_id

  const clients = useMemo(() => (cl.data?.clients || []).filter((c) => !q || `${c.name} ${c.business} ${c.email}`.toLowerCase().includes(q.toLowerCase())), [cl.data, q])
  const chosen = (cl.data?.clients || []).find((c) => c.id === f.client_id)
  const advertised = (tpl.data?.plans || []).find((p: Row) => p.id === f.plan)

  async function save() {
    setBusy(true); setErr(null); setMsg(null)
    try {
      const body = { ...f, approved_domains: String(f.approved_domains).split(/[\s,]+/).filter(Boolean), review_window_days: f.review_window_days === '' ? null : Number(f.review_window_days), agreed_monthly_price: f.agreed_monthly_price === '' ? null : Number(f.agreed_monthly_price) }
      if (site) {
        const r = await careApi<Row>(`sites/${site.id}`, { method: 'PUT', json: body })
        setMsg(r.needsConfirmation ? 'Saved. What gets checked changed, so recurring reviews are paused until you confirm the setup again.' : 'Saved.')
        onSaved?.()
      } else {
        const r = await careApi<Row>('sites', { method: 'POST', json: body })
        go({ site: r.site.id })
      }
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function checkDns() {
    setDns('Checking…')
    try {
      const r = await careApi<Row>('check-url', { method: 'POST', json: { url: f.site_url, approved_domains: String(f.approved_domains).split(/[\s,]+/).filter(Boolean) } })
      setDns(r.ok ? 'The address is public and inside the approved domains.' : `Not allowed: ${r.reason}`)
    } catch (e) { setDns((e as Error).message) }
  }

  const list = (k: 'pages' | 'destinations' | 'manual_checklist') => (f[k] || []) as Row[]
  const setList = (k: 'pages' | 'destinations' | 'manual_checklist', i: number, patch: Row) => set(k, list(k).map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const removeAt = (k: 'pages' | 'destinations' | 'manual_checklist', i: number) => set(k, list(k).filter((_, j) => j !== i))

  return (
    <section className="care-panel" aria-labelledby="ed-h">
      <h2 id="ed-h" style={{ marginBottom: 4 }}>{site ? 'Website settings' : 'Enroll a website'}</h2>
      <p className="care-muted" style={{ marginBottom: 14 }}>Saving doesn’t start anything. Checks only begin after you confirm the setup, and only for paid periods.</p>
      <ErrorBox error={err} />
      {msg && <div className="care-okmsg" role="status">{msg}</div>}
      <div className="care-grid">
        <div className="care-two">
          <Field label="Client record" id="f-client" hint={chosen ? `${chosen.name || ''}${chosen.business ? ', ' + chosen.business : ''} · ${chosen.email || 'no email on file'}` : 'Subscriptions are linked to this exact record, never by email.'}>
            <input aria-label="Search clients" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} disabled={linked} style={{ marginBottom: 6 }} />
            <select id="f-client" value={f.client_id} onChange={(e) => set('client_id', e.target.value)} disabled={linked}>
              <option value="">Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business || c.name} {c.business && c.name ? `(${c.name})` : ''}</option>)}
            </select>
          </Field>
          <Field label="Care plan" id="f-plan" hint={linked ? 'Set by the Stripe subscription.' : 'Checks and the report never use included time.'}>
            <select id="f-plan" value={f.plan} onChange={(e) => set('plan', e.target.value)} disabled={linked}>
              {(tpl.data?.plans || []).map((p: Row) => <option key={p.id} value={p.id}>{p.name}, ${p.monthly}/mo{p.includedMinutes ? `, ${p.includedMinutes} min` : ''}{p.priceConfigured ? '' : ' (no Stripe price set)'}</option>)}
            </select>
          </Field>
          <Field label="Agreed monthly price (whole dollars)" id="f-price" hint={`The price this client agreed to. Reports show it, never the advertised price${advertised ? ` ($${advertised.monthly} today)` : ''}.`}>
            <input id="f-price" inputMode="numeric" value={f.agreed_monthly_price} onChange={(e) => set('agreed_monthly_price', e.target.value.replace(/[^\d]/g, ''))} placeholder="Not recorded" />
          </Field>
        </div>
        <div className="care-two">
          <Field label="Website name" id="f-label"><input id="f-label" value={f.label} onChange={(e) => set('label', e.target.value)} /></Field>
          <Field label="Website address" id="f-url" hint={dns || 'Public https address on the standard port.'}>
            <div className="care-row" style={{ flexWrap: 'nowrap' }}><input id="f-url" value={f.site_url} onChange={(e) => set('site_url', e.target.value)} placeholder="https://example.com/" /><button type="button" className="care-btn small" onClick={checkDns}>Check</button></div>
          </Field>
        </div>
        <Field label="Approved domains" id="f-dom" hint="Comma separated. Pages and site links outside these are never crawled."><input id="f-dom" value={f.approved_domains} onChange={(e) => set('approved_domains', e.target.value)} placeholder="example.com" /></Field>

        <fieldset className="care-sub" style={{ border: '1px solid var(--border)' }}>
          <legend className="care-label">Agreed pages (up to {tpl.data?.caps?.maxPages ?? 25})</legend>
          <div className="care-grid">
            {list('pages').map((p, i) => (
              <div key={i} className="care-row" style={{ flexWrap: 'nowrap' }}>
                <input aria-label={`Page ${i + 1} name`} style={{ maxWidth: 180 }} value={p.label} onChange={(e) => setList('pages', i, { label: e.target.value })} placeholder="Name" />
                <input aria-label={`Page ${i + 1} address`} value={p.url} onChange={(e) => setList('pages', i, { url: e.target.value })} placeholder="https://example.com/contact" />
                <button type="button" className="care-btn small" onClick={() => removeAt('pages', i)} aria-label={`Remove page ${i + 1}`}>Remove</button>
              </div>
            ))}
            <div><button type="button" className="care-btn small" onClick={() => set('pages', [...list('pages'), { url: '', label: '' }])}>Add page</button></div>
          </div>
        </fieldset>

        <fieldset className="care-sub" style={{ border: '1px solid var(--border)' }}>
          <legend className="care-label">Contact, booking, and checkout destinations</legend>
          <p className="care-muted" style={{ marginBottom: 8 }}>Opened only. The checker never fills in, books, or pays. A page opening doesn’t prove the flow works.</p>
          <div className="care-grid">
            {list('destinations').map((d, i) => (
              <div key={i} className="care-row" style={{ flexWrap: 'nowrap' }}>
                <select aria-label={`Destination ${i + 1} type`} style={{ maxWidth: 130 }} value={d.kind} onChange={(e) => setList('destinations', i, { kind: e.target.value })}>
                  <option value="contact">Contact</option><option value="booking">Booking</option><option value="checkout">Checkout</option><option value="other">Other</option>
                </select>
                <input aria-label={`Destination ${i + 1} name`} style={{ maxWidth: 170 }} value={d.label} onChange={(e) => setList('destinations', i, { label: e.target.value })} placeholder="Name" />
                <input aria-label={`Destination ${i + 1} address`} value={d.url} onChange={(e) => setList('destinations', i, { url: e.target.value })} placeholder="https://" />
                <button type="button" className="care-btn small" onClick={() => removeAt('destinations', i)} aria-label={`Remove destination ${i + 1}`}>Remove</button>
              </div>
            ))}
            <div><button type="button" className="care-btn small" onClick={() => set('destinations', [...list('destinations'), { kind: 'booking', url: '', label: '' }])}>Add destination</button></div>
          </div>
        </fieldset>

        <Field label="Agreed features and scope notes" id="f-feat" hint="For custom apps, list exactly what is covered. Nothing outside the checklist is promised."><textarea id="f-feat" value={f.features} onChange={(e) => set('features', e.target.value)} /></Field>

        <fieldset className="care-sub" style={{ border: '1px solid var(--border)' }}>
          <legend className="care-label">Manual checklist</legend>
          <div className="care-row" style={{ marginBottom: 10 }}>
            {(tpl.data?.checklist || []).map((t: Row) => {
              const on = list('manual_checklist').some((m) => m.id === t.id)
              return <button type="button" key={t.id} className="care-btn small" aria-pressed={on} style={on ? { background: 'var(--accentBg)', borderColor: 'var(--accent)' } : undefined}
                onClick={() => set('manual_checklist', on ? list('manual_checklist').filter((m) => m.id !== t.id) : [...list('manual_checklist'), t])}>{on ? '✓ ' : '+ '}{t.label}</button>
            })}
          </div>
          <div className="care-grid">
            {list('manual_checklist').map((m, i) => (
              <div key={m.id || i} className="care-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <input aria-label={`Checklist item ${i + 1} category`} style={{ maxWidth: 130 }} value={m.category} onChange={(e) => setList('manual_checklist', i, { category: e.target.value })} />
                <div style={{ flex: 1, display: 'grid', gap: 4 }}>
                  <input aria-label={`Checklist item ${i + 1}`} value={m.label} onChange={(e) => setList('manual_checklist', i, { label: e.target.value })} />
                  <input aria-label={`Checklist item ${i + 1} instructions`} value={m.instructions || ''} onChange={(e) => setList('manual_checklist', i, { instructions: e.target.value })} placeholder="How to check it" />
                </div>
                <button type="button" className="care-btn small" onClick={() => removeAt('manual_checklist', i)} aria-label={`Remove checklist item ${i + 1}`}>Remove</button>
              </div>
            ))}
            <div><button type="button" className="care-btn small" onClick={() => set('manual_checklist', [...list('manual_checklist'), { id: '', label: '', category: 'Other', instructions: '' }])}>Add custom item</button></div>
          </div>
        </fieldset>

        <div className="care-two">
          <Field label="Report recipient name" id="f-rn"><input id="f-rn" value={f.recipient_name} onChange={(e) => set('recipient_name', e.target.value)} /></Field>
          <Field label="Report recipient email" id="f-re" hint="Reports go only to this exact address."><input id="f-re" type="email" value={f.recipient_email} onChange={(e) => set('recipient_email', e.target.value)} /></Field>
        </div>
        <div className="care-two">
          <Field label="Review deadline (days after payment)" id="f-rw" hint="Leave empty to use the default in settings."><input id="f-rw" inputMode="numeric" value={f.review_window_days} onChange={(e) => set('review_window_days', e.target.value)} /></Field>
          <Field label="Scan limits" id="f-lim" hint={`Defaults: ${tpl.data?.limits?.maxPages} pages, ${tpl.data?.limits?.maxLinks} links, ${tpl.data?.limits?.concurrency} at a time`}>
            <div className="care-row" style={{ flexWrap: 'nowrap' }}>
              <input id="f-lim" aria-label="Max links" placeholder={`Links (${tpl.data?.limits?.maxLinks})`} value={f.scan_limits?.maxLinks ?? ''} onChange={(e) => set('scan_limits', { ...f.scan_limits, maxLinks: e.target.value })} />
              <input aria-label="Concurrency" placeholder={`At once (${tpl.data?.limits?.concurrency})`} value={f.scan_limits?.concurrency ?? ''} onChange={(e) => set('scan_limits', { ...f.scan_limits, concurrency: e.target.value })} />
            </div>
          </Field>
        </div>
        <div className="care-sub">
          <label className="care-row"><input type="checkbox" checked={!!f.is_additional_site} onChange={(e) => set('is_additional_site', e.target.checked)} /> This is an additional website for a client who already has one</label>
          {f.is_additional_site && <Field label="Agreed pricing for the additional site" id="f-ast"><input id="f-ast" value={f.additional_site_terms} onChange={(e) => set('additional_site_terms', e.target.value)} placeholder="e.g. separate Essential Care subscription, agreed by email on Oct 20" /></Field>}
        </div>
        <Field label="Private notes" id="f-in" hint="Never shown to the client."><textarea id="f-in" value={f.internal_notes || ''} onChange={(e) => set('internal_notes', e.target.value)} /></Field>
        <div className="care-row">
          <button className="care-btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : site ? 'Save changes' : 'Save enrollment'}</button>
          {!site && <button className="care-btn" onClick={() => go({ site: null })}>Cancel</button>}
        </div>
      </div>
    </section>
  )
}

function SiteDetail({ id, go }: { id: string; go: Go }) {
  const { data, error, reload } = useLoad<Row>(`sites/${id}`)
  const settings = useLoad<Row>('settings')
  const status = useLoad<Row>('status')
  const [link, setLink] = useState<string | null>(null)
  const [conf, setConf] = useState({ confirm_website: false, confirm_authorization: false, confirm_checklist: false, authorization_note: '', confirm_terms: false, terms_note: '' })
  const [period, setPeriod] = useState({ period_start: '', period_end: '', note: '', confirm_paid: false })
  const [billNote, setBillNote] = useState('')
  useEffect(() => { if (data?.site?.authorization_note) setConf((c) => ({ ...c, authorization_note: data.site.authorization_note })) }, [data?.site?.authorization_note]) // eslint-disable-line react-hooks/set-state-in-effect
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <div className="care-panel"><Loading lines={6} /></div>
  const { site, client, cycles, reports, activity } = data
  const tz = settings.data?.timezone || 'America/New_York'
  const confirmed = site.enrollment_status === 'confirmed'
  const ended = site.enrollment_status === 'ended'

  return (
    <>
      <div className="care-who" aria-label="Active website">
        <div className="care-label">Website for</div>
        <h2>{client?.business || client?.name || 'Unknown client'}</h2>
        <div>{site.label} · <a href={site.site_url} target="_blank" rel="noreferrer noopener">{site.site_url}</a></div>
        <div className="care-muted">Report recipient: {site.recipient_name || 'not set'} &lt;{site.recipient_email || 'no email'}&gt;</div>
        <div className="care-row" style={{ marginTop: 8 }}>
          <Badge tone={confirmed ? 'ok' : 'warn'}>{confirmed ? 'Setup confirmed' : ended ? 'Care ended' : site.enrollment_status === 'paused' ? 'Paused' : 'Needs confirmation'}</Badge>
          <SiteBilling site={site} manual={cycles.some((c: Row) => c.source === 'manual')} />
          <span className="care-muted" style={{ textTransform: 'capitalize' }}>{site.plan} Care</span>
        </div>
        <div className="care-muted" style={{ marginTop: 4 }}>Care terms: {site.care_terms_version === CARE_TERMS_VERSION ? `current (${site.care_terms_note || 'accepted'})` : site.care_terms_version ? `older terms (${site.care_terms_version}), review needed` : 'recorded when you confirm the setup'}</div>
      </div>

      {!confirmed && !ended && site.enrollment_status !== 'paused' && (
        <section className="care-panel" aria-labelledby="conf-h">
          <h2 id="conf-h">Confirm the setup</h2>
          <p className="care-muted" style={{ margin: '4px 0 12px' }}>Recurring reviews stay off until you confirm. A paid period that arrives before then waits here; no scan of any address starts on payment alone.{data.setupChanged && ' The setup changed since the last confirmation.'}</p>
          <div className="care-grid">
            <label className="care-row"><input type="checkbox" checked={conf.confirm_website} onChange={(e) => setConf({ ...conf, confirm_website: e.target.checked })} /> The website address, approved domains, pages, and destinations above are the agreed scope.</label>
            <label className="care-row"><input type="checkbox" checked={conf.confirm_authorization} onChange={(e) => setConf({ ...conf, confirm_authorization: e.target.checked })} /> The client authorized these read only checks of their website.</label>
            <label className="care-row"><input type="checkbox" checked={conf.confirm_checklist} onChange={(e) => setConf({ ...conf, confirm_checklist: e.target.checked })} /> The manual checklist matches what we agreed.</label>
            <Field label="How the client authorized it" id="c-auth"><input id="c-auth" value={conf.authorization_note} onChange={(e) => setConf({ ...conf, authorization_note: e.target.value })} placeholder="Signed care agreement, Oct 28" /></Field>
            {site.care_terms_version !== CARE_TERMS_VERSION && <>
              <label className="care-row"><input type="checkbox" checked={conf.confirm_terms} onChange={(e) => setConf({ ...conf, confirm_terms: e.target.checked })} /> The client accepted the current care terms ({CARE_TERMS_VERSION}): flexible plan time, and additional work at ${STANDARD_HOURLY_RATE} an hour with a one hour minimum or an agreed fixed quote.</label>
              <Field label="How the client accepted the care terms" id="c-terms"><input id="c-terms" value={conf.terms_note} onChange={(e) => setConf({ ...conf, terms_note: e.target.value })} placeholder="Signed care agreement, Oct 28" /></Field>
            </>}
            <div><Action tone="primary" label="Confirm setup and enable reviews" run={() => careApi(`sites/${id}/confirm`, { method: 'POST', json: conf })} done={reload} /></div>
          </div>
        </section>
      )}

      <section className="care-panel" aria-labelledby="bill-h">
        <div className="care-between"><h2 id="bill-h">Subscription and billing</h2><SiteBilling site={site} manual={cycles.some((c: Row) => c.source === 'manual')} /></div>
        <p className="care-muted" style={{ margin: '4px 0 12px' }}>Billing status comes only from verified Stripe events. Paid doesn’t mean the review is done; work status is tracked separately below.</p>
        <div className="care-two">
          <div className="care-sub">
            <div className="care-label">Stripe</div>
            <div>Customer: <code>{site.stripe_customer_id || 'none'}</code></div>
            <div>Subscription: <code>{site.stripe_subscription_id || 'none'}</code> {site.subscription_status && <span className="care-muted">({site.subscription_status})</span>}</div>
            <div>Current period: {site.current_period_start ? `${fmt(site.current_period_start, tz, false)} to ${fmt(site.current_period_end, tz, false)}` : 'none'}</div>
            <div>Paid through: {fmt(site.paid_through, tz, false)}</div>
            {site.cancel_at_period_end && <div><Badge tone="warn">Cancels at period end</Badge></div>}
            {site.failed_payment_count > 0 && <div><Badge tone="bad">{site.failed_payment_count} failed payment(s)</Badge></div>}
            <div className="care-muted">Last synced {fmt(site.stripe_synced_at, tz)}</div>
          </div>
          <div className="care-grid">
            {!site.stripe_subscription_id && !ended && <InvitePanel siteId={id as string} tz={tz} onSent={reload} />}
            {!site.stripe_subscription_id && !ended && <Action label="Copy checkout link instead" run={() => careApi<Row>(`sites/${id}/checkout`, { method: 'POST', json: {} })} done={(r) => { setLink((r as Row).url); reload() }} />}
            {!site.stripe_subscription_id && site.checkout_session_id && <div className="care-muted">Checkout link {site.checkout_expires_at && new Date(site.checkout_expires_at) > new Date() ? `open until ${fmt(site.checkout_expires_at, tz)}` : 'expired'}{site.invitation_sent_at ? `; invitation sent ${fmt(site.invitation_sent_at, tz)} to ${site.invitation_sent_to}` : ''}.</div>}
            {site.stripe_customer_id && <Action label="Create billing portal link" run={() => careApi<Row>(`sites/${id}/portal`, { method: 'POST', json: {} })} done={(r) => setLink((r as Row).url)} />}
            {site.stripe_subscription_id && <Action label="Refresh from Stripe" run={() => careApi(`sites/${id}/sync`, { method: 'POST', json: {} })} done={reload} />}
            {link && <div className="care-sub"><div className="care-label">Link to send the client yourself</div><input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Stripe link" /><small className="care-muted">Nothing was emailed. The same link is reused until it expires (24 hours). Opening it doesn’t activate anything; only Stripe’s verified payment notice does.</small></div>}
            {['attention', 'past_due', 'unpaid', 'refunded', 'disputed'].includes(site.billing_state) && (
              <div className="care-sub">
                <Field label="Mark billing reviewed" id="b-note"><input id="b-note" value={billNote} onChange={(e) => setBillNote(e.target.value)} placeholder="What you did" /></Field>
                <Action small label="Mark reviewed" run={() => careApi(`sites/${id}/clear-billing`, { method: 'POST', json: { note: billNote } })} done={reload} />
              </div>
            )}
          </div>
        </div>
        {status.data?.demo && !ended && <PracticePanel site={site} onChange={reload} />}
        {!site.stripe_subscription_id && !ended && (
          <details style={{ marginTop: 12 }}>
            <summary>Billed outside Stripe? Add a paid service period by hand</summary>
            <div className="care-grid" style={{ marginTop: 10 }}>
              <div className="care-two">
                <Field label="Period start" id="p-s"><input id="p-s" type="date" value={period.period_start} onChange={(e) => setPeriod({ ...period, period_start: e.target.value })} /></Field>
                <Field label="Period end" id="p-e"><input id="p-e" type="date" value={period.period_end} onChange={(e) => setPeriod({ ...period, period_end: e.target.value })} /></Field>
              </div>
              <Field label="Note" id="p-n"><input id="p-n" value={period.note} onChange={(e) => setPeriod({ ...period, note: e.target.value })} placeholder="Invoice number or agreement" /></Field>
              <label className="care-row"><input type="checkbox" checked={period.confirm_paid} onChange={(e) => setPeriod({ ...period, confirm_paid: e.target.checked })} /> This period is paid or agreed in writing.</label>
              <div><Action label="Add service period" run={() => careApi(`sites/${id}/cycles`, { method: 'POST', json: period })} done={reload} /></div>
            </div>
          </details>
        )}
      </section>

      <section className="care-panel" aria-labelledby="hist-h">
        <h2 id="hist-h" style={{ marginBottom: 10 }}>Monthly reviews</h2>
        {cycles.length === 0 ? <Empty>No service periods yet. The first appears when the first payment succeeds.</Empty> : (
          <div className="care-scroll" tabIndex={0}><table className="care-table">
            <thead><tr><th>Period</th><th>Work</th><th>Report</th><th>Due</th><th></th></tr></thead>
            <tbody>{cycles.map((c: Row) => {
              const r = reports.find((x: Row) => x.cycle_id === c.id)
              const [label, tone] = workStatus(c, r)
              return (
                <tr key={c.id}>
                  <td>{fmt(c.period_start, tz, false)} to {fmt(c.period_end, tz, false)}<div className="care-muted">{c.source === 'manual' ? 'Added by hand' : 'Stripe'}{c.billing_flag ? ` · ${c.billing_flag.replace(/_/g, ' ')}` : ''}</div></td>
                  <td><Badge tone={tone}>{label}</Badge></td>
                  <td><span style={{ textTransform: 'capitalize' }}>{r?.status || 'draft'}</span> <span className="care-muted">v{r?.version}</span></td>
                  <td>{fmt(c.review_due_at, tz)}</td>
                  <td><button className="care-btn small" onClick={() => go({ cycle: c.id })}>Open</button></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      </section>

      <section className="care-panel" aria-labelledby="work-h">
        <h2 id="work-h" style={{ marginBottom: 10 }}>Plan time and work</h2>
        <WorkPanel siteId={id} tz={tz} />
      </section>

      {!ended && <SiteEditor go={go} site={site} onSaved={reload} />}

      {!ended && (
        <section className="care-panel">
          <h2 style={{ marginBottom: 8 }}>Pause or end</h2>
          <p className="care-muted" style={{ marginBottom: 10 }}>Pausing stops new scans; paid periods wait until you resume. Ending keeps every report and its history.</p>
          <div className="care-row">
            {site.enrollment_status === 'paused'
              ? <Action label="Resume reviews" run={() => careApi(`sites/${id}/resume`, { method: 'POST', json: {} })} done={reload} />
              : <Action label="Pause reviews" run={() => careApi(`sites/${id}/pause`, { method: 'POST', json: {} })} done={reload} />}
            <Action tone="danger" label="End care for this website" confirmText="Yes, end care (reports are kept)" run={() => careApi(`sites/${id}/end`, { method: 'POST', json: { confirm: true } })} done={reload} />
          </div>
        </section>
      )}

      <section className="care-panel">
        <h2 style={{ marginBottom: 8 }}>History</h2>
        {activity.length === 0 ? <Empty>No activity yet.</Empty> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>{activity.map((a: Row) => <li key={a.id}><span className="care-muted">{fmt(a.created_at, tz)}</span> {a.action.replace(/_/g, ' ')} <span className="care-muted">({a.actor})</span></li>)}</ul>
        )}
      </section>
    </>
  )
}
