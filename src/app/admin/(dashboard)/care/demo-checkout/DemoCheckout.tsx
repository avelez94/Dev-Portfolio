'use client'
/**
 * Demo stand in for Stripe Checkout. In real use the client opens Stripe's
 * own page from the link you send them, and only Stripe's verified payment
 * notice marks the website paid. Here "Pay" plays that notice.
 */
import { useEffect, useState } from 'react'
import { CARE_CSS, careApi, useLoad, Badge, ErrorBox, Loading } from '../ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export default function DemoCheckout() {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => { setId(new URLSearchParams(window.location.search).get('site')) }, []) // eslint-disable-line react-hooks/set-state-in-effect
  const site = useLoad<Row>(id ? `sites/${id}` : null, [id])
  const tpl = useLoad<Row>('template')
  const [done, setDone] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const s = site.data?.site
  const plan = (tpl.data?.plans || []).find((p: Row) => p.id === s?.plan)

  async function pay() {
    setBusy(true); setErr(null)
    try { setDone(await careApi<Row>(`sites/${id}/demo-pay`, { method: 'POST', json: {} })); site.reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="care care-frame">
      <style>{CARE_CSS}</style>
      <main id="admin-main" className="care-main" style={{ maxWidth: 560 }}>
        <section className="care-panel">
          <Badge tone="coral">Simulated Stripe checkout</Badge>
          <h1 style={{ fontSize: 22, margin: '10px 0 4px' }}>What the client sees</h1>
          <p className="care-muted" style={{ marginBottom: 12 }}>In real use this is Stripe’s own page, opened from the link you send. Nothing here contacts Stripe.</p>
          <ErrorBox error={err || site.error} />
          {!s ? <Loading /> : (
            <div className="care-grid">
              <div className="care-sub">
                <div className="care-label">Subscription</div>
                <div style={{ fontSize: 18 }}><b>{plan?.name || s.plan}</b>, ${plan?.monthly}/month</div>
                <div className="care-muted">For {site.data?.client?.business || site.data?.client?.name}: {s.label}</div>
                {typeof s.agreed_monthly_price === 'number' && plan && s.agreed_monthly_price !== plan.monthly && (
                  <p className="care-err" style={{ margin: '8px 0 0' }}>The agreed price on file is ${s.agreed_monthly_price}, but Stripe charges the plan’s price (${plan.monthly}). Reports show the agreed price. A different charge needs its own Stripe price.</p>
                )}
              </div>
              {done ? (
                <div className="care-okmsg" role="status">
                  Paid (simulated). Stripe would now send its payment notice; the website shows <b>Paid, active</b> and the first monthly review was created{done.held ? ', waiting for you to confirm the setup' : ''}.{' '}
                  <a href={`/admin/care?site=${id}`}>Back to the website</a>
                </div>
              ) : s.stripe_subscription_id ? (
                <p>This website already has a subscription. <a href={`/admin/care?site=${id}`}>Back to the website</a></p>
              ) : (
                <div className="care-row">
                  <button className="care-btn primary" disabled={busy} onClick={pay}>{busy ? 'Paying…' : `Pay $${plan?.monthly ?? ''} (simulated)`}</button>
                  <a className="care-btn" href={`/admin/care?site=${id}`}>Leave without paying</a>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
