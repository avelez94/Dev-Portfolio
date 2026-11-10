'use client'
/**
 * Demo stand in for Stripe Checkout, opened from Continue to payment on the client’s agreement page
 * (or the copied link). It reads the simulated checkout session, so an
 * expired or already used link behaves like Stripe's. "Pay" plays the client
 * paying; Stripe's notices then go through the real webhook processing.
 */
import { useEffect, useState } from 'react'
import { CARE_CSS, careApi, useLoad, Badge, ErrorBox, Loading } from '../ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export default function DemoCheckout() {
  const [sid, setSid] = useState<string | null>(null)
  useEffect(() => { setSid(new URLSearchParams(window.location.search).get('session')) }, []) // eslint-disable-line react-hooks/set-state-in-effect
  const sess = useLoad<Row>(sid ? `demo-checkout/session?session=${encodeURIComponent(sid)}` : null, [sid])
  const siteId = sess.data?.site_id as string | undefined
  const site = useLoad<Row>(siteId ? `sites/${siteId}` : null, [siteId])
  const tpl = useLoad<Row>('template')
  const [done, setDone] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const s = site.data?.site
  const plan = (tpl.data?.plans || []).find((p: Row) => p.id === s?.plan)
  const amount = typeof s?.checkout_amount_cents === 'number' ? s.checkout_amount_cents / 100 : plan?.monthly
  const back = siteId ? `/admin/care?site=${siteId}` : '/admin/care'

  async function pay() {
    setBusy(true); setErr(null)
    try { setDone(await careApi<Row>('demo-checkout/pay', { method: 'POST', json: { session: sid } })) } catch (e) { setErr((e as Error).message); sess.reload() } finally { setBusy(false) }
  }

  return (
    <div className="care care-frame">
      <style>{CARE_CSS}</style>
      <main id="admin-main" className="care-main" style={{ maxWidth: 560 }}>
        <section className="care-panel">
          <Badge tone="coral">Simulated Stripe checkout</Badge>
          <h1 style={{ fontSize: 22, margin: '10px 0 4px' }}>What the client sees</h1>
          <p className="care-muted" style={{ marginBottom: 12 }}>In real use this is Stripe’s own page, opened from Continue to payment on the signed agreement. Nothing here contacts Stripe.</p>
          <ErrorBox error={err || sess.error || site.error} />
          {!sid ? <p>This checkout link is missing its session. Open it from the agreement page or the copied link.</p> : !sess.data || !s ? <Loading /> : (
            <div className="care-grid">
              <div className="care-sub">
                <div className="care-label">Subscription</div>
                <div style={{ fontSize: 18 }}><b>{plan?.name || s.plan}</b>, ${amount}/month</div>
                <div className="care-muted">For {site.data?.client?.business || site.data?.client?.name}: {s.label}</div>
              </div>
              {done ? (
                <div className="care-okmsg" role="status">
                  Paid (simulated). Stripe’s notices were processed by the real webhook code: the website shows <b>Paid, active</b> and the first monthly review was created{done.held ? ', waiting for you to confirm the setup' : ''}.{' '}
                  <a href={back}>Back to the website</a>
                </div>
              ) : sess.data.status === 'expired' ? (
                <p className="care-err" role="alert">This checkout link has expired. Nothing was charged. Open the agreement page again for a fresh link. <a href={back}>Back to the website</a></p>
              ) : sess.data.status === 'complete' ? (
                <p>This checkout link was already used. <a href={back}>Back to the website</a></p>
              ) : (
                <div className="care-row">
                  <button className="care-btn primary" disabled={busy} onClick={pay}>{busy ? 'Paying…' : `Pay $${amount ?? ''} (simulated)`}</button>
                  <a className="care-btn" href={back}>Leave without paying</a>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
