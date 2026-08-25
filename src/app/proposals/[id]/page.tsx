'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

type LineItem = { description: string; price: number }
type Proposal = {
  id: string
  client_name: string
  client_email: string
  client_business: string | null
  project_title: string
  project_type: string
  understood: string | null
  line_items: LineItem[]
  total: number
  deposit_pct: number
  out_of_scope: string | null
  timeline: string | null
  next_steps: string | null
  message: string | null
  status: string
}

export default function ProposalPage() {
  const params = useParams()
  const id = params.id as string
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [responding, setResponding] = useState(false)
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)

  useEffect(() => {
    fetch(`/api/proposals/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setProposal(data)
      })
      .catch(() => setError('Could not load proposal.'))
      .finally(() => setLoading(false))
  }, [id])

  async function respond(action: 'accepted' | 'declined') {
    setResponding(true)
    try {
      const res = await fetch(`/api/proposals/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, declineReason: action === 'declined' ? declineReason : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(action)
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    }
    setResponding(false)
  }

  const deposit = proposal ? proposal.total * (proposal.deposit_pct / 100) : 0
  const balance = proposal ? proposal.total - deposit : 0

  if (loading) return <Shell><div className="loading">Loading your proposal...</div></Shell>
  if (error) return <Shell><div className="error-state">{error}</div></Shell>
  if (!proposal) return null

  if (proposal.status === 'accepted' || done === 'accepted') return (
    <Shell>
      <div className="done-state">
        <div className="done-mark">✦</div>
        <h1 className="done-title">Proposal accepted.</h1>
        <p className="done-body">You will receive a Statement of Work shortly for your review. Once you accept the SOW, the contract will follow for your signature.</p>
      </div>
    </Shell>
  )

  if (proposal.status === 'declined' || done === 'declined') return (
    <Shell>
      <div className="done-state">
        <div className="done-mark" style={{color:'#8B7D73'}}>✦</div>
        <h1 className="done-title" style={{color:'#8B7D73'}}>Proposal declined.</h1>
        <p className="done-body">Thank you for letting me know. Feel free to reach out if anything changes or if you would like to revisit the scope.</p>
      </div>
    </Shell>
  )

  return (
    <Shell>
      <div className="top-bar">
        <div className="logo">Alante Velez</div>
        <div className="logo-sub">Project Proposal</div>
      </div>

      {proposal.message && (
        <div className="card" style={{marginBottom:16}}>
          <p className="body-text" style={{whiteSpace:'pre-wrap'}}>{proposal.message}</p>
        </div>
      )}

      <div className="card">
        <div className="eyebrow">Prepared for</div>
        <div className="card-title">{proposal.client_name}</div>
        {proposal.client_business && <div className="card-sub">{proposal.client_business}</div>}
      </div>

      <div className="card">
        <div className="eyebrow">Project</div>
        <div className="card-title">{proposal.project_title}</div>
        <div className="card-sub">{proposal.project_type}</div>
      </div>

      {proposal.understood && (
        <div className="card">
          <div className="eyebrow">What I understood</div>
          <p className="body-text">{proposal.understood}</p>
        </div>
      )}

      {proposal.line_items && proposal.line_items.length > 0 && (
        <div className="card">
          <div className="eyebrow">Investment breakdown</div>
          <div className="line-items">
            {proposal.line_items.map((item, i) => (
              <div key={i} className="line-item">
                <span className="line-desc">{item.description}</span>
                <span className="line-price">${Number(item.price).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="total-row">
            <span>Total</span>
            <span className="total-amount">${proposal.total.toLocaleString()}</span>
          </div>
          <div className="deposit-note">
            Deposit ({proposal.deposit_pct}% due to begin): <strong>${deposit.toLocaleString()}</strong><br/>
            Remaining balance paid across project milestones.<br/>
            Exact milestone schedule outlined in the Statement of Work.<br/>
            Change orders billed at $65/hr.
          </div>
        </div>
      )}

      {proposal.out_of_scope && (
        <div className="card">
          <div className="eyebrow">What is not included</div>
          <p className="body-text">{proposal.out_of_scope}</p>
        </div>
      )}

      {proposal.timeline && (
        <div className="card">
          <div className="eyebrow">Timeline</div>
          <p className="body-text">{proposal.timeline}</p>
        </div>
      )}

      {proposal.next_steps && (
        <div className="card accent-card">
          <div className="eyebrow" style={{color:'rgba(250,243,232,0.6)'}}>Next steps</div>
          <p className="body-text" style={{color:'#FAF3E8'}}>{proposal.next_steps}</p>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {showDecline && (
        <div className="card" style={{marginTop:8}}>
          <div className="eyebrow">Reason for declining (optional)</div>
          <textarea
            className="decline-input"
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            placeholder="Let me know what did not work so I can adjust..."
            rows={3}
          />
          <div className="action-row">
            <button className="btn-ghost" onClick={() => setShowDecline(false)}>Cancel</button>
            <button className="btn-decline" onClick={() => respond('declined')} disabled={responding}>
              {responding ? 'Submitting...' : 'Confirm Decline'}
            </button>
          </div>
        </div>
      )}

      {!showDecline && (
        <div className="action-row" style={{marginTop:24}}>
          <button className="btn-ghost" onClick={() => setShowDecline(true)}>Decline</button>
          <button className="btn-accept" onClick={() => respond('accepted')} disabled={responding}>
            {responding ? 'Submitting...' : 'Accept Proposal'}
          </button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FAF3E8; color: #2A2420; font-family: 'DM Sans', sans-serif; font-weight: 300; min-height: 100vh; }
        .shell { max-width: 640px; margin: 0 auto; padding: 48px 24px 100px; }
        .top-bar { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid rgba(169,104,96,0.2); }
        .logo { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #2A2420; margin-bottom: 2px; }
        .logo-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: #8B7D73; letter-spacing: 0.12em; text-transform: uppercase; }
        .card { background: white; border: 1px solid rgba(169,104,96,0.2); border-radius: 8px; padding: 24px; margin-bottom: 12px; }
        .accent-card { background: #A96860; border-color: #A96860; }
        .eyebrow { font-family: 'DM Mono', monospace; font-size: 10px; color: #A96860; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px; font-weight: 500; }
        .card-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #2A2420; margin-bottom: 2px; }
        .card-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: #8B7D73; letter-spacing: 0.06em; }
        .body-text { font-size: 14px; line-height: 1.75; color: #3D3630; }
        .line-items { display: flex; flex-direction: column; gap: 0; margin-bottom: 12px; }
        .line-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(169,104,96,0.1); }
        .line-desc { font-size: 14px; color: #2A2420; }
        .line-price { font-size: 14px; color: #2A2420; font-weight: 500; white-space: nowrap; margin-left: 16px; }
        .total-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0 12px; border-top: 2px solid rgba(169,104,96,0.2); margin-top: 4px; }
        .total-row span { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: #2A2420; }
        .total-amount { color: #A96860; font-size: 22px; }
        .deposit-note { font-family: 'DM Mono', monospace; font-size: 11px; color: #8B7D73; line-height: 1.8; }
        .deposit-note strong { color: #2A2420; }
        .action-row { display: flex; gap: 12px; justify-content: flex-end; align-items: center; }
        .btn-accept { background: #A96860; border: none; color: #FAF3E8; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 32px; cursor: pointer; border-radius: 4px; transition: background 0.2s, transform 0.15s; }
        .btn-accept:hover:not(:disabled) { background: #C18078; transform: translateY(-1px); }
        .btn-accept:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-decline { background: #2A2420; border: none; color: #FAF3E8; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 32px; cursor: pointer; border-radius: 4px; transition: opacity 0.2s; }
        .btn-decline:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { background: none; border: 1px solid rgba(169,104,96,0.3); color: #8B7D73; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 24px; cursor: pointer; border-radius: 4px; transition: border-color 0.2s, color 0.2s; }
        .btn-ghost:hover { border-color: #A96860; color: #A96860; }
        .decline-input { width: 100%; background: #FAF3E8; border: 1px solid rgba(169,104,96,0.2); color: #2A2420; font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 12px; border-radius: 6px; outline: none; resize: vertical; margin: 12px 0 16px; line-height: 1.6; }
        .done-state { text-align: center; padding: 80px 0; }
        .done-mark { font-family: 'Playfair Display', serif; font-size: 48px; color: #A96860; margin-bottom: 24px; display: block; }
        .done-title { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #2A2420; margin-bottom: 16px; }
        .done-body { font-size: 15px; color: #8B7D73; line-height: 1.7; max-width: 420px; margin: 0 auto; }
        .loading { text-align: center; padding: 80px 0; font-family: 'DM Mono', monospace; font-size: 12px; color: #8B7D73; letter-spacing: 0.1em; text-transform: uppercase; }
        .error-state { text-align: center; padding: 80px 0; font-size: 14px; color: #8B7D73; }
        .error-msg { font-family: 'DM Mono', monospace; font-size: 11px; color: #b04a4a; margin-top: 8px; text-align: right; }
      `}</style>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>
}