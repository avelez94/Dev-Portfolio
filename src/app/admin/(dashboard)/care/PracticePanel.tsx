'use client'
/**
 * Demo only: practice the billing events you'd otherwise wait for Stripe to
 * send. Each button changes the simulated subscription the way Stripe would
 * and runs Stripe's notices through the real webhook processing, so the
 * website, reviews, and flags change exactly as they would for real.
 */
import { useState } from 'react'
import { careApi } from './ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const SCENARIOS: [string, string, string][] = [
  ['renewal', 'Renewal', 'The next month is paid (or, after a failure, Stripe’s retry succeeds; after a scheduled cancellation, the period ends).'],
  ['failed_payment', 'Failed payment', 'The renewal payment fails. Run it again for another failed attempt.'],
  ['cancel_at_period_end', 'Cancel at period end', 'The client schedules cancellation. The paid period is still honored.'],
  ['cancel_now', 'Cancel immediately', 'The subscription ends now, before the paid period is over.'],
  ['repeat', 'Send the last notice again', 'Stripe redelivers the same notice. Nothing is created twice.'],
]

export default function PracticePanel({ site, onChange }: { site: Row; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [out, setOut] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const linkOpen = !site.stripe_subscription_id && site.checkout_url && site.checkout_expires_at && new Date(site.checkout_expires_at) > new Date()

  async function run(scenario: string) {
    setBusy(scenario); setErr(null); setOut(null)
    try { setOut(await careApi<Row>(`sites/${site.id}/demo-scenario`, { method: 'POST', json: { scenario } })); onChange() } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <section className="care-sub" aria-labelledby="prac-h" data-testid="practice-panel" style={{ marginTop: 12, borderStyle: 'dashed' }}>
      <h3 id="prac-h" style={{ margin: '0 0 4px', fontSize: 15 }}>Practice billing events (demo)</h3>
      <p className="care-muted" style={{ margin: '0 0 10px' }}>Simulated Stripe notices, handled by the same code as real ones. Nothing reaches Stripe and no email leaves the demo.</p>
      {linkOpen && (
        <div className="care-row" style={{ marginBottom: 10 }}>
          <a className="care-btn small" href={site.checkout_url}>Open the simulated checkout (play the client)</a>
          <button type="button" className="care-btn small" disabled={!!busy} onClick={() => run('expire_link')}>Let the link expire</button>
        </div>
      )}
      {site.stripe_subscription_id ? (
        <div className="care-grid">
          {SCENARIOS.map(([k, label, hint]) => (
            <div key={k} className="care-row" style={{ alignItems: 'baseline' }}>
              <button type="button" className="care-btn small" disabled={!!busy} onClick={() => run(k)}>{busy === k ? 'Working…' : label}</button>
              <span className="care-muted" style={{ fontSize: 13 }}>{hint}</span>
            </div>
          ))}
        </div>
      ) : !linkOpen && <p className="care-muted" style={{ margin: 0 }}>Send a subscription invitation first, then play the client on the simulated checkout. Lakeside Dental already has a subscription to practice with.</p>}
      {err && <div role="alert" style={{ color: 'var(--redText)', fontSize: 13, marginTop: 8 }}>{err}</div>}
      {out && (
        <div className="care-okmsg" role="status" style={{ marginTop: 10 }}>
          {out.summary}
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {(out.delivered || []).map((d: Row, i: number) => <li key={i}><code>{d.type}</code>: {d.status === 'duplicate' ? 'already processed, ignored' : d.status}{d.note ? ` (${d.note})` : ''}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
