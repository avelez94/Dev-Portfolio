'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/admin'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      } else {
        setError('Incorrect password')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="label">Password</label>
      <input
        className="input"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Enter admin password"
        autoFocus
      />
      <button className="btn" type="submit" disabled={loading || !password}>
        {loading ? 'Checking...' : 'Enter Dashboard'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  )
}

export default function AdminLogin() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,600&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #18130F; color: #F0E8DC; font-family: 'DM Sans', sans-serif; font-weight: 300; }
        .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .card { background: #1E1812; border: 1px solid rgba(240,220,200,0.1); border-radius: 20px; padding: 48px 40px; width: 100%; max-width: 380px; }
        .logo { width: 44px; height: 44px; background: #C4704A; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; font-style: italic; font-size: 18px; color: white; margin: 0 auto 28px; }
        .title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; text-align: center; margin-bottom: 6px; color: #F0E8DC; }
        .subtitle { font-size: 12px; color: #6A5848; text-align: center; margin-bottom: 32px; }
        .label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: #6A5848; margin-bottom: 6px; display: block; }
        .input { width: 100%; background: #251E16; border: 1px solid rgba(240,220,200,0.1); color: #F0E8DC; font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 12px 14px; border-radius: 10px; outline: none; transition: border-color 0.2s; margin-bottom: 20px; }
        .input:focus { border-color: #C4704A; }
        .btn { width: 100%; background: #C4704A; border: none; color: white; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 13px; border-radius: 10px; cursor: pointer; transition: background 0.2s, transform 0.15s; }
        .btn:hover { background: #d4855f; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .error { font-size: 12px; color: #C44A4A; text-align: center; margin-top: 14px; }
      `}</style>
      <div className="wrap">
        <div className="card">
          <div className="logo">A</div>
          <div className="title">Admin Access</div>
          <div className="subtitle">Enter your password to continue</div>
          <Suspense fallback={<div style={{color:'#6A5848',fontSize:12,textAlign:'center'}}>Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </>
  )
}