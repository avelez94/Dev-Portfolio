'use client'
/**
 * A paid service period added by hand, for a client billed outside Stripe.
 * Only after the client signed the current care agreement (checked again on
 * the server), and only with the payment actually received: one of your paid
 * invoices (counted in Revenue through that invoice) or money received
 * directly (counted here, once). Renewals are not collected automatically:
 * bill each month yourself and add its period when paid.
 */
import { useState } from 'react'
import { careApi, useLoad, Badge, Field, Action } from './ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const blank = { period_start: '', period_end: '', payment_method: '', invoice_id: '', amount: '', received_on: '', reference: '', note: '', confirm_paid: false }

export default function ManualPeriodPanel({ site, onDone }: { site: Row; onDone: () => void }) {
  const [p, setP] = useState(blank)
  const agreement = useLoad<Row>(`sites/${site.id}/agreement`)
  const invoices = useLoad<{ invoices: Row[] }>(site.is_test ? null : `sites/${site.id}/paid-invoices`)
  const signed = ['signed', 'paid'].includes(agreement.data?.state)
  const set = (patch: Partial<typeof blank>) => setP({ ...p, ...patch })
  const usd = (n: unknown) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

  return (
    <details style={{ marginTop: 12 }} data-testid="manual-period">
      <summary>Billed outside Stripe? Record a paid period</summary>
      <div className="care-grid" style={{ marginTop: 10 }}>
        <p className="care-muted" style={{ margin: 0 }}>
          Renewals aren’t collected automatically for clients billed outside Stripe. Bill each month yourself, then record that month here once it’s paid. Recording a paid period starts its review and check.
          {site.is_test && <> <Badge tone="warn">Test website</Badge> Test payments never count in Revenue.</>}
        </p>
        {agreement.data && !signed && (
          <div className="care-err" role="alert">
            A paid period can be recorded only after the client signs the current care agreement online. Send the agreement link above.
          </div>
        )}
        <div className="care-two">
          <Field label="Period start" id="p-s"><input id="p-s" type="date" value={p.period_start} onChange={(e) => set({ period_start: e.target.value })} /></Field>
          <Field label="Period end" id="p-e"><input id="p-e" type="date" value={p.period_end} onChange={(e) => set({ period_end: e.target.value })} /></Field>
        </div>
        <fieldset className="care-sub" style={{ border: 0, margin: 0 }}>
          <legend className="care-label">How was this period paid?</legend>
          {!site.is_test && (
            <label className="care-row"><input type="radio" name="p-m" checked={p.payment_method === 'invoice'} onChange={() => set({ payment_method: 'invoice' })} /> One of my invoices, marked paid (Revenue counts the invoice)</label>
          )}
          <label className="care-row"><input type="radio" name="p-m" checked={p.payment_method === 'direct'} onChange={() => set({ payment_method: 'direct' })} /> {site.is_test ? 'A test payment (fictional, never counted)' : 'Paid to me directly, not through an invoice (Zelle, check, cash)'}</label>
        </fieldset>
        {p.payment_method === 'invoice' && (
          <Field label="Paid invoice" id="p-i" hint="Only this client’s invoices that are marked paid are listed.">
            <select id="p-i" value={p.invoice_id} onChange={(e) => set({ invoice_id: e.target.value })}>
              <option value="">{invoices.data ? (invoices.data.invoices.length ? 'Choose an invoice' : 'No paid invoices for this client') : 'Loading…'}</option>
              {(invoices.data?.invoices || []).map((i) => <option key={i.id} value={i.id}>{i.invoice_number} · {usd(i.total_fee || i.amount)}{i.paid_date ? ` · paid ${String(i.paid_date).slice(0, 10)}` : ''}</option>)}
            </select>
          </Field>
        )}
        {p.payment_method === 'direct' && (
          <div className="care-two">
            <Field label="Amount received ($)" id="p-a"><input id="p-a" inputMode="decimal" value={p.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder={String(site.agreed_monthly_price ?? '')} /></Field>
            <Field label="Date received" id="p-r"><input id="p-r" type="date" value={p.received_on} onChange={(e) => set({ received_on: e.target.value })} /></Field>
            <Field label="How it was paid" id="p-h"><input id="p-h" value={p.reference} onChange={(e) => set({ reference: e.target.value })} placeholder={site.is_test ? 'Test payment' : 'Zelle, confirmation 4821'} /></Field>
          </div>
        )}
        <Field label="Note (optional)" id="p-n"><input id="p-n" value={p.note} onChange={(e) => set({ note: e.target.value })} /></Field>
        <label className="care-row"><input type="checkbox" checked={p.confirm_paid} onChange={(e) => set({ confirm_paid: e.target.checked })} /> {site.is_test ? 'This is a test period for a test website.' : 'I received this payment.'}</label>
        <div><Action label="Record paid period" disabled={!signed} run={() => careApi(`sites/${site.id}/cycles`, { method: 'POST', json: p })} done={() => { setP(blank); onDone() }} /></div>
      </div>
    </details>
  )
}
