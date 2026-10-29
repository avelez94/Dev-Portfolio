'use client'
/**
 * Home: today at a glance. Upcoming calls, leads without a call, accepted
 * proposals waiting for a contract, overdue invoices, and active projects.
 * The selected call or lead is in the address (?call= or ?lead=), so a link
 * or refresh shows the same one; with nothing selected, the next call is shown.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ADMIN_INK } from '@/lib/admin-theme'
import { supabase } from '@/lib/supabase-admin-browser'
import { useTheme } from '../_components/theme'
import { Empty, PageFrame, PageState, SectionLabel } from '../_components/ui'
import { combine, useRows } from '../_lib/useRows'
import { countdown, fmtMoney, fmtRelative, fmtShort } from '../_lib/format'
import { leadStageLabel } from '../_lib/leads'
import { markInvoicePaid } from '../_lib/invoices'
import type { Booking, Invoice, Project, Row, Submission } from '../_lib/types'
import { BookingPanel, NothingSelected, SubmissionPanel } from './LeadPanel'

export default function HomeView() {
  const { d, cardColors } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const bookings = useRows<Booking>(() => supabase.from('bookings').select('*, intake_submissions(*)').eq('status', 'scheduled').order('scheduled_at', { ascending: true }))
  // A short note that was later completed through the questionnaire is shown once, on the completed lead.
  const leads = useRows<Submission>(() => supabase.from('intake_submissions').select('*').eq('status', 'pending').order('submitted_at', { ascending: false }))
  const projects = useRows<Project>(() => supabase.from('projects').select('*').eq('status', 'active'))
  const invoices = useRows<Invoice>(() => supabase.from('invoices').select('*').in('status', ['pending', 'awaiting_deposit']))
  const proposals = useRows<Row>(() => supabase.from('proposals').select('*').eq('status', 'accepted').order('created_at', { ascending: false }))
  const contracts = useRows<Row>(() => supabase.from('contracts').select('client_email, status').eq('status', 'signed'))
  const page = combine(bookings, leads, projects, invoices, proposals, contracts)

  const now = time.getTime()
  const upcoming = bookings.rows.filter((b) => new Date(b.scheduled_at).getTime() > now)
  const unbooked = leads.rows.filter((s) => s.stage !== 'merged')
  const signedEmails = new Set(contracts.rows.map((c) => c.client_email))
  const pendingContracts = proposals.rows.filter((p) => !signedEmails.has(p.client_email))
  const overdue = invoices.rows.filter((i) => i.due_date && new Date(i.due_date) < new Date())
  const activeProjects = [...projects.rows].sort((a, b) => {
    if (!a.end_date) return 1
    if (!b.end_date) return -1
    return new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
  })

  const callId = params.get('call')
  const leadId = params.get('lead')
  const selectedBooking = callId ? bookings.rows.find((b) => b.id === callId) : !leadId ? upcoming[0] : undefined
  const selectedLead = leadId ? unbooked.find((s) => s.id === leadId) : undefined

  // On phones the details panel sits below the list; show it when something is picked.
  const picked = useRef(false)
  function select(kind: 'call' | 'lead', id: string) {
    picked.current = true
    router.push(`${pathname}?${kind}=${encodeURIComponent(id)}`, { scroll: false })
  }
  useEffect(() => {
    if (!picked.current) return
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.querySelector('.panel')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [callId, leadId])

  async function addToPipeline(b: Booking) {
    const intake = b.intake_submissions
    const { data: ex } = await supabase.from('clients').select('id').eq('intake_id', intake.id).maybeSingle()
    if (ex) return
    await supabase.from('clients').insert({ intake_id: intake.id, booking_id: b.id, name: intake.name, email: intake.email, business: intake.business, pipeline_stage: 'discovery_call', notes: null, platform: 'direct' })
  }

  const hour = time.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const panel = selectedBooking ? <BookingPanel key={selectedBooking.id} b={selectedBooking} onAddToPipeline={() => addToPipeline(selectedBooking)} />
    : selectedLead ? <SubmissionPanel key={selectedLead.id} s={selectedLead} />
      : <NothingSelected />

  return (
    <PageFrame panel={panel}>
      <div className="page-header">
        <h1 className="page-greeting" style={{ color: d.text }}>{greeting}, <em>Alante.</em></h1>
        <div className="page-sub" style={{ color: d.text3 }}>{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
      </div>
      <PageState {...page} what="your dashboard">
        <div className="stat-row-3">
          {[
            { label: 'Upcoming calls', num: upcoming.length, sub: upcoming.length === 0 ? 'None scheduled' : 'Scheduled', bg: d.sand, hot: upcoming.length > 0 },
            { label: 'Awaiting booking', num: unbooked.length, sub: 'No call yet', bg: d.linen, hot: false },
            { label: 'Active projects', num: activeProjects.length, sub: 'In progress', bg: d.blush, hot: false },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ background: s.bg, borderColor: d.border }}>
              <div className="sc-label" style={{ color: d.text2 }}>{s.label}</div>
              <div className="sc-num" style={{ color: s.hot ? d.accent : d.text }}>{s.num}</div>
              <div className="sc-sub" style={{ color: d.text3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {pendingContracts.length > 0 && (
          <div className="section" style={{ marginBottom: 16 }}>
            <SectionLabel color={d.greenText} count={pendingContracts.length} countBg={d.green} countColor={d.greenText}>Proposals Accepted</SectionLabel>
            {pendingContracts.map((p) => (
              <div key={p.id} className="alert-row" style={{ background: d.green, borderColor: d.greenText + '44' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: d.text }}>{p.client_name}</div>
                  <div style={{ fontSize: 12, color: d.greenText }}>{p.project_title} · Accepted {new Date(p.responded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <Link className="cr-btn" style={{ background: d.greenText, color: ADMIN_INK, textDecoration: 'none' }} href="/admin/documents">Send Contract</Link>
              </div>
            ))}
          </div>
        )}
        {overdue.length > 0 && (
          <div className="section" style={{ marginBottom: 16 }}>
            <SectionLabel color={d.redText} count={overdue.length} countBg={d.red} countColor={d.redText}>Overdue Invoices</SectionLabel>
            {overdue.map((inv) => (
              <div key={inv.id} className="alert-row" style={{ background: d.red, borderColor: d.redText + '44' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: d.text }}>Invoice #{inv.invoice_number}</div>
                  <div style={{ fontSize: 12, color: d.redText }}>Due {inv.due_date ? fmtShort(inv.due_date) : 'unknown'} · {fmtMoney(inv.total_fee || inv.amount)}</div>
                </div>
                <button className="cr-btn" style={{ background: d.redText, color: ADMIN_INK }} onClick={async () => { await markInvoicePaid(inv); await invoices.reload() }}>Mark Paid</button>
              </div>
            ))}
          </div>
        )}
        {activeProjects.length > 0 && (
          <div className="section">
            <SectionLabel count={activeProjects.length}>Active Projects</SectionLabel>
            {activeProjects.map((p) => {
              const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - now) / 86400000) : null
              const isUrgent = daysLeft !== null && daysLeft <= 3
              return (
                <div key={p.id} className="proj-row" style={{ background: d.white, borderColor: isUrgent ? d.accent : d.border }}>
                  <div style={{ flex: 1 }}>
                    <div className="proj-name" style={{ color: d.text }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: d.text2 }}>{p.type} · {fmtMoney(p.value)}</div>
                  </div>
                  <div className="proj-due" style={{ color: isUrgent ? d.accent : d.text3 }}>
                    {daysLeft === null ? 'No deadline' : daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : daysLeft + 'd left'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="section">
          <SectionLabel count={upcoming.length}>Discovery Calls</SectionLabel>
          {upcoming.length === 0 ? <Empty>No upcoming calls scheduled.</Empty> : (
            <div className="booking-cards">
              {upcoming.map((b, i) => (
                <button key={b.id} type="button" className={'booking-card' + (selectedBooking?.id === b.id ? ' selected' : '')} aria-pressed={selectedBooking?.id === b.id}
                  style={{ background: cardColors[i % cardColors.length], textAlign: 'left', font: 'inherit', width: '100%' }} onClick={() => select('call', b.id)}>
                  <div className="bc-type" style={{ color: d.text2 }}>{b.intake_submissions?.project_type}</div>
                  <div className="bc-name" style={{ color: d.text }}>{b.intake_submissions?.name}</div>
                  <div className="bc-date" style={{ color: d.text2 }}>{fmtShort(b.scheduled_at)} · {new Date(b.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                  <div className="bc-footer">
                    <div className="bc-countdown">{countdown(b.scheduled_at)}</div>
                    <div className="bc-arrow" style={{ background: 'rgba(251,243,232,0.1)', color: d.text2 }}>→</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="section">
          <SectionLabel count={unbooked.length}>Submitted, No Call Yet</SectionLabel>
          {unbooked.length === 0 ? <Empty>No pending submissions.</Empty> : (
            <div className="sub-list">
              {unbooked.map((s) => {
                const on = selectedLead?.id === s.id
                return (
                  <button key={s.id} type="button" className="sub-item" aria-pressed={on}
                    style={{ background: on ? d.accentBg : d.white, borderColor: on ? d.accent : d.border, textAlign: 'left', font: 'inherit', width: '100%', color: 'inherit' }}
                    onClick={() => select('lead', s.id)}>
                    <div className="si-dot" style={{ background: d.accent }} />
                    <div style={{ flex: 1 }}>
                      <div className="si-name" style={{ color: d.text }}>{s.name}</div>
                      <div className="si-type" style={{ color: d.text2 }}>{s.project_type}</div>
                      <div className="si-type" style={{ color: s.stage === 'inquiry' ? d.text3 : d.accent, fontWeight: 600 }}>{leadStageLabel(s)}</div>
                    </div>
                    <div className="si-meta" style={{ color: d.text3 }}>{fmtRelative(s.submitted_at)}</div>
                    <div className="si-meta" style={{ color: d.accent }}>{s.budget || 'TBD'}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PageState>
    </PageFrame>
  )
}
