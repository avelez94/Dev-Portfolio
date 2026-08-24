'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function BookingContent() {
  const searchParams = useSearchParams()
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

  const slotsByDate = slots.reduce((acc: Record<string, string[]>, slot) => {
    const date = slot.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(slot)
    return acc
  }, {})

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const today = new Date()
  const minDate = new Date(today.getTime() + 48 * 60 * 60 * 1000)
  const selectedDate = selectedSlot ? selectedSlot.split('T')[0] : null

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    })
  }

  function formatConfirmedDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --pink: #A96860;
          --pink-light: #C18078;
          --cream: #FAF3E8;
          --dark: #2A2420;
          --muted: #8B7D73;
          --border: rgba(169,104,96,0.2);
          --surface: #FFFFFF;
          --surface2: rgba(245,230,211,0.4);
        }
        body { background: var(--cream); color: var(--dark); font-family: 'DM Sans', sans-serif; font-weight: 300; min-height: 100vh; }
        .shell { width: 100%; max-width: 680px; margin: 0 auto; padding: 48px 24px 100px; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 52px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
        .logo-text { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: var(--dark); text-decoration: none; font-weight: 700; }
        .step-counter { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
        .step-tag { display: inline-flex; align-items: center; gap: 10px; font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--pink); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 16px; }
        .step-tag::before { content: ''; width: 24px; height: 1px; background: var(--pink); }
        .page-title { font-family: 'Playfair Display', serif; font-size: clamp(32px, 6vw, 52px); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 16px; color: var(--dark); }
        .page-title em { font-style: italic; color: var(--pink); }
        .page-sub { font-size: 0.9rem; color: var(--muted); line-height: 1.65; margin-bottom: 40px; max-width: 480px; }
        .calendar-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 28px; margin-bottom: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .cal-month { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; color: var(--dark); }
        .cal-nav { background: none; border: 1px solid var(--border); color: var(--muted); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.2s, color 0.2s; border-radius: 4px; }
        .cal-nav:hover:not(:disabled) { border-color: var(--pink); color: var(--pink); }
        .cal-nav:disabled { opacity: 0.3; cursor: not-allowed; }
        .cal-days-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px; }
        .cal-day-label { font-family: 'DM Mono', monospace; font-size: 0.62rem; color: var(--muted); text-align: center; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 0; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.85rem; color: var(--muted); position: relative; border: 1px solid transparent; transition: all 0.15s; border-radius: 4px; }
        .cal-cell.empty { border-color: transparent; }
        .cal-cell.disabled { opacity: 0.3; cursor: not-allowed; }
        .cal-cell.has-slots { color: var(--dark); cursor: pointer; border-color: var(--border); background: var(--surface2); }
        .cal-cell.has-slots:hover { border-color: var(--pink); background: rgba(169,104,96,0.06); }
        .cal-cell.selected { border-color: var(--pink); background: rgba(169,104,96,0.08); color: var(--dark); }
        .slot-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--pink); position: absolute; bottom: 5px; }
        .time-slots { margin-bottom: 32px; }
        .time-slots-label { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--pink); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .time-slots-label::before { content: ''; width: 20px; height: 1px; background: var(--pink); }
        .time-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
        .time-slot { background: var(--surface); border: 1px solid var(--border); color: var(--dark); font-family: 'DM Mono', monospace; font-size: 0.75rem; letter-spacing: 0.06em; padding: 12px 16px; cursor: pointer; transition: all 0.15s; text-align: center; border-radius: 4px; }
        .time-slot:hover { border-color: var(--pink); color: var(--pink); }
        .time-slot.selected { border-color: var(--pink); background: var(--pink); color: var(--cream); }
        .nav { display: flex; justify-content: flex-end; margin-top: 32px; padding-top: 28px; border-top: 1px solid var(--border); }
        .btn-confirm { display: inline-flex; align-items: center; gap: 14px; background: var(--pink); border: none; color: var(--cream); font-family: 'DM Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 28px; cursor: pointer; transition: background 0.25s, transform 0.2s; border-radius: 4px; }
        .btn-confirm:hover:not(:disabled) { background: var(--pink-light); transform: translateY(-2px); }
        .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
        .error-msg { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: #b04a4a; margin-top: 12px; }
        .confirmed { text-align: center; padding: 60px 0; }
        .confirmed-mark { font-family: 'Playfair Display', serif; font-size: 3rem; color: var(--pink); margin-bottom: 28px; display: block; font-style: italic; }
        .confirmed-title { font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 44px); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 20px; color: var(--dark); }
        .confirmed-divider { width: 40px; height: 1px; background: var(--pink); margin: 0 auto 28px; opacity: 0.4; }
        .confirmed-detail { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--pink); padding: 20px 24px; margin: 0 auto 28px; max-width: 400px; text-align: left; border-radius: 4px; }
        .detail-label { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--pink); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; }
        .detail-value { font-size: 1rem; color: var(--dark); font-weight: 500; margin-bottom: 4px; }
        .detail-value.time { font-family: 'DM Mono', monospace; font-size: 0.85rem; color: var(--muted); font-weight: 300; }
        .confirmed-body { font-size: 0.9rem; color: var(--muted); line-height: 1.7; max-width: 420px; margin: 0 auto 32px; }
        .btn-home { display: inline-flex; align-items: center; gap: 10px; background: transparent; border: 1px solid var(--border); color: var(--muted); font-family: 'DM Mono', monospace; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 12px 24px; text-decoration: none; transition: border-color 0.2s, color 0.2s; border-radius: 4px; }
        .btn-home:hover { border-color: var(--pink); color: var(--pink); }
        .error-state { text-align: center; padding: 80px 0; }
        .error-state p { color: var(--muted); margin-bottom: 20px; font-size: 0.9rem; }
        .error-state a { color: var(--pink); font-family: 'DM Mono', monospace; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
      `}</style>

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
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#FAF3E8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#8B7D73', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading...</span>
      </div>
    }>
      <BookingContent />
    </Suspense>
  )
}