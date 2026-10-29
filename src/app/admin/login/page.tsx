'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ADMIN_CORAL, ADMIN_FONTS, ADMIN_INK, ADMIN_THEMES } from '@/lib/admin-theme'

const d = ADMIN_THEMES.teal

/** Only return to pages inside the admin area. */
function safeFrom(v: string | null): string {
  return v && v.startsWith('/admin') && !v.startsWith('//') && !v.startsWith('/admin/login') ? v : '/admin'
}

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = safeFrom(searchParams.get('from'))
  const notice = searchParams.get('expired')
    ? 'Your session ended. Sign in again to pick up where you left off.'
    : searchParams.get('signedout')
      ? 'You’re signed out.'
      : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) {
      setError('Enter the admin password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.push(from)
        router.refresh()
        return
      }
      setError(
        res.status === 401
          ? 'That password isn’t right. Try again.'
          : res.status === 429
            ? 'Too many attempts. Wait a few minutes, then try again.'
            : 'Sign in isn’t available right now. Check the server configuration and try again.'
      )
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {notice && !error && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <label className="label" htmlFor="admin-password">
        Password
      </label>
      <input
        id="admin-password"
        className="input"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          if (error) setError('')
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'login-error' : undefined}
        autoFocus
      />
      {error && (
        <p className="error" id="login-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? 'Checking…' : 'Sign In'}
      </button>
    </form>
  )
}

export default function AdminLogin() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${d.bg}; }
        body { color: ${d.text}; font-family: ${ADMIN_FONTS.body}; font-size: 15px; -webkit-font-smoothing: antialiased; }
        .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background:
          radial-gradient(circle at 85% 10%, rgba(255,107,79,0.12), transparent 40%),
          radial-gradient(circle at 10% 90%, rgba(47,107,102,0.35), transparent 45%), ${d.bg}; }
        .card { background: ${d.white}; border: 1px solid ${d.border}; border-radius: 26px; padding: 40px 36px 36px; width: 100%; max-width: 420px; box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
        .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .mark { width: 46px; height: 46px; border-radius: 15px; background: ${ADMIN_CORAL}; color: ${ADMIN_INK}; border: 2px solid ${d.text}; box-shadow: 3px 3px 0 ${d.text}; display: flex; align-items: center; justify-content: center; font-family: ${ADMIN_FONTS.display}; font-weight: 700; font-size: 17px; }
        .brand-name { font-family: ${ADMIN_FONTS.display}; font-weight: 600; font-size: 18px; }
        .pill { display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; background: ${d.accentBg}; color: ${d.accent}; }
        h1 { font-family: ${ADMIN_FONTS.display}; font-variation-settings: 'SOFT' 100; font-weight: 600; font-size: 30px; line-height: 1.15; margin-bottom: 6px; }
        h1 em { color: ${d.accent}; }
        .sub { color: ${d.text2}; margin-bottom: 26px; }
        .label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${d.text2}; margin-bottom: 8px; }
        .input { width: 100%; min-height: 48px; background: ${d.surface}; border: 1.5px solid ${d.border2}; color: ${d.text}; font: inherit; padding: 12px 14px; border-radius: 12px; outline: none; }
        .input:focus { border-color: ${d.accent}; }
        .input:focus-visible { outline: 2px solid ${d.accent}; outline-offset: 1px; }
        .input[aria-invalid=true] { border-color: ${d.redText}; }
        .btn { width: 100%; min-height: 48px; margin-top: 18px; background: ${ADMIN_CORAL}; color: ${ADMIN_INK}; border: 2px solid ${ADMIN_CORAL}; font: inherit; font-weight: 700; border-radius: 999px; cursor: pointer; transition: background .15s; }
        .btn:hover:not(:disabled) { background: #FF8467; border-color: #FF8467; }
        .btn:focus-visible { outline: 3px solid ${d.text}; outline-offset: 3px; }
        .btn:disabled { opacity: 0.55; cursor: progress; }
        .error { margin-top: 10px; color: ${d.redText}; font-size: 14px; }
        .notice { margin-bottom: 18px; padding: 10px 14px; border-radius: 12px; background: ${d.surface}; border: 1px solid ${d.border2}; color: ${d.text}; font-size: 14px; }
        .fine { margin-top: 22px; font-size: 13px; color: ${d.text3}; text-align: center; }
        .fine a { color: ${d.text2}; }
        @media (max-width: 420px) { .card { padding: 30px 22px 26px; border-radius: 22px; } h1 { font-size: 26px; } }
        @media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
      `}</style>
      <main className="wrap">
        <div className="card">
          <div className="brand">
            <div className="mark" aria-hidden="true">AV</div>
            <div>
              <div className="brand-name">Alante Velez</div>
              <span className="pill">Admin</span>
            </div>
          </div>
          <h1>
            Welcome <em>back.</em>
          </h1>
          <p className="sub">Sign in to manage leads, calls, documents, and invoices.</p>
          <Suspense fallback={<p className="sub" role="status">Loading…</p>}>
            <LoginForm />
          </Suspense>
          <p className="fine">
            Not the admin? <Link href="/">Go to alantevelez.com</Link>
          </p>
        </div>
      </main>
    </>
  )
}
