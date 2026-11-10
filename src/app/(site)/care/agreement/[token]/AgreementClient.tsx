'use client'
/**
 * Client side of the care agreement: shows the agreed website, checks, plan,
 * price and terms; takes a typed name, a drawn signature and an explicit
 * agreement; then offers Continue to payment. Copy rule: no dashes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import s from '@/components/site/site.module.css'

type Section = { title: string; body: string[] }

/** The site's page header (blocks.tsx is server only, so this client page draws the same markup). */
function PageHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string; tone?: 'teal' }) {
  return (
    <header className={`${s.pageHeader} ${s.pageHeaderTeal}`}>
      <div className={s.pageHeaderInner}>
        <p className={s.eyebrowLight}>{eyebrow}</p>
        <h1 className={s.pageTitle}>{title}</h1>
        <p className={s.pageLede}>{lede}</p>
      </div>
    </header>
  )
}
type Snap = {
  version: string; issued_on: string
  client: { name: string; business: string; email: string }
  site: { label: string; url: string; domains: string[] }
  plan: { name: string; included_minutes: number }
  price: { label: string }
  scope: { pages: { label: string; url: string }[]; destinations: { label: string; url: string }[]; checks: { label: string }[] }
  terms: Section[]; billing_disclosure: string
}
type View = { step: 'sign' | 'pay' | 'active' | 'unavailable'; message: string; queued_line: string; payment_open?: boolean; agreement: { id: string; status: string; snapshot: Snap; snapshot_hash: string; signed_at: string | null; signer_name: string | null } | null }

export default function AgreementClient({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [hasSig, setHasSig] = useState(false)
  const [notice, setNotice] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const drawing = useRef(false)

  const load = useCallback(() => {
    fetch(`/api/care/agreement/${token}`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Not found'); setView(d) })
      .catch((e) => setError(e.message === 'Not found' ? 'This link isn’t valid. Check the link in your email, or reply to it and I’ll help.' : e.message))
  }, [token])
  useEffect(() => { load() }, [load])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e) }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const ctx = canvas.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y)
    ctx.strokeStyle = '#2A1F1B'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
    last.current = p; setHasSig(true)
  }
  const up = () => { drawing.current = false; last.current = null }
  const clear = () => { const c = canvas.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); setHasSig(false) }

  async function sign() {
    if (!view?.agreement) return
    setBusy(true); setError('')
    try {
      const r = await fetch(`/api/care/agreement/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreement_id: view.agreement.id, snapshot_hash: view.agreement.snapshot_hash, signer_name: name.trim(), signature_image: canvas.current!.toDataURL('image/png'), agree }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Something went wrong.')
      setNotice(d.emailed ? 'Signed. Your signed copy is on its way to your inbox.' : 'Signed. Your signed copy will follow by email.')
      load()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function pay() {
    setBusy(true); setError('')
    try {
      const r = await fetch(`/api/care/agreement/${token}/checkout`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Payment isn’t available right now.')
      window.location.href = d.url
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }

  if (!view) {
    return <PageHeader tone="teal" eyebrow="Website care" title="Your care agreement." lede={error || 'Loading your agreement…'} />
  }
  const a = view.agreement?.snapshot
  const signed = view.agreement?.status === 'signed'
  return (
    <>
      <PageHeader
        tone="teal"
        eyebrow="Website care • Private link"
        title={a ? `Care agreement for ${a.site.label}.` : 'Your care agreement.'}
        lede={view.step === 'sign' ? (view.payment_open === false ? 'Read the agreement below, then sign at the bottom. Online payment opens later; signing doesn’t charge anything.' : 'Read the agreement below, then sign at the bottom. Payment opens once it’s signed.')
          : view.step === 'pay' ? `Signed${view.agreement?.signed_at ? ` on ${new Date(view.agreement.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}. The next step is starting your plan. ${view.queued_line}`
          : view.step === 'active' ? `Your plan is active. ${view.queued_line} I review the results before your report is sent.`
          : view.message}
      />
      <section className={s.section} aria-label="Agreement">
        <div className={s.termsDoc}>
          {notice && <p role="status" className={s.termsDocSection}><strong>{notice}</strong></p>}
          {error && <p role="alert" className={s.termsDocSection} style={{ borderColor: 'var(--coral-deep)' }}>{error}</p>}
          {view.step === 'pay' && (
            <section className={s.termsDocSection} aria-labelledby="pay-h">
              <h2 id="pay-h" className={s.termTitle}>Start your plan</h2>
              <p>{a?.plan.name}: {a?.price.label} a month. {a?.billing_disclosure}</p>
              {view.payment_open === false ? (
                <p style={{ marginTop: 14 }} role="status"><strong>Online payment isn’t open yet.</strong> Your signed agreement is on file and nothing is charged. I’ll email you when you can start your plan here.</p>
              ) : <>
                <p style={{ marginTop: 14 }}><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={pay} disabled={busy}>{busy ? 'Opening Stripe…' : 'Continue to Payment'}</button></p>
                <p style={{ marginTop: 8, fontSize: '0.9rem' }}>Payment is handled securely by Stripe.</p>
              </>}
            </section>
          )}
          {view.step === 'active' && (
            <section className={s.termsDocSection}><h2 className={s.termTitle}>You’re all set</h2><p>Your signed agreement is on file and your plan is active. Questions? Just reply to any of my emails.</p></section>
          )}
          {a && (
            <>
              <section className={s.termsDocSection} aria-labelledby="who-h">
                <h2 id="who-h" className={s.termTitle}>Plan and price</h2>
                <p>Between Alante Velez and {a.client.business || a.client.name}{a.client.business && a.client.name ? ` (${a.client.name})` : ''}. Version {a.version}, issued {a.issued_on}.</p>
                <p><strong>{a.plan.name}: {a.price.label} a month</strong>, billed monthly in advance until you cancel.{a.plan.included_minutes ? ` Includes ${a.plan.included_minutes} minutes of plan time each billing period.` : ''}</p>
              </section>
              <section className={s.termsDocSection} aria-labelledby="scope-h">
                <h2 id="scope-h" className={s.termTitle}>Agreed website and checks</h2>
                <p>{a.site.url}</p>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  {a.scope.pages.map((p) => <li key={p.url}>{p.label}: {p.url}</li>)}
                  {a.scope.destinations.map((d) => <li key={d.url}>{d.label} (opened only, never used): {d.url}</li>)}
                </ul>
                {a.scope.checks.length > 0 && <p>Checked by hand each month: {a.scope.checks.map((c) => c.label).join('; ')}.</p>}
              </section>
              {a.terms.map((t) => (
                <section key={t.title} className={s.termsDocSection}>
                  <h2 className={s.termTitle}>{t.title}</h2>
                  {t.body.map((b) => <p key={b}>{b}</p>)}
                </section>
              ))}
            </>
          )}
          {view.step === 'sign' && a && !signed && (
            <section className={s.termsDocSection} aria-labelledby="sign-h">
              <h2 id="sign-h" className={s.termTitle}>Sign</h2>
              <label htmlFor="sig-name" style={{ display: 'block', fontWeight: 700, marginTop: 6 }}>Your full name</label>
              <input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', font: 'inherit', marginTop: 4 }} />
              <p id="sig-help" style={{ fontWeight: 700, marginTop: 12 }}>Draw your signature</p>
              <canvas ref={canvas} width={720} height={200} aria-describedby="sig-help" role="img" aria-label="Signature box"
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
                style={{ width: '100%', height: 140, border: '1.5px solid var(--line)', borderRadius: 10, background: '#fff', touchAction: 'none', cursor: 'crosshair', marginTop: 4 }} />
              <p><button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={clear} style={{ marginTop: 6 }}>Clear signature</button></p>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 5 }} />
                <span>I’ve read this agreement and agree to it, including monthly billing in advance and the cancellation and refund terms.</span>
              </label>
              <p style={{ marginTop: 14 }}>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={sign} disabled={busy || !agree || !hasSig || name.trim().length < 2}>{busy ? 'Signing…' : 'Sign Agreement'}</button>
              </p>
              <p style={{ fontSize: '0.9rem', marginTop: 8 }}>You’ll get a signed PDF copy by email. Payment opens right after you sign.</p>
            </section>
          )}
          <p className={s.termsDocFoot}>Questions? Just reply to any of my emails. <Link href="/care/terms">Website Care terms</Link></p>
        </div>
      </section>
    </>
  )
}
