'use client'
/**
 * Shared pieces for the Website Care admin: the dark admin palette as CSS
 * variables, buttons, badges, fields, and a fetch helper that signals an
 * expired session the same way the main dashboard does.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { ADMIN_THEMES, ADMIN_CORAL, ADMIN_INK, ADMIN_FONTS } from '@/lib/admin-theme'

const t = ADMIN_THEMES.teal

export const CARE_CSS = `
.care{--bg:${t.bg};--panel:${t.white};--surface:${t.surface};--surface2:${t.surface2};--surface3:${t.surface3};--text:${t.text};--text2:${t.text2};--text3:${t.text3};
--border:${t.border};--border2:${t.border2};--accent:${t.accent};--accentBg:${t.accentBg};--coral:${ADMIN_CORAL};--ink:${ADMIN_INK};
--green:${t.green};--greenText:${t.greenText};--amber:${t.amber};--amberText:${t.amberText};--red:${t.red};--redText:${t.redText};
min-height:100vh;background:var(--bg);color:var(--text);font-family:${ADMIN_FONTS.body};font-size:14px;line-height:1.5}
.care *,.care *::before,.care *::after{box-sizing:border-box}
.care h1,.care h2,.care h3{font-family:${ADMIN_FONTS.display};font-weight:600;margin:0;letter-spacing:-0.01em}
.care h1{font-size:26px}.care h2{font-size:20px}.care h3{font-size:16px}
.care p{margin:0}
.care a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
.care :focus-visible{outline:3px solid var(--coral);outline-offset:2px;border-radius:8px}
.care-top{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.care .care-mark{text-decoration:none;color:var(--ink);width:34px;height:34px;border-radius:12px;background:var(--coral);color:var(--ink);display:grid;place-items:center;font-family:${ADMIN_FONTS.display};font-style:italic;font-weight:700;border:2px solid var(--ink)}
.care-nav{display:flex;gap:4px;flex-wrap:wrap}
.care-nav button{background:none;border:1px solid transparent;color:var(--text2);padding:7px 12px;border-radius:999px;font:inherit;cursor:pointer;min-height:36px}
.care-nav button[aria-current=page]{background:var(--accentBg);color:var(--text);border-color:var(--border2)}
.care-main{max-width:1180px;margin:0 auto;padding:20px}
.care-banner{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.care-panel{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:18px;margin:0 0 16px}
.care-sub{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;min-width:0;overflow-wrap:anywhere}
.care-grid{display:grid;gap:12px}
.care-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 16px}
.care-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:14px}
.care-card b{display:block;font-family:${ADMIN_FONTS.display};font-size:28px;line-height:1.1}
.care-muted{color:var(--text3)}
.care-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.care-between{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.care-btn{font:inherit;font-weight:700;border-radius:999px;padding:8px 16px;min-height:38px;cursor:pointer;border:1.5px solid var(--border2);background:var(--surface2);color:var(--text)}
.care-btn.primary{background:var(--coral);color:var(--ink);border-color:var(--ink)}
.care-btn.danger{background:var(--red);color:var(--redText);border-color:var(--redText)}
.care-btn.small{padding:4px 10px;min-height:30px;font-size:13px}
.care-btn:disabled{opacity:.5;cursor:not-allowed}
.care-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;border:1px solid var(--border2);white-space:nowrap}
.care-badge.ok{background:var(--green);color:var(--greenText);border-color:transparent}
.care-badge.warn{background:var(--amber);color:var(--amberText);border-color:transparent}
.care-badge.bad{background:var(--red);color:var(--redText);border-color:transparent}
.care-badge.info{background:var(--surface3);color:var(--text)}
.care-badge.coral{background:var(--accentBg);color:var(--accent)}
.care-field{display:grid;gap:4px;min-width:0}
.care-field label,.care-label{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text2)}
.care-field small{color:var(--text3)}
.care input,.care select,.care textarea{font:inherit;color:var(--text);background:var(--surface);border:1.5px solid var(--border2);border-radius:10px;padding:8px 10px;min-height:40px;width:100%}
.care textarea{min-height:84px;resize:vertical}
.care input[type=checkbox]{width:18px;height:18px;min-height:0;accent-color:var(--coral)}
.care-table{width:100%;border-collapse:collapse}
.care-table th{text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--text2);padding:8px;border-bottom:1px solid var(--border2)}
.care-table td{padding:10px 8px;border-bottom:1px solid var(--border);vertical-align:top}
.care-table tr.click{cursor:pointer}.care-table tr.click:hover td{background:var(--surface)}
.care-err{background:var(--red);color:var(--redText);border-radius:12px;padding:10px 14px;margin:0 0 12px}
.care-okmsg{background:var(--green);color:var(--greenText);border-radius:12px;padding:10px 14px;margin:0 0 12px}
.care-who{background:var(--surface2);border:2px solid var(--coral);border-radius:16px;padding:14px 16px;margin:0 0 16px}
.care-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:12px 0 0}
.care-step{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px}
.care-step>span:first-child{display:block;font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px}
.care-step .care-badge{white-space:normal;margin:0 4px 4px 0}
.care-finding{border:1px solid var(--border);border-left:4px solid var(--border2);border-radius:12px;padding:12px;background:var(--surface)}
.care-finding.failed{border-left-color:var(--redText)}.care-finding.needs_review{border-left-color:var(--amberText)}
.care-finding.could_not_check{border-left-color:var(--text3)}.care-finding.passed{border-left-color:var(--greenText)}
.care-shot{max-width:100%;border-radius:8px;border:1px solid var(--border2)}
.care-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.care-paper{background:#FFFAF3;color:#2A1F1B;border-radius:14px;padding:22px;border:1px solid #E8DCCD;font-family:${ADMIN_FONTS.body}}
.care-paper h2,.care-paper h3{color:#2A1F1B}.care-paper a{color:#B33A26}.care-paper .muted{color:#5C4A42}
.care-paper .sec{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2F6B66;margin:18px 0 6px}
.care-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.care-sect{background:var(--panel);border:1px solid var(--border);border-radius:16px;margin:0 0 12px}
.care-sect>summary{list-style:none;cursor:pointer;padding:14px 18px;display:flex;gap:10px 14px;align-items:center;flex-wrap:wrap;border-radius:16px}
.care-sect>summary::-webkit-details-marker{display:none}
.care-sect>summary::before{content:'';width:8px;height:8px;border-right:2px solid var(--text2);border-bottom:2px solid var(--text2);transform:rotate(-45deg);transition:transform .15s;flex:none}
.care-sect[open]>summary::before{transform:rotate(45deg)}
.care-sect>summary h2{font-size:18px}
.care-sect-body{padding:0 18px 18px}
.care-skel{height:14px;border-radius:6px;background:var(--surface2);animation:carepulse 1.2s infinite}
@keyframes carepulse{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.care-skel{animation:none}}
/* Plan time: task catalog, Quick add work, allowance */
.care-allow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.care-allow>div{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px;min-width:0;overflow-wrap:anywhere}
.care-allow b{display:block;font-family:${ADMIN_FONTS.display};font-size:24px;line-height:1.15}
.care-allow small{color:var(--text2);font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.care-allow .hl{border-color:var(--coral);background:var(--accentBg)}
.care-stepper{display:inline-flex;align-items:center;border:1.5px solid var(--border2);border-radius:999px;overflow:hidden}
.care-stepper button{width:38px;min-height:38px;border:0;background:var(--surface2);color:var(--text);font:inherit;font-size:18px;cursor:pointer}
.care-stepper button:disabled{opacity:.4;cursor:not-allowed}
.care-stepper input{width:56px;min-height:38px;border:0;border-radius:0;text-align:center;background:var(--surface)}
.care-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr));gap:8px}
.care-pick label{display:flex;gap:10px;align-items:flex-start;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer}
.care-pick label.on{border-color:var(--coral);background:var(--accentBg)}
.care-pick label.off{opacity:.65}
.care-line{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px;display:grid;gap:10px;min-width:0;overflow-wrap:anywhere}
.care-grid>*,.care-two>*{min-width:0}
.care .care-fluid{flex:1 1 160px;min-width:0;width:auto}
.care-facts{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px}
.care-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}
.care-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
.care-scroll>table{min-width:400px}
@media (max-width:480px){.care-scroll>table.care-stack{min-width:0}.care-stack thead{display:none}.care-stack tr{display:grid;grid-template-columns:repeat(3,auto);gap:2px 12px;padding:8px 0;border-bottom:1px solid var(--border)}.care-stack td{border:0;padding:0}.care-stack td:first-child{grid-column:1/-1}.care-stack td.n{text-align:left}.care-stack td[data-label]::before{content:attr(data-label);display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text2)}}
.care-calc{font-variant-numeric:tabular-nums}
.care-sum td,.care-sum th{font-variant-numeric:tabular-nums}
.care-sum td.n,.care-sum th.n{text-align:right;white-space:nowrap}
@media (max-width:760px){.care-two{grid-template-columns:1fr}.care-main{padding:14px}.care-hide-sm{display:none}.care-allow{grid-template-columns:1fr 1fr}.care-panel{padding:14px}.care-sect-body{padding:0 12px 14px}.care-sect>summary{padding:12px}}
@media (max-width:420px){.care-allow{grid-template-columns:1fr}.care-allow>div{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}.care-allow b{font-size:22px}.care-sub{padding:12px}.care-btn{white-space:normal;text-align:center}}
`

export async function careApi<T = Record<string, unknown>>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(`/api/care/admin/${path}`, {
    ...init,
    headers: { ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: 'no-store',
  })
  if (res.status === 401) {
    window.dispatchEvent(new Event('admin-session-expired'))
    throw new Error('Your admin session expired. Sign in again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  return data as T
}

export function useLoad<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!path) return
    let live = true
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    careApi<T>(path)
      .then((d) => { if (live) { setData(d); setError(null) } })
      .catch((e) => { if (live) setError(e.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, n, ...deps])
  return { data, error, loading, reload: () => setN((x) => x + 1), setData }
}

export function Badge({ tone = 'info', children }: { tone?: 'ok' | 'warn' | 'bad' | 'info' | 'coral'; children: ReactNode }) {
  return <span className={`care-badge ${tone}`}>{children}</span>
}

export function Field({ label, hint, children, id }: { label: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className="care-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function Loading({ lines = 3 }: { lines?: number }) {
  return (
    <div className="care-grid" role="status" aria-live="polite">
      <span className="care-sr">Loading</span>
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="care-skel" style={{ width: `${90 - i * 15}%` }} />)}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null
  return (
    <div className="care-err" role="alert">
      {error} {onRetry && <button className="care-btn small" onClick={onRetry} style={{ marginLeft: 8 }}>Try again</button>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="care-sub care-muted" style={{ textAlign: 'center', padding: 24 }}>{children}</div>
}

/** Button that runs an async action, shows progress, and reports errors. */
export function Action({ label, run, tone, small, disabled, confirmText, done }: {
  label: string; run: () => Promise<unknown>; tone?: 'primary' | 'danger'; small?: boolean; disabled?: boolean; confirmText?: string; done?: (r: unknown) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  async function go() {
    if (confirmText && !armed) { setArmed(true); return }
    setBusy(true); setErr(null)
    try { const r = await run(); done?.(r) } catch (e) { setErr((e as Error).message) } finally { setBusy(false); setArmed(false) }
  }
  return (
    <span style={{ display: 'inline-grid', gap: 4 }}>
      <button type="button" className={`care-btn ${tone || ''} ${small ? 'small' : ''}`} onClick={go} disabled={busy || disabled} aria-busy={busy}>
        {busy ? 'Working…' : armed ? (confirmText as string) : label}
      </button>
      {armed && !busy && <button type="button" className="care-btn small" onClick={() => setArmed(false)}>Keep as is</button>}
      {err && <span role="alert" style={{ color: 'var(--redText)', fontSize: 13, maxWidth: 420 }}>{err}</span>}
    </span>
  )
}

export const STATUS_TEXT: Record<string, string> = {
  passed: 'Passed', failed: 'Failed', needs_review: 'Needs manual review', could_not_check: 'Could not check', not_applicable: 'Not applicable', not_checked: 'Not checked',
}
export const statusTone = (s: string | null | undefined): 'ok' | 'warn' | 'bad' | 'info' =>
  s === 'passed' ? 'ok' : s === 'failed' ? 'bad' : s === 'needs_review' ? 'warn' : 'info'

export const BILLING_TEXT: Record<string, [string, 'ok' | 'warn' | 'bad' | 'info']> = {
  not_started: ['No subscription yet', 'info'],
  active: ['Paid, active', 'ok'],
  canceling: ['Canceling at period end', 'warn'],
  attention: ['Payment failed', 'bad'],
  past_due: ['Past due', 'bad'],
  unpaid: ['Unpaid', 'bad'],
  awaiting_payment: ['Awaiting first payment', 'warn'],
  expired: ['Checkout expired', 'info'],
  canceled: ['Canceled', 'info'],
  paused: ['Paused in Stripe', 'warn'],
  refunded: ['Refund recorded', 'warn'],
  disputed: ['Disputed', 'bad'],
}

export function BillingBadge({ state }: { state: string }) {
  const [label, tone] = BILLING_TEXT[state] || [state, 'info']
  return <Badge tone={tone}>{label}</Badge>
}

/** Work status, kept separate from billing on purpose: paid is not the same as reviewed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function workStatus(c: Record<string, any>, report?: { status: string } | null): [string, 'ok' | 'warn' | 'bad' | 'info' | 'coral'] {
  if (c.completed_at) return ['Report sent', 'ok']
  if (c.hold_reason === 'enrollment') return ['Waiting for setup confirmation', 'warn']
  const overdue = new Date(c.review_due_at) < new Date()
  if (c.scan_state === 'failed') return ['Check failed: retry needed', 'bad']
  if (c.scan_state === 'queued') return ['Check queued', 'info']
  if (c.scan_state === 'running') return ['Check running', 'info']
  if (report?.status === 'approved') return ['Approved, not sent', 'coral']
  if (report?.status === 'ready') return [overdue ? 'Overdue: ready for approval' : 'Ready for approval', overdue ? 'bad' : 'coral']
  if (c.scan_state === 'done' || c.scan_state === 'partial') return [overdue ? 'Overdue: manual review' : 'Manual review due', overdue ? 'bad' : 'warn']
  if (c.scan_state === 'canceled') return ['Check canceled', 'warn']
  return ['Scheduled', 'info']
}

export function fmt(d: string | null | undefined, tz: string, withTime = true) {
  if (!d) return 'Not set'
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}) }).format(new Date(d))
}
