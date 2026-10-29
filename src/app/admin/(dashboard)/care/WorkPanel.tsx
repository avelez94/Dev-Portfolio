'use client'
/**
 * Plan time for one website and billing period: the allowance breakdown,
 * Quick add work, the work history (with undo and correction), and estimates
 * for larger requests. Used on the website page and on the review screen.
 *
 * Nothing here deducts minutes by selecting a task. Minutes are applied only
 * when you confirm the work and its testing are complete and press
 * "Record completed work". The server recalculates everything from the
 * catalog; the numbers shown here are the same formula, for review.
 */
import { useMemo, useState } from 'react'
import { useLoad, careApi, Badge, Field, Loading, ErrorBox, Empty, Action, fmt } from './ui'
import { useUnsaved } from '../_components/unsaved'
import { STANDARD_HOURLY_RATE, formatRate } from '@/lib/terms'
import { EXCLUDED_LABEL, describeCalc, draftSummary, estimateProblems, lineTotals, money, type Allowance, type DraftLine, type MinuteRule, type Preset } from '@/lib/care/work'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type WorkData = {
  site: Row
  cycle: Row | null
  ledger: { cycle: Row; entries: Row[]; estimates: Row[]; allowance: Allowance; confirmed: boolean } | null
  presets: Preset[]
  openEstimates: Row[]
  terms: { current: boolean; version: string; onFile: string | null; note: string | null }
}

/** A direct link can open Quick add (?work=add) or a new estimate (?work=estimate). */
const linkedMode = () => {
  const w = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('work')
  return w === 'add' ? { kind: 'add' as const } : w === 'estimate' ? { kind: 'estimate' as const } : null
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export default function WorkPanel({ siteId, cycleId, tz }: { siteId?: string; cycleId?: string; tz: string }) {
  const path = cycleId ? `cycles/${cycleId}/work` : `sites/${siteId}/work`
  const { data, error, reload } = useLoad<WorkData>(path)
  const [mode, setMode] = useState<null | { kind: 'add'; estimate?: Row; corrects?: Row[] } | { kind: 'estimate'; initial?: Row; revisionOf?: Row }>(linkedMode)
  const [now] = useState(() => Date.now())
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <Loading lines={4} />
  const { ledger, terms } = data
  if (!data.cycle || !ledger) return <Empty>No paid billing period yet. Plan time starts with the first paid period.</Empty>
  const c = ledger.cycle
  const a = ledger.allowance
  const ended = new Date(c.period_end).getTime() < now
  const planHasTime = (c.included_minutes || 0) > 0
  const done = () => { setMode(null); reload() }

  return (
    <div className="care-grid">
      {!terms.current && <TermsReview siteId={data.site.id} onFile={terms.onFile} done={reload} />}
      <div className="care-between">
        <div>
          <div className="care-label">Billing period</div>
          <b>{fmt(c.period_start, tz, false)} to {fmt(c.period_end, tz, false)}</b> {ended ? <Badge tone="warn">Ended</Badge> : <Badge tone="ok">Current</Badge>}
        </div>
        <div className="care-row">
          <button className="care-btn primary" disabled={!terms.current} onClick={() => setMode({ kind: 'add' })}>Quick add work</button>
          <button className="care-btn" disabled={!terms.current} onClick={() => setMode({ kind: 'estimate' })}>New estimate</button>
        </div>
      </div>
      <AllowanceTiles a={a} confirmed={ledger.confirmed} planHasTime={planHasTime} />
      <label className="care-row" style={{ gap: 8 }}>
        <input type="checkbox" checked={ledger.confirmed} onChange={async (e) => { await careApi(`cycles/${c.id}/work-log`, { method: 'PUT', json: { confirmed: e.target.checked } }); reload() }} />
        All completed work for this period is recorded. Until this is ticked, the report shows the available time as not confirmed.
      </label>

      {mode?.kind === 'add' && <QuickAdd data={data} estimate={mode.estimate} corrects={mode.corrects} onDone={done} onCancel={() => setMode(null)} />}
      {mode?.kind === 'estimate' && <EstimateForm siteId={data.site.id} cycleId={c.id} available={a.available} planHasTime={planHasTime} initial={mode.initial} revisionOf={mode.revisionOf} onDone={done} onCancel={() => setMode(null)} />}

      <Estimates ledger={ledger} openElsewhere={data.openEstimates.filter((e) => e.cycle_id !== c.id)} ended={ended} tz={tz}
        onRecord={(e) => setMode({ kind: 'add', estimate: e })} onEdit={(e) => setMode({ kind: 'estimate', initial: e })} onRevise={(e) => setMode({ kind: 'estimate', revisionOf: e })} reload={reload} />
      <History entries={ledger.entries} tz={tz} onCorrect={(lines) => setMode({ kind: 'add', corrects: lines })} reload={reload} />
    </div>
  )
}

function AllowanceTiles({ a, confirmed, planHasTime }: { a: Allowance; confirmed: boolean; planHasTime: boolean }) {
  if (!planHasTime) return <p className="care-sub">This plan has no included time. Work is quoted separately with an estimate; recorded work still appears in the report.</p>
  return (
    <div className="care-allow" aria-label="Allowance">
      <div><small>Included</small><b>{a.included}</b><span className="care-muted">minutes this period</span></div>
      <div><small>Applied</small><b>{a.applied}</b><span className="care-muted">standard minutes, completed work</span></div>
      <div><small>Reserved</small><b>{a.reserved}</b><span className="care-muted">for approved work</span></div>
      <div className="hl"><small>Available</small><b>{Math.max(a.available, 0)}</b><span className="care-muted">{confirmed ? 'minutes' : 'minutes, records not confirmed'}</span></div>
    </div>
  )
}

function TermsReview({ siteId, onFile, done }: { siteId: string; onFile: string | null; done: () => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="care-sub" style={{ borderColor: 'var(--amberText)' }} role="note">
      <b>Review this client’s care agreement first.</b>
      <p className="care-muted" style={{ margin: '4px 0 8px' }}>
        {onFile ? `Their agreement is on older terms (${onFile}).` : 'There’s no record of which care terms this client agreed to.'} The flexible plan time method (standard minutes, included time usable for any work, estimates for larger requests) applies only once their agreement uses the current terms. Quick add and estimates stay off until then. Earlier agreements are kept as issued.
      </p>
      <div className="care-row" style={{ alignItems: 'flex-end' }}>
        <div className="care-fluid"><Field label="How the client accepted the current terms" id="terms-note"><input id="terms-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Signed updated care agreement, Nov 4" /></Field></div>
        <Action tone="primary" label="Mark agreement reviewed" disabled={note.trim().length < 5} run={() => careApi(`sites/${siteId}/terms`, { method: 'POST', json: { note } })} done={done} />
      </div>
    </div>
  )
}

/* ------------------------------ Quick add work ------------------------------ */

function lineFromPreset(p: Preset): DraftLine {
  return { key: newKey(), source: 'preset', preset: p, name: p.name, client_description: p.client_description, private_note: '', quantity: 1, work_minutes: p.work_minutes, testing_minutes: p.testing_minutes, testing_mode: p.testing_mode, testing_shared: false, excluded_reason: '' }
}
const customLine = (): DraftLine => ({ key: newKey(), source: 'custom', name: '', client_description: '', private_note: '', quantity: 1, work_minutes: 15, testing_minutes: 0, testing_mode: 'batch', testing_shared: false, excluded_reason: '' })

function QuickAdd({ data, estimate, corrects, onDone, onCancel }: { data: WorkData; estimate?: Row; corrects?: Row[]; onDone: () => void; onCancel: () => void }) {
  const ledger = data.ledger!
  const c = ledger.cycle
  const [batchKey] = useState(newKey) // fixed for this form, so a double click or retry saves once
  const [lines, setLines] = useState<DraftLine[]>(() => (corrects || []).map((e) => {
    const p = data.presets.find((x) => x.id === e.preset_id)
    const base = p ? lineFromPreset(p) : customLine()
    return { ...base, name: e.name, client_description: e.client_description, private_note: e.private_note || '', quantity: e.quantity, work_minutes: p ? base.work_minutes : e.work_minutes, testing_minutes: p ? base.testing_minutes : e.testing_minutes, testing_mode: e.testing_mode, testing_shared: e.testing_shared, excluded_reason: e.excluded_reason || '' }
  }))
  const [filter, setFilter] = useState('')
  const [estimateId, setEstimateId] = useState<string>(estimate?.id || '')
  const [finishes, setFinishes] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [reason, setReason] = useState('')
  const start = isoDay(new Date(c.period_start))
  const lastDay = isoDay(new Date(new Date(c.period_end).getTime() - 86400_000))
  const [completedOn, setCompletedOn] = useState(() => { const t = isoDay(new Date()); return t > lastDay ? lastDay : t < start ? start : t })
  useUnsaved(lines.length > 0)

  const approved = ledger.estimates.filter((e) => e.status === 'approved')
  const est = approved.find((e) => e.id === estimateId)
  const usedFromReservation = (id: string) => ledger.entries.filter((x) => x.estimate_id === id && !x.voided_at).reduce((s, x) => s + x.from_reservation, 0)
  const recordedFor = (id: string) => ledger.entries.filter((x) => x.estimate_id === id && !x.voided_at && !x.excluded_reason).reduce((s, x) => s + x.total_minutes, 0)
  // Corrections give back the minutes of the entries they replace before checking the balance.
  const giveBack = (corrects || []).reduce((s, e) => s + e.applied_minutes, 0)
  const allowance = est ? null : { ...ledger.allowance, available: ledger.allowance.available + giveBack }
  const sum = draftSummary(lines, allowance)
  const resLeft = est ? Math.max(est.reserved_minutes - usedFromReservation(est.id), 0) : 0
  const fromRes = est ? Math.min(sum.counted, resLeft) : 0
  const estOver = est ? recordedFor(est.id) + sum.counted > est.standard_minutes : false
  const problems = [...sum.problems, ...(estOver ? [`This would go beyond the approved estimate (${recordedFor(est!.id)} of ${est!.standard_minutes} standard minutes already recorded). Create a revised estimate first.`] : []), ...(corrects?.length && reason.trim().length < 3 ? ['Say why you’re correcting this entry.'] : [])]

  const presets = data.presets.filter((p) => !filter || p.category === filter)
  const cats = [...new Set(data.presets.map((p) => p.category))]
  const picked = (p: Preset) => lines.some((l) => l.preset?.id === p.id)
  const toggle = (p: Preset) => setLines(picked(p) ? lines.filter((l) => l.preset?.id !== p.id) : [...lines, lineFromPreset(p)])
  const update = (key: string, patch: Partial<DraftLine>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  async function save() {
    return careApi(`cycles/${c.id}/work`, {
      method: 'POST',
      json: {
        batch_key: batchKey, confirmed, completed_on: completedOn, estimate_id: est?.id || null, complete_estimate: !!est && finishes,
        corrects: corrects?.map((e) => e.id) || null, correct_reason: reason,
        lines: lines.map((l) => l.source === 'preset'
          ? { source: 'preset', preset_id: l.preset!.id, quantity: l.quantity, testing_shared: l.testing_shared, excluded_reason: l.excluded_reason || null, client_description: l.client_description, private_note: l.private_note }
          : { source: 'custom', name: l.name, client_description: l.client_description, private_note: l.private_note, quantity: l.quantity, work_minutes: l.work_minutes, testing_minutes: l.testing_minutes, testing_mode: l.testing_mode, testing_shared: l.testing_shared, excluded_reason: l.excluded_reason || null }),
      },
    })
  }

  return (
    <section className="care-panel" style={{ borderColor: 'var(--coral)', margin: 0 }} aria-labelledby="qa-h">
      <div className="care-between">
        <h3 id="qa-h">{corrects?.length ? 'Correct recorded work' : 'Quick add work'}</h3>
        <button className="care-btn small" onClick={onCancel}>Close</button>
      </div>
      <p className="care-muted" style={{ margin: '4px 0 12px' }}>1. Choose tasks. 2. Set quantities. 3. Check the minutes and the balance. 4. Confirm the work and its testing are complete. Choosing a task deducts nothing.</p>

      <div className="care-row" style={{ marginBottom: 8 }}>
        <span className="care-label">Tasks</span>
        <button className={`care-btn small ${!filter ? 'primary' : ''}`} onClick={() => setFilter('')}>All</button>
        {cats.map((x) => <button key={x} className={`care-btn small ${filter === x ? 'primary' : ''}`} onClick={() => setFilter(x)}>{x}</button>)}
      </div>
      <div className="care-pick" role="group" aria-label="Choose tasks">
        {presets.map((p) => (
          <label key={p.id} className={picked(p) ? 'on' : !p.confirmed_at ? 'off' : ''}>
            <input type="checkbox" checked={picked(p)} onChange={() => toggle(p)} />
            <span>
              <b>{p.name}</b>
              <span className="care-muted care-calc" style={{ display: 'block' }}>{p.work_minutes} min each + {p.testing_minutes} testing {p.testing_mode === 'batch' ? 'per batch' : 'each'}</span>
              {!p.confirmed_at && <Badge tone="warn">Proposed minutes</Badge>}
            </span>
          </label>
        ))}
      </div>
      <button className="care-btn small" style={{ marginTop: 8 }} onClick={() => setLines([...lines, customLine()])}>Add a custom task</button>

      {lines.length > 0 && (
        <div className="care-grid" style={{ marginTop: 14 }}>
          {lines.map((l) => {
            const t = lineTotals(l, l.quantity, l.testing_shared)
            return (
              <div key={l.key} className="care-line">
                <div className="care-between">
                  {l.source === 'preset' ? <b>{l.name}</b> : <div className="care-fluid"><Field label="Custom task name" id={`n-${l.key}`}><input id={`n-${l.key}`} value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="New booking widget" /></Field></div>}
                  <button className="care-btn small" aria-label={`Remove ${l.name || 'custom task'}`} onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>Remove</button>
                </div>
                {l.source === 'preset' && <div className="care-muted">One unit: {l.preset?.unit_definition}</div>}
                <div className="care-row" style={{ alignItems: 'flex-end' }}>
                  <div className="care-field">
                    <label htmlFor={`q-${l.key}`}>Quantity</label>
                    <div className="care-stepper">
                      <button type="button" aria-label="One less" disabled={l.quantity <= 1} onClick={() => update(l.key, { quantity: l.quantity - 1 })}>−</button>
                      <input id={`q-${l.key}`} type="number" min={1} max={100} inputMode="numeric" value={l.quantity} onChange={(e) => update(l.key, { quantity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                      <button type="button" aria-label="One more" disabled={l.quantity >= 100} onClick={() => update(l.key, { quantity: l.quantity + 1 })}>+</button>
                    </div>
                  </div>
                  {l.source === 'custom' && (
                    <>
                      <Field label="Agreed standard minutes per unit" id={`w-${l.key}`}><input id={`w-${l.key}`} type="number" min={0} style={{ width: 120, maxWidth: '100%' }} value={l.work_minutes} onChange={(e) => update(l.key, { work_minutes: Number(e.target.value) || 0 })} /></Field>
                      <Field label="Testing minutes" id={`t-${l.key}`}><input id={`t-${l.key}`} type="number" min={0} style={{ width: 100, maxWidth: '100%' }} value={l.testing_minutes} onChange={(e) => update(l.key, { testing_minutes: Number(e.target.value) || 0 })} /></Field>
                    </>
                  )}
                  <label className="care-row" style={{ gap: 6 }}><input type="checkbox" checked={l.testing_shared} onChange={(e) => update(l.key, { testing_shared: e.target.checked })} /> Tested together with another task here</label>
                  <Field label="Counts toward plan time" id={`x-${l.key}`}>
                    <select id={`x-${l.key}`} value={l.excluded_reason} onChange={(e) => update(l.key, { excluded_reason: e.target.value as DraftLine['excluded_reason'] })}>
                      <option value="">Yes</option>
                      <option value="defect_correction">No: covered defect correction</option>
                      <option value="monthly_check">No: part of the monthly checks</option>
                      <option value="report">No: report preparation</option>
                    </select>
                  </Field>
                </div>
                <div className="care-two">
                  <Field label="Client facing description" id={`d-${l.key}`}><input id={`d-${l.key}`} value={l.client_description} onChange={(e) => update(l.key, { client_description: e.target.value })} /></Field>
                  <Field label="Private note (never in the report)" id={`p-${l.key}`}><input id={`p-${l.key}`} value={l.private_note} onChange={(e) => update(l.key, { private_note: e.target.value })} style={{ borderColor: 'var(--amberText)' }} /></Field>
                </div>
                <div className="care-calc care-muted">{describeCalc(l, l.quantity, l.testing_shared)} standard minutes{l.excluded_reason ? ` (${EXCLUDED_LABEL[l.excluded_reason]})` : ''} · task {t.work}, testing {t.testing}</div>
              </div>
            )
          })}

          <div className="care-sub">
            <table className="care-table care-sum">
              <tbody>
                <tr><td>Task minutes</td><td className="n">{sum.work}</td></tr>
                <tr><td>Testing minutes</td><td className="n">{sum.testing}</td></tr>
                <tr><td><b>Standard minutes to apply</b></td><td className="n"><b>{sum.counted}</b></td></tr>
                {sum.notCounted > 0 && <tr><td>Recorded but not counted</td><td className="n">{sum.notCounted}</td></tr>}
                {!est && allowance && <>
                  <tr><td>Available now{giveBack ? ` (with ${giveBack} from the corrected entry)` : ''}</td><td className="n">{Math.max(allowance.available, 0)}</td></tr>
                  <tr><td><b>Available after recording</b></td><td className="n"><b style={{ color: (sum.after ?? 0) < 0 ? 'var(--redText)' : undefined }}>{sum.after}</b></td></tr>
                </>}
                {est && <>
                  <tr><td>From the estimate’s reserved plan time</td><td className="n">{fromRes}</td></tr>
                  <tr><td>As approved additional work</td><td className="n">{sum.counted - fromRes}</td></tr>
                  <tr><td>Estimate: recorded after this / approved</td><td className="n">{recordedFor(est.id) + sum.counted} / {est.standard_minutes}</td></tr>
                </>}
              </tbody>
            </table>
          </div>

          <div className="care-two">
            <Field label="Completed on" id="qa-date" hint="Must be inside this billing period."><input id="qa-date" type="date" min={start} max={lastDay} value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} /></Field>
            {approved.length > 0 && (
              <Field label="Part of an approved estimate?" id="qa-est">
                <select id="qa-est" value={estimateId} onChange={(e) => setEstimateId(e.target.value)}>
                  <option value="">No, use available plan time</option>
                  {approved.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.reserved_minutes} reserved)</option>)}
                </select>
              </Field>
            )}
          </div>
          {est && <label className="care-row" style={{ gap: 8 }}><input type="checkbox" checked={finishes} onChange={(e) => setFinishes(e.target.checked)} /> This finishes the estimate. Unused reserved minutes go back to the period.</label>}
          {corrects?.length ? <Field label="Why this correction" id="qa-why"><input id="qa-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="It was two images, not three" /></Field> : null}
          <label className="care-row" style={{ gap: 8 }}><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> <b>The work and its testing are complete.</b></label>
          {problems.length > 0 && <ul className="care-err" style={{ paddingLeft: 30 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
          <div className="care-row">
            <Action tone="primary" label={corrects?.length ? 'Record correction' : 'Record completed work'} disabled={!confirmed || problems.length > 0} run={save} done={onDone} />
            <button className="care-btn" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------ history ------------------------------ */

function History({ entries, tz, onCorrect, reload }: { entries: Row[]; tz: string; onCorrect: (lines: Row[]) => void; reload: () => void }) {
  const batches = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const e of entries) m.set(e.batch_key, [...(m.get(e.batch_key) || []), e])
    return [...m.values()].reverse()
  }, [entries])
  if (!batches.length) return <Empty>No work recorded this period.</Empty>
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Recorded work</h3>
      <div className="care-grid">
        {batches.map((b) => {
          const live = b.filter((e) => !e.voided_at)
          return (
            <div key={b[0].batch_key} className="care-sub" style={{ opacity: live.length ? 1 : 0.65 }}>
              <div className="care-between">
                <span className="care-muted">Completed {b[0].completed_on} · recorded {fmt(b[0].recorded_at, tz)} by {b[0].recorded_by}</span>
                {live.length > 0 && (
                  <span className="care-actions">
                    <button className="care-btn small" onClick={() => onCorrect(live)}>Correct</button>
                    <UndoButton ids={live.map((e) => e.id)} done={reload} />
                  </span>
                )}
              </div>
              <div className="care-scroll" style={{ marginTop: 6 }} role="region" aria-label="Recorded tasks" tabIndex={0}>
              <table className="care-table care-sum care-stack">
                <thead><tr><th>Task</th><th className="n">Qty</th><th className="n">Standard min</th><th className="n">Plan time</th><th className="care-hide-sm">Calculation</th></tr></thead>
                <tbody>
                  {b.map((e) => (
                    <tr key={e.id} style={{ textDecoration: e.voided_at ? 'line-through' : undefined }}>
                      <td><b>{e.name}</b><div className="care-muted">{e.client_description}</div>{e.private_note && <div className="care-muted">Private: {e.private_note}</div>}{e.voided_at && <div className="care-muted" style={{ textDecoration: 'none' }}>Undone: {e.void_reason}</div>}</td>
                      <td className="n" data-label="Qty">{e.quantity}</td>
                      <td className="n" data-label="Standard min">{e.total_minutes}</td>
                      <td className="n" data-label="Plan time">{e.excluded_reason ? <Badge>{EXCLUDED_LABEL[e.excluded_reason as keyof typeof EXCLUDED_LABEL]}</Badge> : <>{e.applied_minutes}{e.additional_minutes ? <div className="care-muted">+{e.additional_minutes} additional</div> : null}</>}</td>
                      <td className="care-hide-sm care-muted care-calc">{describeCalc(e as MinuteRule, e.quantity, e.testing_shared)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UndoButton({ ids, done }: { ids: string[]; done: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) return <button className="care-btn small danger" onClick={() => setOpen(true)}>Undo</button>
  return (
    <span className="care-actions">
      <input className="care-fluid" aria-label="Why undo this work" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
      <Action small tone="danger" label="Undo and restore minutes" disabled={reason.trim().length < 3} run={() => careApi('work/void', { method: 'POST', json: { entries: ids, reason } })} done={done} />
      <button className="care-btn small" onClick={() => setOpen(false)}>Keep</button>
    </span>
  )
}

/* ------------------------------ estimates ------------------------------ */

const ADDITIONAL_RATE = `${formatRate(STANDARD_HOURLY_RATE)} with a one hour minimum`
const PRICE_WORDING = {
  fixed: 'A fixed quote for the work beyond your included time.',
  hourly: `Estimated at ${formatRate(STANDARD_HOURLY_RATE)} with a one hour minimum; billed for the time actually worked.`,
}

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'coral'> = { draft: 'info', approved: 'coral', completed: 'ok', declined: 'bad', cancelled: 'bad', superseded: 'info', expired: 'warn' }

function Estimates({ ledger, openElsewhere, ended, tz, onRecord, onEdit, onRevise, reload }: {
  ledger: NonNullable<WorkData['ledger']>; openElsewhere: Row[]; ended: boolean; tz: string
  onRecord: (e: Row) => void; onEdit: (e: Row) => void; onRevise: (e: Row) => void; reload: () => void
}) {
  const list = ledger.estimates
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Estimates for larger requests</h3>
      {openElsewhere.length > 0 && (
        <div className="care-sub" style={{ borderColor: 'var(--amberText)', marginBottom: 8 }} role="note">
          <b>Unfinished work from an earlier period:</b> {openElsewhere.map((e) => e.title).join(', ')}. Reserved minutes stay in their own period. Open that period’s review to carry the work forward (it needs approval again) or cancel it.
        </div>
      )}
      {list.length === 0 ? <Empty>No estimates this period. A draft reserves nothing; the client’s approval reserves the included minutes.</Empty> : (
        <div className="care-grid">
          {list.map((e) => (
            <div key={e.id} className="care-sub">
              <div className="care-between">
                <div><b>{e.title}</b> <Badge tone={STATUS_TONE[e.status] || 'info'}>{e.status}</Badge>{e.revision_of && <span className="care-muted"> · revision</span>}</div>
                <span className="care-muted">{fmt(e.created_at, tz, false)}</span>
              </div>
              <div className="care-muted" style={{ marginTop: 4 }}>{e.scope}</div>
              <div className="care-muted"><b style={{ color: 'var(--text2)' }}>Deliverables:</b> {e.deliverables}{e.schedule ? ` · ${e.schedule}` : ''}</div>
              <ul className="care-calc care-facts">
                <li>{e.standard_minutes} standard minutes (with testing)</li>
                <li>{e.included_minutes} from included time</li>
                <li>{e.additional_minutes} additional</li>
                {e.additional_minutes > 0 && <li>Additional price <b>{money(e.additional_price_cents)}</b> <span className="care-muted">({e.price_explanation || 'no explanation yet'})</span></li>}
              </ul>
              {e.status === 'approved' && <div className="care-muted">Approved: {e.approval_note} · {e.reserved_minutes} minutes reserved</div>}
              {e.close_reason && <div className="care-muted">{e.close_reason}</div>}
              <div className="care-actions" style={{ marginTop: 8 }}>
                {e.status === 'draft' && <>
                  <button className="care-btn small" onClick={() => onEdit(e)}>Edit</button>
                  <ReasonAction label="Record client approval" field="How the client approved" placeholder="Email reply, Oct 30" tone="primary" run={(note) => careApi(`estimates/${e.id}/approve`, { method: 'POST', json: { note } })} done={reload} />
                  <ReasonAction label="Declined" field="Why" placeholder="Client decided not to go ahead" run={(reason) => careApi(`estimates/${e.id}/close`, { method: 'POST', json: { status: 'declined', reason } })} done={reload} />
                </>}
                {e.status === 'approved' && <>
                  {!ended && <button className="care-btn small primary" onClick={() => onRecord(e)}>Record work for this</button>}
                  <button className="care-btn small" onClick={() => onRevise(e)}>Revise scope</button>
                  {ended && <Action small label="Carry to current period" run={() => careApi(`estimates/${e.id}/carry`, { method: 'POST', json: {} })} done={reload} />}
                  <ReasonAction label="Cancel" field="Why" placeholder="Client paused the project" tone="danger" run={(reason) => careApi(`estimates/${e.id}/close`, { method: 'POST', json: { status: 'cancelled', reason } })} done={reload} />
                </>}
                {['approved', 'completed'].includes(e.status) && (e.additional_price_cents || 0) > 0 && (e.invoice_id
                  ? <Badge tone="ok">Invoice saved (pending, not sent)</Badge>
                  : <InvoiceAction id={e.id} amount={money(e.additional_price_cents)} done={reload} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReasonAction({ label, field, placeholder, run, done, tone }: { label: string; field: string; placeholder: string; run: (text: string) => Promise<unknown>; done: () => void; tone?: 'primary' | 'danger' }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open) return <button className={`care-btn small ${tone || ''}`} onClick={() => setOpen(true)}>{label}</button>
  return (
    <span className="care-actions" style={{ flexBasis: '100%' }}>
      <input className="care-fluid" aria-label={field} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <Action small tone={tone} label={label} disabled={text.trim().length < 3} run={() => run(text)} done={done} />
      <button className="care-btn small" onClick={() => setOpen(false)}>Back</button>
    </span>
  )
}

function InvoiceAction({ id, amount, done }: { id: string; amount: string; done: () => void }) {
  const [open, setOpen] = useState(false)
  const [num, setNum] = useState('')
  const [due, setDue] = useState('')
  if (!open) return <button className="care-btn small" onClick={() => setOpen(true)}>Create invoice for {amount}</button>
  return (
    <span className="care-actions" style={{ flexBasis: '100%' }}>
      <input className="care-fluid" aria-label="Invoice number" value={num} onChange={(e) => setNum(e.target.value)} placeholder="INV-2026-210" />
      <input className="care-fluid" aria-label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      <Action small tone="primary" label={`Save ${amount} invoice`} disabled={num.trim().length < 2} run={() => careApi(`estimates/${id}/invoice`, { method: 'POST', json: { invoice_number: num, due_date: due } })} done={done} />
      <span className="care-muted" style={{ flexBasis: '100%' }}>Saved as pending in Revenue. Not sent, nothing charged.</span>
    </span>
  )
}

function EstimateForm({ siteId, cycleId, available, planHasTime, initial, revisionOf, onDone, onCancel }: {
  siteId: string; cycleId: string; available: number; planHasTime: boolean; initial?: Row; revisionOf?: Row; onDone: () => void; onCancel: () => void
}) {
  const src = initial || revisionOf
  const [f, setF] = useState({
    title: src?.title || '', scope: src?.scope || '', deliverables: src?.deliverables || '', schedule: src?.schedule || '',
    standard_minutes: src?.standard_minutes ?? 60,
    included_minutes: src?.included_minutes ?? (planHasTime ? Math.min(Math.max(available, 0), 60) : 0),
    additional_price: src?.additional_price_cents === null || src?.additional_price_cents === undefined ? '' : String(src.additional_price_cents / 100),
    price_explanation: src?.price_explanation || '',
  })
  useUnsaved(true)
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }))
  const additional = Math.max(Number(f.standard_minutes) - Number(f.included_minutes), 0)
  const cents = f.additional_price === '' ? null : Math.round(Number(f.additional_price) * 100)
  const problems = estimateProblems({ ...f, standard_minutes: Number(f.standard_minutes), included_minutes: Number(f.included_minutes), additional_price_cents: cents }, revisionOf ? null : available, planHasTime)
  const body = { ...f, standard_minutes: Number(f.standard_minutes), included_minutes: Number(f.included_minutes), cycle_id: cycleId, revision_of: revisionOf?.id || null }
  return (
    <section className="care-panel" style={{ borderColor: 'var(--coral)', margin: 0 }} aria-labelledby="est-h">
      <div className="care-between"><h3 id="est-h">{revisionOf ? `Revise: ${revisionOf.title}` : initial ? 'Edit estimate' : 'New estimate'}</h3><button className="care-btn small" onClick={onCancel}>Close</button></div>
      <p className="care-muted" style={{ margin: '4px 0 12px' }}>A draft reserves nothing. When you record the client’s approval, the included minutes are reserved in this billing period. Plan time is counted in standard minutes, which don’t set a price. Additional work is priced at the standard rate ({ADDITIONAL_RATE}) or as a fixed quote the client agrees to.{revisionOf ? ' Approving this revision replaces the earlier version and releases its unused reservation.' : ''}</p>
      <div className="care-grid">
        <Field label="Title" id="e-title"><input id="e-title" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Team section rebuild" /></Field>
        <div className="care-two">
          <Field label="Scope" id="e-scope"><textarea id="e-scope" value={f.scope} onChange={(e) => set('scope', e.target.value)} /></Field>
          <Field label="Expected deliverables" id="e-del"><textarea id="e-del" value={f.deliverables} onChange={(e) => set('deliverables', e.target.value)} /></Field>
        </div>
        <Field label="Agreed schedule" id="e-sch"><input id="e-sch" value={f.schedule} onChange={(e) => set('schedule', e.target.value)} placeholder="Done within a week of approval" /></Field>
        <div className="care-two">
          <Field label="Total standard minutes, including testing" id="e-std"><input id="e-std" type="number" min={1} value={f.standard_minutes} onChange={(e) => set('standard_minutes', e.target.value)} /></Field>
          <Field label="Included minutes proposed" id="e-inc" hint={planHasTime ? `${Math.max(available, 0)} available now.` : 'This plan has no included time.'}><input id="e-inc" type="number" min={0} disabled={!planHasTime} value={f.included_minutes} onChange={(e) => set('included_minutes', e.target.value)} /></Field>
        </div>
        <p className="care-calc"><b>{additional}</b> minutes of additional work beyond the included time.</p>
        {additional > 0 && (
          <div className="care-two">
            <Field label="Additional price ($)" id="e-price" hint={`Your quote: hourly at ${ADDITIONAL_RATE}, or an agreed fixed amount. Entered by you; nothing is charged automatically.`}><input id="e-price" type="number" min={0} step="0.01" value={f.additional_price} onChange={(e) => set('additional_price', e.target.value)} /></Field>
            <div className="care-field">
              <Field label="How the price was calculated" id="e-why"><input id="e-why" value={f.price_explanation} onChange={(e) => set('price_explanation', e.target.value)} placeholder="Fixed quote for the work beyond your included time" /></Field>
              <div className="care-actions">
                <button type="button" className="care-btn small" onClick={() => set('price_explanation', PRICE_WORDING.fixed)}>Use fixed quote wording</button>
                <button type="button" className="care-btn small" onClick={() => set('price_explanation', PRICE_WORDING.hourly)}>Use hourly wording</button>
              </div>
            </div>
          </div>
        )}
        {problems.length > 0 && <ul className="care-sub care-muted" style={{ paddingLeft: 30 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        <div className="care-row">
          <Action tone="primary" label={initial ? 'Save draft' : 'Save as draft'} run={() => (initial ? careApi(`estimates/${initial.id}`, { method: 'PUT', json: body }) : careApi(`sites/${siteId}/estimates`, { method: 'POST', json: body }))} done={onDone} />
          <button className="care-btn" onClick={onCancel}>Cancel</button>
        </div>
        <p className="care-muted">Drafts appear in the client report under “Waiting for your approval” once they’re complete.</p>
      </div>
    </section>
  )
}
