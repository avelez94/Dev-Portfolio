'use client'
/**
 * Task catalog: the schedule of standard minutes that plan time is counted
 * in. Each preset defines one unit, its work minutes, and its testing
 * allowance. Proposed minutes deduct nothing until you confirm them, and
 * changing the minutes needs confirming again. Recorded work keeps its own
 * copy of the preset, so edits never change past entries.
 */
import { useState } from 'react'
import { useLoad, careApi, Badge, Field, Loading, ErrorBox, Empty, Action } from './ui'
import { describeCalc, type Preset } from '@/lib/care/work'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const blank = { name: '', category: '', unit_definition: '', included: '', work_minutes: 5, testing_minutes: 2, testing_mode: 'batch', client_description: '', private_instructions: '' }

export default function TaskCatalog() {
  const { data, error, reload } = useLoad<{ presets: Preset[] }>('presets')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <div className="care-panel"><Loading lines={6} /></div>
  const presets = data.presets.filter((p) => showInactive || p.active)
  const cats = [...new Set(presets.map((p) => p.category))]
  const proposed = data.presets.filter((p) => p.active && !p.confirmed_at).length
  return (
    <section className="care-panel" aria-labelledby="cat-h">
      <div className="care-between">
        <div>
          <h2 id="cat-h">Task catalog</h2>
          <p className="care-muted" style={{ maxWidth: 720 }}>Standard minutes applied to a client’s plan time, not measured time. Line total = quantity × work minutes + testing (once for the batch, or for each unit). Proposed minutes deduct nothing until you confirm them.</p>
        </div>
        <div className="care-row">
          {proposed > 0 && <Badge tone="warn">{proposed} proposed, not confirmed</Badge>}
          <label className="care-row" style={{ gap: 6 }}><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
          <button className="care-btn primary" onClick={() => setEditing('new')}>New task</button>
        </div>
      </div>
      {editing === 'new' && <PresetForm initial={blank} onDone={() => { setEditing(null); reload() }} onCancel={() => setEditing(null)} />}
      {presets.length === 0 ? <Empty>No tasks yet.</Empty> : cats.map((cat) => (
        <div key={cat} style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>{cat}</h3>
          <div className="care-grid">
            {presets.filter((p) => p.category === cat).map((p) => editing === p.id
              ? <PresetForm key={p.id} id={p.id} initial={p} onDone={() => { setEditing(null); reload() }} onCancel={() => setEditing(null)} />
              : <PresetCard key={p.id} p={p} onEdit={() => setEditing(p.id)} reload={reload} />)}
          </div>
        </div>
      ))}
    </section>
  )
}

function PresetCard({ p, onEdit, reload }: { p: Preset; onEdit: () => void; reload: () => void }) {
  return (
    <div className="care-sub" style={{ opacity: p.active ? 1 : 0.7 }}>
      <div className="care-between">
        <div>
          <b>{p.name}</b>{' '}
          {!p.active ? <Badge>Inactive</Badge> : p.confirmed_at ? <Badge tone="ok">Confirmed</Badge> : <Badge tone="warn">Proposed, not confirmed</Badge>}
          <div className="care-muted" style={{ marginTop: 4 }}><b style={{ color: 'var(--text2)' }}>One unit:</b> {p.unit_definition}</div>
          {p.included && <div className="care-muted"><b style={{ color: 'var(--text2)' }}>Includes:</b> {p.included}</div>}
          <div className="care-muted"><b style={{ color: 'var(--text2)' }}>Client sees:</b> {p.client_description}</div>
          {p.private_instructions && <div className="care-muted"><b style={{ color: 'var(--text2)' }}>Private:</b> {p.private_instructions}</div>}
        </div>
        <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
          <div className="care-calc"><b>{p.work_minutes}</b> min per unit · <b>{p.testing_minutes}</b> min testing {p.testing_mode === 'batch' ? 'per batch' : 'per unit'}</div>
          <div className="care-muted care-calc">Example: {describeCalc(p, 2)}</div>
          <div className="care-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="care-btn small" onClick={onEdit}>Edit</button>
            {p.active && !p.confirmed_at && <Action small tone="primary" label="Confirm minutes" run={() => careApi(`presets/${p.id}/confirm`, { method: 'POST', json: { version: p.version } })} done={reload} />}
            <Action small label={p.active ? 'Make inactive' : 'Make active'} run={() => careApi(`presets/${p.id}`, { method: 'PUT', json: { active: !p.active } })} done={reload} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PresetForm({ id, initial, onDone, onCancel }: { id?: string; initial: Row; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState<Row>({ ...initial, private_instructions: initial.private_instructions || '' })
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }))
  const minutesChanged = id && (f.work_minutes !== initial.work_minutes || f.testing_minutes !== initial.testing_minutes || f.testing_mode !== initial.testing_mode || f.unit_definition !== initial.unit_definition)
  const n = (k: string) => <input id={`pf-${k}`} type="number" min={0} inputMode="numeric" value={f[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
  return (
    <div className="care-sub" style={{ borderColor: 'var(--coral)' }}>
      <div className="care-grid">
        <div className="care-two">
          <Field label="Task name" id="pf-name"><input id="pf-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Category" id="pf-category"><input id="pf-category" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Images, Text, Links…" /></Field>
        </div>
        <Field label="One unit is" id="pf-unit" hint="What a quantity of 1 means. Say whether the content is supplied ready to use, or needs finding, writing, or editing."><textarea id="pf-unit" value={f.unit_definition} onChange={(e) => set('unit_definition', e.target.value)} style={{ minHeight: 60 }} /></Field>
        <Field label="What’s included" id="pf-inc"><textarea id="pf-inc" value={f.included} onChange={(e) => set('included', e.target.value)} style={{ minHeight: 60 }} /></Field>
        <div className="care-two">
          <Field label="Standard work minutes per unit" id="pf-work_minutes">{n('work_minutes')}</Field>
          <Field label="Testing minutes" id="pf-testing_minutes">{n('testing_minutes')}</Field>
        </div>
        <Field label="Testing applies" id="pf-mode">
          <select id="pf-mode" value={f.testing_mode} onChange={(e) => set('testing_mode', e.target.value)}>
            <option value="batch">Once per batch (any quantity)</option>
            <option value="per_unit">To each unit</option>
          </select>
        </Field>
        <Field label="Client facing description" id="pf-desc" hint="Shown in the monthly report when this task is recorded."><input id="pf-desc" value={f.client_description} onChange={(e) => set('client_description', e.target.value)} /></Field>
        <Field label="Private instructions (optional)" id="pf-priv"><textarea id="pf-priv" value={f.private_instructions} onChange={(e) => set('private_instructions', e.target.value)} style={{ minHeight: 60, borderColor: 'var(--amberText)' }} /></Field>
        <p className="care-muted care-calc">Two units: {describeCalc({ work_minutes: Number(f.work_minutes) || 0, testing_minutes: Number(f.testing_minutes) || 0, testing_mode: f.testing_mode }, 2)} standard minutes.</p>
        {minutesChanged && <p className="care-sub" style={{ borderColor: 'var(--amberText)' }}>Saving changed minutes or the unit makes this preset proposed again. Confirm it before it deducts plan time. Work already recorded keeps the minutes it was recorded with.</p>}
        <div className="care-row">
          <Action tone="primary" label={id ? 'Save task' : 'Add task (proposed)'} run={() => careApi(id ? `presets/${id}` : 'presets', { method: id ? 'PUT' : 'POST', json: f })} done={onDone} />
          <button className="care-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
