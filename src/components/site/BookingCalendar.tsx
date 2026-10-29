'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import s from './site.module.css'
import { CONTACT_EMAIL } from '@/content/site'

/**
 * Discovery call booking. Uses the existing availability and booking APIs
 * (same 20 minute length, 48 hour notice, Eastern Time availability, Zoom).
 * Times are shown in the visitor's own time zone.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Lead = { firstName: string; stage: string; booked: boolean }
type Phase = 'noref' | 'loading' | 'notfound' | 'ready' | 'booked' | 'confirmed'

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone
/** Visitor local calendar date for an instant, as YYYY-MM-DD. */
const localKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz() })
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function BookingCalendar() {
  const ref = useSearchParams().get('ref')
  const [phase, setPhase] = useState<Phase>(ref ? 'loading' : 'noref')
  const [lead, setLead] = useState<Lead | null>(null)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [slots, setSlots] = useState<string[]>([])
  const [slotsState, setSlotsState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState<{ at: string; joinUrl?: string; emailed: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Who is this booking for? Only a first name and progress come back.
  useEffect(() => {
    if (!ref) return
    let cancelled = false
    fetch(`/api/intake/${encodeURIComponent(ref)}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) return setPhase('notfound')
        const data = (await res.json()) as Lead
        setLead(data)
        setPhase(data.booked ? 'booked' : 'ready')
      })
      .catch(() => !cancelled && setPhase('ready')) // still let them try to book
    return () => {
      cancelled = true
    }
  }, [ref])

  const loadSlots = useCallback(async (m: Date) => {
    setSlotsState('loading')
    // Fetch a little either side of the month so local time zones near midnight are covered.
    const start = new Date(m.getFullYear(), m.getMonth(), 0)
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    try {
      const res = await fetch(`/api/availability?start=${ymd(start)}&end=${ymd(end)}`)
      if (!res.ok) throw new Error('availability')
      const data = await res.json()
      setSlots(Array.isArray(data.slots) ? data.slots : [])
      setSlotsState('ok')
    } catch {
      setSlots([])
      setSlotsState('error')
    }
  }, [])

  useEffect(() => {
    if (phase !== 'ready') return
    let active = true
    Promise.resolve().then(() => {
      if (active) loadSlots(month)
    })
    return () => {
      active = false
    }
  }, [phase, month, reloadKey, loadSlots])

  const byDay = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const iso of slots) {
      const k = localKey(iso)
      ;(map[k] ||= []).push(iso)
    }
    return map
  }, [slots])

  const today = new Date()
  const atCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const firstWeekday = month.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const fmtDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const fmtFull = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const tzName = new Date().toLocaleTimeString('en-US', { timeZoneName: 'long' }).split(' ').slice(2).join(' ')

  async function confirm() {
    if (!slot || !ref) return
    setConfirming(true)
    setError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId: ref, scheduledAt: slot }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setError('Someone just took that time. Here are the times still open.')
        setSlot(null)
        setReloadKey((k) => k + 1)
        return
      }
      if (!res.ok) {
        setError(data?.message || 'That didn’t go through, and nothing was booked. Please try again in a moment.')
        return
      }
      setConfirmed({ at: slot, joinUrl: data?.booking?.join_url, emailed: data?.emailed !== false })
      setPhase('confirmed')
      window.scrollTo({ top: 0 })
    } catch {
      setError('That didn’t go through, and nothing was booked. Please check your connection and try again.')
    } finally {
      setConfirming(false)
    }
  }

  /* ---------------- Non booking states ---------------- */

  if (phase === 'noref' || phase === 'notfound') {
    return (
      <section className={s.flowShell} aria-labelledby="book-title">
        <header className={s.flowHead}>
          <p className={s.eyebrow}>Discovery call</p>
          <h1 id="book-title" className={s.flowTitle}>
            Let’s start with <em>your project.</em>
          </h1>
          <p className={s.flowLede}>
            {phase === 'notfound'
              ? 'I couldn’t find the project details for this booking link. It may be mistyped or out of date.'
              : 'Discovery calls are booked right after the project questionnaire, so I can read your answers before we talk.'}
          </p>
        </header>
        <div className={s.flowCard}>
          <div className={s.flowActions}>
            <Link href="/intake" className={`${s.btn} ${s.btnPrimary}`}>
              Complete the Project Questionnaire
            </Link>
            <Link href="/#contact" className={`${s.btn} ${s.btnGhost}`}>
              Send a Quick Note Instead
            </Link>
          </div>
          <p className={s.flowAside}>
            Already filled it in? Use the link in your confirmation email, or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      </section>
    )
  }

  if (phase === 'loading') {
    return (
      <section className={s.flowShell} aria-busy="true">
        <p className={s.flowNotice} role="status">
          Loading your booking…
        </p>
      </section>
    )
  }

  if (phase === 'booked') {
    return (
      <section className={s.flowShell} aria-labelledby="book-title">
        <header className={s.flowHead}>
          <p className={s.eyebrow}>Discovery call</p>
          <h1 id="book-title" className={s.flowTitle}>
            You’re already <em>booked{lead?.firstName ? `, ${lead.firstName}` : ''}.</em>
          </h1>
          <p className={s.flowLede}>Your confirmation email has the date, time, and Zoom link. Need a different time? Just reply to that email and I’ll sort it out.</p>
        </header>
        <div className={s.flowActions}>
          <Link href="/" className={`${s.btn} ${s.btnGhost}`}>
            Back to Home
          </Link>
        </div>
      </section>
    )
  }

  if (phase === 'confirmed' && confirmed) {
    return (
      <section className={s.flowShell} aria-labelledby="book-title">
        <div className={s.flowCard} role="status" aria-live="polite">
          <div className={s.successBadge} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 id="book-title" className={s.flowTitle}>
            You’re all set{lead?.firstName ? `, ${lead.firstName}` : ''}. <em>Talk soon!</em>
          </h1>
          <div className={s.bookedSummary}>
            <p className={s.bookedLabel}>Your discovery call</p>
            <p className={s.bookedWhen}>{fmtFull(confirmed.at)}</p>
            <p>
              {fmtTime(confirmed.at)} ({tzName}) &middot; 20 minutes on Zoom
            </p>
          </div>
          <p className={s.flowLede}>
            {confirmed.emailed
              ? 'A confirmation with your Zoom link is on its way to your inbox. I’ll have read your project details before we talk.'
              : 'Your call is booked. The confirmation email didn’t go out, so keep the Zoom link below, and I’ll follow up by email too.'}
          </p>
          <div className={s.flowActions}>
            {confirmed.joinUrl && (
              <a href={confirmed.joinUrl} className={`${s.btn} ${s.btnPrimary}`} target="_blank" rel="noopener noreferrer">
                Zoom Link for Your Call
              </a>
            )}
            <Link href="/" className={`${s.btn} ${s.btnGhost}`}>
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    )
  }

  /* ---------------- Calendar ---------------- */

  const daySlots = day ? byDay[day] || [] : []
  return (
    <section className={s.flowShell} aria-labelledby="book-title">
      <header className={s.flowHead}>
        <p className={s.eyebrow}>{lead?.stage === 'inquiry' ? 'Discovery call' : 'Project details received'}</p>
        <h1 id="book-title" className={s.flowTitle}>
          {lead?.stage === 'inquiry' ? 'Pick a time to' : `Thanks${lead?.firstName ? `, ${lead.firstName}` : ''}! Now pick a time`}{' '}
          <em>{lead?.stage === 'inquiry' ? 'talk.' : 'to talk.'}</em>
        </h1>
        <p className={s.flowLede}>
          {lead?.stage === 'inquiry'
            ? 'Choose a time for a short discovery call.'
            : 'Your project details are saved and I’ll read them before we talk.'}
        </p>
      </header>

      <div className={s.callInfo}>
        <h2 className={s.callInfoTitle}>What the call is for</h2>
        <ul className={s.dotList}>
          <li>Talk through your goals and what’s not working today</li>
          <li>Confirm what’s in scope, rough timing, and the right starting point</li>
          <li>Answer your questions, so you can decide if we’re a good fit</li>
        </ul>
        <p className={s.callMeta}>20 minutes on Zoom &middot; times start 48 hours from now &middot; shown in your time zone ({tzName})</p>
      </div>

      <div className={s.calendarCard}>
        <div className={s.calHead}>
          <button
            type="button"
            className={s.calNav}
            onClick={() => {
              setDay(null)
              setSlot(null)
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }}
            disabled={atCurrentMonth}
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className={s.calMonth} aria-live="polite">
            {monthLabel}
          </h2>
          <button
            type="button"
            className={s.calNav}
            onClick={() => {
              setDay(null)
              setSlot(null)
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        {slotsState === 'error' ? (
          <div className={s.calError} role="alert">
            <p>
              <strong>Your project details are saved, and nothing is lost.</strong> The available times didn’t load just now.
            </p>
            <div className={s.flowActions}>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setReloadKey((k) => k + 1)}>
                Try Again
              </button>
              <a className={`${s.btn} ${s.btnGhost}`} href={`mailto:${CONTACT_EMAIL}?subject=Discovery%20call%20time`}>
                Email Me a Few Times
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className={s.calWeek} aria-hidden="true">
              {DAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className={s.calGrid} aria-busy={slotsState === 'loading'}>
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const key = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(i + 1)}`
                const count = byDay[key]?.length ?? 0
                const selected = day === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${s.calDay} ${count ? s.calDayOpen : ''} ${selected ? s.calDaySelected : ''}`}
                    disabled={!count}
                    aria-pressed={selected}
                    aria-label={`${fmtDay(key)}${count ? `, ${count} ${count === 1 ? 'time' : 'times'} available` : ', no times'}`}
                    onClick={() => {
                      setDay(key)
                      setSlot(null)
                      setError('')
                    }}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            {slotsState === 'loading' && <p className={s.calNote}>Loading available times…</p>}
            {slotsState === 'ok' && slots.length === 0 && (
              <p className={s.calNote}>
                No open times this month. Try the next month, or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            )}
          </>
        )}
      </div>

      {day && daySlots.length > 0 && (
        <fieldset className={s.timeSet}>
          <legend>Times on {fmtDay(day)}</legend>
          <div className={s.timeGrid}>
            {daySlots.map((iso) => (
              <label key={iso} className={s.timeChoice}>
                <input type="radio" name="slot" value={iso} checked={slot === iso} onChange={() => setSlot(iso)} />
                <span>{fmtTime(iso)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && (
        <div className={s.formError} role="alert">
          {error}
        </div>
      )}

      <div className={s.flowNav}>
        <span className={s.calNote}>{slot ? `${fmtDay(localKey(slot))} at ${fmtTime(slot)}` : 'Choose a day, then a time.'}</span>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={confirm} disabled={!slot || confirming}>
          {confirming ? 'Booking…' : 'Confirm My Call'}
        </button>
      </div>
    </section>
  )
}
