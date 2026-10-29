'use client'
/**
 * Schedule: the next 14 days, weekly availability, and blocked days and hours.
 * Monthly Website Care reviews appear here as read only items when that
 * feature is on; they never block booking, create meetings, or invite anyone.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-admin-browser'
import { useTheme } from '../../_components/theme'
import { PageFrame, PageState } from '../../_components/ui'
import { useUnsaved } from '../../_components/unsaved'
import { combine, useRows } from '../../_lib/useRows'
import { DAYS_FULL, DAYS_SHORT, fmt12, fmtDayFull } from '../../_lib/format'
import type { Availability, BlockedDate, BlockedSlot, CareCalendarItem } from '../../_lib/types'

const todayIso = () => new Date().toISOString().split('T')[0]

export default function ScheduleView() {
  const { d } = useTheme()
  const bookings = useRows<{ scheduled_at: string }>(() => supabase.from('bookings').select('scheduled_at').eq('status', 'scheduled'))
  const availabilityQ = useRows<Availability>(() => supabase.from('availability').select('*').order('day_of_week'))
  const datesQ = useRows<BlockedDate>(() => supabase.from('blocked_dates').select('*').gte('blocked_date', todayIso()).order('blocked_date'))
  const slotsQ = useRows<BlockedSlot>(() => supabase.from('blocked_slots').select('*').gte('blocked_date', todayIso()).order('blocked_date'))
  const page = combine(bookings, availabilityQ, datesQ, slotsQ)
  const availability = availabilityQ.rows, blockedDates = datesQ.rows, blockedSlots = slotsQ.rows

  // Website Care reviews, only where that feature is on (its API answers 404 otherwise).
  const [careOn, setCareOn] = useState(false)
  const [careItems, setCareItems] = useState<CareCalendarItem[]>([])
  useEffect(() => {
    fetch('/api/care/admin/calendar', { cache: 'no-store' }).then(async (r) => {
      setCareOn(r.ok)
      if (r.ok) setCareItems((await r.json()).items || [])
    }).catch(() => {})
  }, [])

  const [now] = useState(() => Date.now())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [newBlockedReason, setNewBlockedReason] = useState('')
  useUnsaved(Boolean(blockStart || blockEnd || newBlockedDate || newBlockedReason))

  async function toggleDay(a: Availability) { await supabase.from('availability').update({ is_active: !a.is_active }).eq('id', a.id); await availabilityQ.reload() }
  async function updateHours(a: Availability, field: 'start_time' | 'end_time', val: string) { await supabase.from('availability').update({ [field]: val }).eq('id', a.id); await availabilityQ.reload() }
  async function addBlockedDate() {
    if (!newBlockedDate) return
    await supabase.from('blocked_dates').insert({ blocked_date: newBlockedDate, reason: newBlockedReason || null })
    setNewBlockedDate(''); setNewBlockedReason(''); await datesQ.reload()
  }
  async function removeBlockedDate(id: string) { await supabase.from('blocked_dates').delete().eq('id', id); await datesQ.reload() }
  async function saveBlockedSlot() {
    if (!selectedDay || !blockStart || !blockEnd) return
    await supabase.from('blocked_slots').insert({ blocked_date: selectedDay, start_time: blockStart, end_time: blockEnd })
    setBlockStart(''); setBlockEnd(''); setSelectedDay(null); await slotsQ.reload()
  }
  async function removeBlockedSlot(id: string) { await supabase.from('blocked_slots').delete().eq('id', id); await slotsQ.reload() }

  const bookedDays = new Set(bookings.rows.map((b) => { const dt = new Date(b.scheduled_at); return dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate() }))
  const blockedDaySet = new Set(blockedDates.map((b) => b.blocked_date))
  const blockedSlotDays = new Set(blockedSlots.map((s) => s.blocked_date))
  const slotsForSelectedDay = selectedDay ? blockedSlots.filter((s) => s.blocked_date === selectedDay) : []

  return (
    <PageFrame>
      <PageState {...page} what="your schedule">
        <div className="page-header">
          <h1 className="page-greeting" style={{color:d.text}}>Schedule</h1>
          <div className="page-sub" style={{color:d.text3}}>Click any day to block specific hours</div>
        </div>
        <div className="legend">
          {[{bg:d.text,label:'Today'},{bg:d.accentBg,border:d.accent,label:'Has booking'},{bg:d.surface2,label:'Full day blocked'},{bg:d.accent,label:'Has blocked hours'}].map((l,i)=>(
            <div key={i} className="legend-item" style={{color:d.text3}}>
              <div className="legend-dot" style={{background:l.bg,border:l.border?'1px solid '+l.border:'none'}}/>{l.label}
            </div>
          ))}
          {careOn && <div className="legend-item" style={{color:d.text3}}><span className="care-diamond" aria-hidden="true"/>Care review due (doesn’t block booking)</div>}
        </div>
        <div className="cal-wrap" style={{background:d.white,borderColor:d.border}}>
          <div className="cal-header">
            <div className="cal-month-label" style={{color:d.text}}>Next 14 days</div>
            <div style={{fontSize:12,color:d.text3}}>{new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})} to {new Date(now+13*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
          </div>
          <div className="cal-days-row">{DAYS_SHORT.map(day=><div key={day} className="cal-day-label" style={{color:d.text3}}>{day}</div>)}</div>
          <div className="cal-grid">
            {(()=>{
              const cells=[], start=new Date(); start.setHours(0,0,0,0)
              for(let i=0;i<start.getDay();i++) cells.push(<div key={'e'+i} className="cal-cell empty"/>)
              for(let i=0;i<14;i++){
                // Calendar days, not 24 hour steps, so the daylight saving change can't repeat or skip a date.
                const dt=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i)
                const ds=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')
                const key=dt.getFullYear()+'-'+dt.getMonth()+'-'+dt.getDate()
                const isToday=i===0, hasB=bookedDays.has(key), isBlockedDay=blockedDaySet.has(ds)
                const hasBlockedSlots=blockedSlotDays.has(ds), isSelected=selectedDay===ds
                cells.push(
                  <div key={ds} className="cal-cell"
                    style={{background:isToday?d.text:isBlockedDay?d.surface2:isSelected?d.accentBg:hasB?d.accentBg:'transparent',color:isToday?d.white:isBlockedDay?d.text3:hasB?d.accent:d.text2,fontWeight:isToday||hasB?500:300,textDecoration:isBlockedDay?'line-through':'none',outline:isSelected?'2px solid '+d.accent:'none',outlineOffset:'1px'}}
                    onClick={()=>!isBlockedDay&&setSelectedDay(isSelected?null:ds)}>
                    {dt.getDate()}
                    {hasBlockedSlots&&!isBlockedDay&&<div className="slot-indicator"/>}
                    {careItems.some(c=>c.date===ds)&&<span className="care-diamond in-cell" title={`${careItems.filter(c=>c.date===ds).length} care review(s) due`} aria-label={`${careItems.filter(c=>c.date===ds).length} care review due`}/>}
                  </div>
                )
              }
              return cells
            })()}
          </div>
        </div>
        {careOn && (
          <div className="care-cal-list" style={{background:d.white,borderColor:d.border}} aria-label="Monthly care reviews">
            <div className="section-label" style={{color:d.text2,marginBottom:8}}>Monthly care reviews</div>
            {careItems.filter(c=>!c.done||new Date(c.due).getTime()>now-14*86400000).length===0 ? <div className="empty-note" style={{color:d.text3,textAlign:'left',padding:0}}>No care reviews scheduled.</div> :
              careItems.filter(c=>!c.done||new Date(c.due).getTime()>now-14*86400000).slice(0,12).map(c=>(
                <a key={c.id} href={c.link} className="care-cal-item" style={{borderColor:c.overdue?d.redText:d.border2,color:d.text,background:d.surface}}>
                  <span className="care-diamond" aria-hidden="true"/>
                  <span style={{width:92,flex:'none',fontSize:12,color:c.overdue?d.redText:d.text2}}>{c.overdue?'Overdue · ':''}{new Date(c.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                  <span style={{flex:1,minWidth:0}}><b>{c.client}</b><span style={{display:'block',color:d.text3,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.site}</span></span>
                  <span className="care-cal-status" style={{background:c.done?d.green:c.overdue?d.red:d.surface3,color:c.done?d.greenText:c.overdue?d.redText:d.text}}>{c.status}</span>
                </a>
              ))}
            <div style={{fontSize:12,color:d.text3,marginTop:6}}>Care reviews are your own work items. They don’t block discovery call times, create Zoom meetings, or invite anyone.</div>
          </div>
        )}
        {selectedDay && (
          <div className="day-block-panel" style={{background:d.surface,borderColor:d.border}}>
            <div className="dbp-title" style={{color:d.text}}>{fmtDayFull(selectedDay)}</div>
            {careItems.filter(c=>c.date===selectedDay).map(c=>(
              <a key={c.id} href={c.link} className="care-cal-item" style={{borderColor:d.border2,color:d.text,background:d.white}}>
                <span className="care-diamond" aria-hidden="true"/>
                <span style={{flex:1,minWidth:0}}><b>Care review: {c.client}</b><span style={{display:'block',color:d.text3,fontSize:12}}>{c.site} · {c.status}</span></span>
                <span style={{color:d.accent,fontSize:12,fontWeight:700}}>Open review</span>
              </a>
            ))}
            {slotsForSelectedDay.length>0 && (
              <div className="dbp-slots">
                {slotsForSelectedDay.map(s=>(
                  <div key={s.id} className="dbp-slot" style={{background:d.surface2}}>
                    <div className="dbp-slot-time" style={{color:d.text}}>{fmt12(s.start_time)} to {fmt12(s.end_time)}</div>
                    <button aria-label="Remove" className="dbp-slot-rm" style={{color:d.text3}} onClick={()=>removeBlockedSlot(s.id)}>x</button>
                  </div>
                ))}
              </div>
            )}
            <div className="dbp-add">
              <input type="time" className="dbp-input" value={blockStart} style={{background:d.white,borderColor:d.border,color:d.text}} onChange={e=>setBlockStart(e.target.value)}/>
              <input type="time" className="dbp-input" value={blockEnd} style={{background:d.white,borderColor:d.border,color:d.text}} onChange={e=>setBlockEnd(e.target.value)}/>
              <button className="dbp-save" onClick={saveBlockedSlot} disabled={!blockStart||!blockEnd}>Block</button>
            </div>
            <div style={{fontSize:12,color:d.text3,marginTop:6}}>Selected hours will be hidden from client booking calendar</div>
          </div>
        )}
        <div className="section-label" style={{color:d.text2,marginBottom:10,marginTop:8}}>Weekly availability</div>
        <div className="day-cards">
          {availability.map(a=>(
            <div key={a.id} className="day-card" style={{background:a.is_active?d.accentBg:d.white,borderColor:a.is_active?d.accent:d.border}} onClick={()=>toggleDay(a)}>
              <div className="dc-name" style={{color:a.is_active?d.accent:d.text3}}>{DAYS_SHORT[a.day_of_week]}</div>
              <div className="dc-dot" style={{background:a.is_active?d.accent:d.border}}/>
              <div className="dc-time" style={{color:a.is_active?d.text2:d.text3}}>{a.is_active?a.start_time.slice(0,5):'off'}</div>
            </div>
          ))}
        </div>
        <div className="hours-card" style={{background:d.white,borderColor:d.border}}>
          {availability.map(a=>(
            <div key={a.id} className="hour-item" style={{borderColor:d.border,opacity:a.is_active?1:0.8}}>
              <div className="hi-day" style={{color:d.text2}}>{DAYS_FULL[a.day_of_week].slice(0,3)}</div>
              <label className="hi-toggle">
                <input type="checkbox" aria-label={`Open on ${DAYS_FULL[a.day_of_week]}`} checked={a.is_active} onChange={()=>toggleDay(a)}/>
                <div className="hi-track" style={{background:a.is_active?d.accent:d.surface2,borderColor:a.is_active?d.accent:d.border}}/>
                <div className="hi-thumb"/>
              </label>
              {a.is_active&&(
                <div className="hi-times">
                  <input type="time" className="hi-input" value={a.start_time.slice(0,5)} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>updateHours(a,'start_time',e.target.value)}/>
                  <span className="hi-sep" style={{color:d.text3}}>to</span>
                  <input type="time" className="hi-input" value={a.end_time.slice(0,5)} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>updateHours(a,'end_time',e.target.value)}/>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="blocked-card" style={{background:d.white,borderColor:d.border}}>
          <div className="blocked-card-title" style={{color:d.text2}}>Full day blocks</div>
          {blockedDates.length===0&&<div className="empty-note" style={{textAlign:'left',paddingLeft:0,paddingTop:0,paddingBottom:8,color:d.text3}}>None blocked.</div>}
          {blockedDates.map(b=>(
            <div key={b.id} className="bl-row" style={{background:d.surface}}>
              <div className="bl-d" style={{color:d.text}}>{b.blocked_date}</div>
              <div className="bl-r" style={{color:d.text2}}>{b.reason}</div>
              <button aria-label="Remove" className="bl-x" style={{color:d.text3}} onClick={()=>removeBlockedDate(b.id)}>x</button>
            </div>
          ))}
          <div className="add-block-row">
            <input type="date" aria-label="Date to block" className="ab-input" value={newBlockedDate} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>setNewBlockedDate(e.target.value)}/>
            <input type="text" className="ab-input" placeholder="Reason (optional)" value={newBlockedReason} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>setNewBlockedReason(e.target.value)}/>
            <button className="ab-btn" onClick={addBlockedDate} disabled={!newBlockedDate}>Block Day</button>
          </div>
        </div>
      </PageState>
    </PageFrame>
  )
}
