'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

type Contract = {
  id: string
  client_name: string
  client_email: string
  client_business: string | null
  project_title: string
  project_type: string
  start_date: string | null
  delivery_date: string | null
  total_fee: number
  deposit: number
  balance: number
  kill_fee_pct: number
  payment_method: string
  line_items: any[]
  status: string
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #FAF3E8 !important; color: #2A2420; font-family: 'DM Sans', sans-serif; font-weight: 300; min-height: 100vh; }
  .shell { max-width: 680px; margin: 0 auto; padding: 48px 24px 100px; }
  .top-bar { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid rgba(169,104,96,0.2); }
  .logo { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #2A2420; margin-bottom: 2px; }
  .logo-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: #8B7D73; letter-spacing: 0.12em; text-transform: uppercase; }
  .card { background: white; border: 1px solid rgba(169,104,96,0.2); border-radius: 8px; padding: 24px; margin-bottom: 12px; }
  .eyebrow { font-family: 'DM Mono', monospace; font-size: 10px; color: #A96860; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px; font-weight: 500; }
  .party-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .party-label { font-family: 'DM Mono', monospace; font-size: 10px; color: #8B7D73; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
  .party-name { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: #2A2420; margin-bottom: 2px; }
  .party-sub { font-size: 12px; color: #8B7D73; }
  .card-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #2A2420; margin-bottom: 4px; }
  .card-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: #8B7D73; letter-spacing: 0.06em; margin-bottom: 4px; }
  .payment-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(169,104,96,0.1); }
  .payment-row:last-child { border-bottom: none; }
  .payment-label { font-size: 13px; color: #3D3630; }
  .payment-value { font-family: 'DM Mono', monospace; font-size: 13px; color: #2A2420; font-weight: 500; }
  .payment-value.accent { color: #A96860; font-size: 15px; }
  .clauses { display: flex; flex-direction: column; gap: 16px; }
  .clause-title { font-family: 'DM Mono', monospace; font-size: 11px; color: #A96860; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; font-weight: 500; }
  .clause-body { font-size: 13px; line-height: 1.7; color: #3D3630; }
  .sig-label { font-family: 'DM Mono', monospace; font-size: 10px; color: #8B7D73; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; }
  .canvas-wrap { position: relative; border: 1.5px solid rgba(169,104,96,0.3); border-radius: 6px; overflow: hidden; background: #FAFAFA; margin-bottom: 8px; cursor: crosshair; touch-action: none; }
  .sig-canvas { display: block; width: 100%; height: 160px; }
  .sig-placeholder { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-family: 'Playfair Display', serif; font-style: italic; font-size: 18px; color: rgba(169,104,96,0.25); pointer-events: none; white-space: nowrap; }
  .btn-clear { background: none; border: none; font-family: 'DM Mono', monospace; font-size: 11px; color: #8B7D73; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; padding: 0; transition: color 0.2s; }
  .btn-clear:hover { color: #A96860; }
  .name-input { width: 100%; background: #FAF3E8; border: 1px solid rgba(169,104,96,0.2); color: #2A2420; font-family: 'DM Sans', sans-serif; font-size: 15px; padding: 12px 14px; border-radius: 6px; outline: none; transition: border-color 0.2s; margin-top: 4px; }
  .name-input:focus { border-color: #A96860; }
  .legal-note { font-size: 12px; color: #8B7D73; line-height: 1.6; margin-top: 14px; }
  .action-row { display: flex; justify-content: flex-end; margin-top: 20px; }
  .btn-sign { background: #A96860; border: none; color: #FAF3E8; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 40px; cursor: pointer; border-radius: 4px; transition: background 0.2s, transform 0.15s; }
  .btn-sign:hover:not(:disabled) { background: #C18078; transform: translateY(-1px); }
  .btn-sign:disabled { opacity: 0.4; cursor: not-allowed; }
  .done-state { text-align: center; padding: 80px 0; }
  .done-mark { font-family: 'Playfair Display', serif; font-size: 48px; color: #A96860; margin-bottom: 24px; display: block; }
  .done-title { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #2A2420; margin-bottom: 16px; }
  .done-body { font-size: 15px; color: #8B7D73; line-height: 1.7; max-width: 420px; margin: 0 auto; }
  .loading { text-align: center; padding: 80px 0; font-family: 'DM Mono', monospace; font-size: 12px; color: #8B7D73; letter-spacing: 0.1em; text-transform: uppercase; }
  .error-state { text-align: center; padding: 80px 0; font-size: 14px; color: #8B7D73; }
  .error-msg { font-family: 'DM Mono', monospace; font-size: 11px; color: #b04a4a; margin-top: 8px; text-align: right; }
`

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{STYLES}</style>
      <div style={{background:'#FAF3E8', minHeight:'100vh'}}>
        <div className="shell">{children}</div>
      </div>
    </>
  )
}

export default function ContractPage() {
  const params = useParams()
  const id = params.id as string
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState(false)
  const [done, setDone] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSig, setHasSig] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    fetch(`/api/contracts/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setContract(data)
      })
      .catch(() => setError('Could not load contract.'))
      .finally(() => setLoading(false))
  }, [id])

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    lastPos.current = getPos(e, canvas)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !lastPos.current) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#2A2420'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
    setHasSig(true)
  }

  function endDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    setIsDrawing(false)
    lastPos.current = null
  }

  function clearSig() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  async function signContract() {
    if (!hasSig || !signerName.trim()) return
    setSigning(true)
    setError('')
    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('No canvas')
      const signatureImage = canvas.toDataURL('image/png')
      const res = await fetch(`/api/contracts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureImage, signerName: signerName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    }
    setSigning(false)
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  if (loading) return <Shell><div className="loading">Loading your contract...</div></Shell>
  if (error && !contract) return <Shell><div className="error-state">{error}</div></Shell>
  if (!contract) return null

  if (contract.status === 'signed' || done) return (
    <Shell>
      <div className="done-state">
        <div className="done-mark">✦</div>
        <h1 className="done-title">Contract signed.</h1>
        <p className="done-body">You will receive a copy of the signed contract by email. Your deposit invoice will follow shortly to officially kick off the project.</p>
      </div>
    </Shell>
  )

  const clauses = [
    { title: '1. Services', body: `Alante Velez agrees to design and develop the project described above. Work outside the agreed scope requires written approval and will be billed at $65/hr.` },
    { title: '2. Payment', body: `Total fee: $${contract.total_fee.toLocaleString()}. Deposit of $${contract.deposit.toLocaleString()} is due before work begins. Balance of $${contract.balance.toLocaleString()} is due upon final delivery. Payment via ${contract.payment_method}. Invoices are due within 7 days. Late payments accrue 1.5% interest per month after 14 days.` },
    { title: '3. Kill fee', body: `If Client cancels after work has begun, a kill fee of ${contract.kill_fee_pct}% of the total project fee ($${Math.round(contract.total_fee * contract.kill_fee_pct / 100).toLocaleString()}) is due immediately, in addition to payment for all work completed to date.` },
    { title: '4. Intellectual property', body: `Full ownership of all deliverables transfers to Client upon receipt of final payment in full. Until final payment is received, all work remains the property of Alante Velez. Alante Velez retains the right to display completed work in portfolio and case studies.` },
    { title: '5. Revisions', body: `Project includes 2 rounds of revisions. One revision round equals one consolidated list of feedback submitted at one time, not ongoing back-and-forth. Additional revisions are billed at $65/hr and require written approval before proceeding.` },
    { title: '6. Client responsibilities', body: `Client agrees to provide all required content, assets, credentials, and feedback in a timely manner. Delays caused by Client may result in timeline adjustments. Alante Velez is not responsible for delays caused by third-party services or Client inaction.` },
    { title: '7. Confidentiality', body: `Both parties agree to keep each other's proprietary information, business processes, and client data confidential during and after the project. This obligation survives termination of this agreement.` },
    { title: '8. Warranties', body: `Alante Velez warrants that all work will be original, will not infringe third-party rights, and will be free of known defects for 30 days following final delivery. Client is responsible for all content provided including text, images, and media.` },
    { title: '9. Limitation of liability', body: `Alante Velez's total liability under this agreement is limited to the total amount paid by Client. Alante Velez is not liable for indirect, incidental, or consequential damages including loss of revenue, data, or business opportunity.` },
    { title: '10. Dispute resolution', body: `The parties agree to attempt to resolve any disputes informally before pursuing legal action. If informal resolution fails, disputes will be resolved through binding arbitration in the State of Indiana.` },
    { title: '11. Governing law', body: `This agreement is governed by the laws of the State of Indiana. Any legal action must be brought in courts located in Indiana.` },
    { title: '12. Entire agreement', body: `This contract, together with the accepted Proposal and Statement of Work, constitutes the entire agreement between the parties and supersedes all prior discussions, representations, or agreements.` },
  ]

  return (
    <Shell>
      <div className="top-bar">
        <div className="logo">Alante Velez</div>
        <div className="logo-sub">Freelance Web Development Agreement</div>
      </div>

      <div className="card">
        <div className="eyebrow">Parties</div>
        <div className="party-row">
          <div>
            <div className="party-label">Freelancer</div>
            <div className="party-name">Alante Velez</div>
            <div className="party-sub">alante@alantevelez.com</div>
            <div className="party-sub">alantevelez.com</div>
          </div>
          <div>
            <div className="party-label">Client</div>
            <div className="party-name">{contract.client_name}</div>
            <div className="party-sub">{contract.client_email}</div>
            {contract.client_business && <div className="party-sub">{contract.client_business}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Project</div>
        <div className="card-title">{contract.project_title}</div>
        <div className="card-sub">{contract.project_type}</div>
        {contract.start_date && <div className="card-sub">Start: {formatDate(contract.start_date)}</div>}
        {contract.delivery_date && <div className="card-sub">Est. delivery: {formatDate(contract.delivery_date)}</div>}
      </div>

      <div className="card">
        <div className="eyebrow">Payment summary</div>
        <div className="payment-row">
          <span className="payment-label">Total project fee</span>
          <span className="payment-value accent">${contract.total_fee.toLocaleString()}</span>
        </div>
        <div className="payment-row">
          <span className="payment-label">Deposit due to begin</span>
          <span className="payment-value">${contract.deposit.toLocaleString()}</span>
        </div>
        <div className="payment-row">
          <span className="payment-label">Balance due on delivery</span>
          <span className="payment-value">${contract.balance.toLocaleString()}</span>
        </div>
        <div className="payment-row">
          <span className="payment-label">Payment method</span>
          <span className="payment-value">{contract.payment_method}</span>
        </div>
        <div className="payment-row">
          <span className="payment-label">Kill fee if cancelled</span>
          <span className="payment-value">{contract.kill_fee_pct}% (${Math.round(contract.total_fee * contract.kill_fee_pct / 100).toLocaleString()})</span>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Terms and conditions</div>
        <div className="clauses">
          {clauses.map((c, i) => (
            <div key={i}>
              <div className="clause-title">{c.title}</div>
              <div className="clause-body">{c.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Your signature</div>
        <p style={{fontSize:14,lineHeight:1.7,color:'#3D3630',marginBottom:20}}>By signing below you confirm you have read and agree to all terms above. This electronic signature is legally binding under the Electronic Signatures in Global and National Commerce Act (ESIGN Act).</p>

        <div className="sig-label">Draw your signature</div>
        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="sig-canvas"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {!hasSig && <div className="sig-placeholder">Sign here</div>}
        </div>
        <button className="btn-clear" onClick={clearSig}>Clear signature</button>

        <div className="sig-label" style={{marginTop:20}}>Type your full legal name</div>
        <input
          className="name-input"
          type="text"
          value={signerName}
          onChange={e => setSignerName(e.target.value)}
          placeholder={contract.client_name}
        />

        <p className="legal-note">
          By clicking Sign and Accept, you confirm that: (1) you have read and agree to all terms, (2) you are authorized to enter into this agreement, and (3) your electronic signature has the same legal effect as a handwritten signature.
        </p>
        <p className="legal-note" style={{marginTop:8}}>
          Signed: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        {error && <div className="error-msg">{error}</div>}

        <div className="action-row">
          <button
            className="btn-sign"
            onClick={signContract}
            disabled={!hasSig || !signerName.trim() || signing}
          >
            {signing ? 'Signing...' : 'Sign and Accept'}
          </button>
        </div>
      </div>
    </Shell>
  )
}