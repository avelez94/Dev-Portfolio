'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function BookingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const intakeId = searchParams.get('ref')

  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    if (!intakeId) return
    fetchSlots()
    fetchIntake()
  }, [intakeId, currentMonth])

  async function fetchIntake() {
    try {
      const res = await fetch(`/api/intake/${intakeId}`)
      const data = await res.json()
      if (data.name) setClientName(data.name.split(' ')[0])
    } catch {}
  }

  async function fetchSlots() {
    setLoading(true)
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

    try {
      const res = await fetch(
        `/api/availability?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`
      )
      const data = await res.json()
      setSlots(data.slots || [])
    } catch {
      setError('Could not load available times. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmBooking() {
    if (!selectedSlot || !intakeId) return
    setConfirming(true)
    setError('')

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId, scheduledAt: selectedSlot }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setConfirmed(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  // Group slots by date
  const slotsByDate = slots.reduce((acc: Record<string, string[]>, slot) => {
    const date = slot.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(slot)
    return acc
  }, {})

  // Get days in current month view
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const today = new Date()
  const minDate = new Date(today.getTime() + 48 * 60 * 60 * 1000)

  const selectedDate = selectedSlot ? selectedSlot.split('T')[0] : null
  const timeSlotsForSelected = selectedDate ? (slotsByDate[selectedDate] || []) : []

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  function formatConfirmedDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (!intakeId) {
    return (
      <div className="shell">
        <div className="error-state">
          <p>Invalid booking link. Please go back and fill out the intake form first.</p>
          <a href="/intake">Go to intake form</a>
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <div className="top-bar">
        <a href="/" className="logo-text">Alante Velez</a>
        {!confirmed && <span className="step-counter">Schedule your call</span>}
      </div>

      {confirmed ? (
        <div className="confirmed">
          <div className="confirmed-mark">✦</div>
          <h1 className="confirmed-title">
            {clientName ? `You're all set, ${clientName}.` : "You're all set."}
          </h1>
          <div className="confirmed-divider" />
          <div className="confirmed-detail">
            <div className="detail-label">Your call is booked for</div>
            <div className="detail-value">{formatConfirmedDate(selectedSlot!)}</div>
            <div className="detail-value time">{formatTime(selectedSlot!)}</div>
          </div>
          <p className="confirmed-body">
            Check your email for a confirmation with your Zoom link and everything you need for the call. I will have reviewed your project details before we speak.
          </p>
          <a href="/" className="btn-home">Back to portfolio</a>
        </div>
      ) : (
        <>
          <div className="step-tag">Step 2 of 2</div>
          <h1 className="page-title">
            Schedule your<br /><em>discovery call.</em>
          </h1>
          <p className="page-sub">
            Pick a time that works for you. All calls are 20 minutes over Zoom.
            Available times start 48 hours from now.
          </p>

          <div className="calendar-wrap">
            <div className="cal-header">
              <button
                className="cal-nav"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                disabled={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span className="cal-month">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
              <button
                className="cal-nav"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="cal-days-header">
              {DAYS.map(d => <span key={d} className="cal-day-label">{d}</span>)}
            </div>

            <div className="cal-grid">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="cal-cell empty" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const hasSlots = !!slotsByDate[dateStr]
                const isSelected = selectedDate === dateStr
                const isPast = new Date(dateStr) < minDate

                return (
                  <div
                    key={day}
                    className={`cal-cell ${hasSlots ? 'has-slots' : ''} ${isSelected ? 'selected' : ''} ${isPast || !hasSlots ? 'disabled' : ''}`}
                    onClick={() => {
                      if (hasSlots && !isPast) {
                        setSelectedSlot(null)
                        setSelectedSlot(dateStr + 'T00:00:00.000Z')
                      }
                    }}
                  >
                    <span>{day}</span>
                    {hasSlots && <div className="slot-dot" />}
                  </div>
                )
              })}
            </div>
          </div>

          {selectedDate && slotsByDate[selectedDate] && (
            <div className="time-slots">
              <div className="time-slots-label">
                Available times for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="time-grid">
                {slotsByDate[selectedDate].map(slot => (
                  <button
                    key={slot}
                    className={`time-slot ${selectedSlot === slot ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {formatTime(slot)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          <div className="nav">
            <span />
            <button
              className="btn-confirm"
              onClick={confirmBooking}
              disabled={!selectedSlot || selectedSlot.endsWith('T00:00:00.000Z') || confirming}
            >
              {confirming ? 'Confirming...' : 'Confirm Booking'}
              {!confirming && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --terracotta: #C4704A; --terracotta-light: #d4855f;
          --cream: #FAF6F0; --espresso: #2C1A0E;
          --espresso-mid: #3d2a1a; --espresso-hover: #4a3220;
          --muted: #8a7060; --border: rgba(196,112,74,0.2);
          --serif: 'Playfair Display', Georgia, serif;
          --mono: 'DM Mono', monospace;
          --sans: 'DM Sans', sans-serif;
        }
        body { background: var(--espresso); color: var(--cream); font-family: var(--sans); font-weight: 300; min-height: 100vh; }
        body::before { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E"); opacity: 0.03; pointer-events: none; z-index: 0; }
        .shell { width: 100%; max-width: 720px; margin: 0 auto; padding: 48px 16px 100px; position: relative; z-index: 1; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 52px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
        .logo-text { font-family: var(--serif); font-size: 1.1rem; color: var(--cream); text-decoration: none; }
        .step-counter { font-family: var(--mono); font-size: 0.68rem; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
        .step-tag { display: inline-flex; align-items: center; gap: 10px; font-family: var(--mono); font-size: 0.68rem; color: var(--terracotta); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 16px; }
        .step-tag::before { content: ''; width: 24px; height: 1px; background: var(--terracotta); }
        .page-title { font-family: var(--serif); font-size: clamp(32px,6vw,52px); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 16px; }
        .page-title em { font-style: italic; color: var(--terracotta); }
        .page-sub { font-size: 0.9rem; color: var(--muted); line-height: 1.65; margin-bottom: 40px; max-width: 480px; }
        .calendar-wrap { background: var(--espresso-mid); padding: 28px; margin-bottom: 32px; }
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .cal-month { font-family: var(--serif); font-size: 1.1rem; font-weight: 700; color: var(--cream); }
        .cal-nav { background: none; border: 1px solid var(--border); color: var(--muted); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
        .cal-nav:hover:not(:disabled) { border-color: var(--terracotta); color: var(--cream); }
        .cal-nav:disabled { opacity: 0.3; cursor: not-allowed; }
        .cal-days-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px; }
        .cal-day-label { font-family: var(--mono); font-size: 0.62rem; color: var(--muted); text-align: center; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 0; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.85rem; color: var(--muted); position: relative; border: 1px solid transparent; transition: all 0.15s; }
        .cal-cell.empty { border-color: transparent; }
        .cal-cell.disabled { opacity: 0.3; cursor: not-allowed; }
        .cal-cell.has-slots { color: var(--cream); cursor: pointer; border-color: var(--border); }
        .cal-cell.has-slots:hover { border-color: var(--terracotta); background: var(--espresso-hover); }
        .cal-cell.selected { border-color: var(--terracotta); background: var(--espresso-hover); color: var(--cream); }
        .slot-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--terracotta); position: absolute; bottom: 6px; }
        .time-slots { margin-bottom: 32px; }
        .time-slots-label { font-family: var(--mono); font-size: 0.68rem; color: var(--terracotta); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .time-slots-label::before { content: ''; width: 20px; height: 1px; background: var(--terracotta); }
        .time-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
        .time-slot { background: var(--espresso-mid); border: 1px solid var(--border); color: var(--cream); font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.06em; padding: 12px 16px; cursor: pointer; transition: all 0.15s; text-align: center; }
        .time-slot:hover { border-color: var(--terracotta); background: var(--espresso-hover); }
        .time-slot.selected { border-color: var(--terracotta); background: var(--terracotta); color: var(--cream); }
        .nav { display: flex; justify-content: flex-end; margin-top: 32px; padding-top: 28px; border-top: 1px solid var(--border); }
        .btn-confirm { display: inline-flex; align-items: center; gap: 14px; background: var(--terracotta); border: none; color: var(--cream); font-family: var(--mono); font-size: 0.75rem; font-weight: 400; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 28px; cursor: pointer; transition: background 0.25s, transform 0.2s; }
        .btn-confirm:hover:not(:disabled) { background: var(--terracotta-light); transform: translateY(-2px); }
        .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
        .error-msg { font-family: var(--mono); font-size: 0.7rem; color: #e07070; margin-top: 12px; }
        .confirmed { text-align: center; padding: 60px 0; }
        .confirmed-mark { font-family: var(--serif); font-size: 3rem; color: var(--terracotta); margin-bottom: 28px; display: block; font-style: italic; }
        .confirmed-title { font-family: var(--serif); font-size: clamp(28px,5vw,44px); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 20px; }
        .confirmed-divider { width: 40px; height: 1px; background: var(--terracotta); margin: 0 auto 28px; opacity: 0.5; }
        .confirmed-detail { background: var(--espresso-mid); border-left: 3px solid var(--terracotta); padding: 20px 24px; margin: 0 auto 28px; max-width: 400px; text-align: left; }
        .detail-label { font-family: var(--mono); font-size: 0.65rem; color: var(--terracotta); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; }
        .detail-value { font-size: 1rem; color: var(--cream); font-weight: 500; margin-bottom: 4px; }
        .detail-value.time { font-family: var(--mono); font-size: 0.85rem; color: var(--muted); font-weight: 300; }
        .confirmed-body { font-size: 0.9rem; color: var(--muted); line-height: 1.7; max-width: 420px; margin: 0 auto 32px; }
        .btn-home { display: inline-flex; align-items: center; gap: 10px; background: transparent; border: 1px solid var(--border); color: var(--muted); font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 12px 24px; text-decoration: none; transition: border-color 0.2s, color 0.2s; }
        .btn-home:hover { border-color: var(--terracotta); color: var(--cream); }
        .error-state { text-align: center; padding: 80px 0; }
        .error-state p { color: var(--muted); margin-bottom: 20px; }
        .error-state a { color: var(--terracotta); font-family: var(--mono); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
      `}</style>
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#2C1A0E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#8a7060', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading...</span>
      </div>
    }>
      <BookingContent />
    </Suspense>
  )
}