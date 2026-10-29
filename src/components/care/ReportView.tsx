/**
 * The concise monthly health report as a web view, in the light client brand.
 * Used for the admin preview and the public sample, from the same snapshot the
 * PDF is built from. Icons always come with a text label.
 * Copy rule: no dashes in client facing text.
 */
import { COLORS as C, FONTS } from '@/lib/brand'
import { STATE_LABEL, TONE, nextStepLines, planFacts, type Snapshot, type RowState, type PlanBox } from '@/lib/care/report-model'
import css from './ReportView.module.css'

export function StateIcon({ state, size = 18 }: { state: RowState; size?: number }) {
  const c = TONE[state].line
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ flex: 'none' }}>
      {state === 'unverified' ? (
        <>
          <path d="M10 2.5 18.5 17h-17z" fill={c} />
          <path d="M10 7.5v4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="14.6" r="1.1" fill="#fff" />
        </>
      ) : (
        <>
          <circle cx="10" cy="10" r="9" fill={c} />
          {state === 'issue' ? <path d="m6.5 6.5 7 7m0-7-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" /> : <path d="m5.8 10.3 2.8 2.8 5.6-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </>
      )}
    </svg>
  )
}

const sec = { fontFamily: FONTS.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: C.teal, margin: '22px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }

export default function ReportView({ s, sampleLabel }: { s: Snapshot; sampleLabel?: string }) {
  const tiles: [RowState, number, string][] = [
    ['passed', s.counts.passed, s.counts.fixed ? `Passed (${s.counts.fixed} fixed)` : 'Passed'],
    ['issue', s.counts.issues, s.counts.issues === 1 ? 'Issue found' : 'Issues found'],
    ['unverified', s.counts.unverified, 'Not verified'],
  ]
  const next = nextStepLines(s)
  // Column major, like the PDF: the first half reads down the left column.
  const half = Math.ceil(s.checklist.length / 2)
  const cols = [s.checklist.slice(0, half), s.checklist.slice(half)].filter((c) => c.length)
  return (
    <article className={css.report} style={{ background: C.paper, color: C.ink, fontFamily: FONTS.body, borderRadius: 18, border: `1px solid ${C.line}`, padding: 'clamp(16px, 4vw, 28px)', lineHeight: 1.5, ['--rv-line' as string]: C.line }} aria-label={`Monthly health report for ${s.site.label}`}>
      {(s.sample || sampleLabel) && (
        <p style={{ margin: '0 0 14px', background: C.coralSoft, color: C.coralDeep, fontWeight: 700, fontSize: 13, textAlign: 'center', borderRadius: 10, padding: '6px 10px' }}>{sampleLabel || 'Sample report • Illustrative findings'}</p>
      )}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.coralDeep }}>Monthly health report • {s.period.label}</p>
      <h3 style={{ fontFamily: FONTS.display, fontSize: 'clamp(22px, 4vw, 28px)', margin: '4px 0 2px', lineHeight: 1.15 }}>{s.site.label}</h3>
      <p style={{ margin: 0, fontSize: 14, color: C.inkSoft, wordBreak: 'break-word' }}>
        {[s.recipient.name, s.client.business].filter(Boolean).join(', ')}{s.recipient.name || s.client.business ? ' • ' : ''}{s.site.url}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 14, color: C.inkSoft }}>Reviewed {s.review_date || 'not yet'} • Checked: {s.scope.line}</p>
      {s.plan_box && <PlanSummary b={s.plan_box} />}

      <p style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 19, margin: '16px 0 10px', lineHeight: 1.3 }}>{s.headline}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {tiles.map(([k, n, label]) => (
          <li key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: TONE[k].fill, border: `1.5px solid ${TONE[k].line}`, borderRadius: 14, padding: '10px 12px', color: TONE[k].text }}>
            <StateIcon state={k} size={22} />
            <span style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{n}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
          </li>
        ))}
      </ul>
      {s.summary && <p style={{ margin: '14px 0 0', fontSize: 15, whiteSpace: 'pre-wrap' }}>{s.summary}</p>}

      {s.attention.length > 0 && (
        <section aria-label="Needs attention">
          <h4 style={sec}><StateIcon state="issue" size={16} />Needs attention</h4>
          <div style={{ display: 'grid', gap: 10 }}>
            {s.attention.map((a, i) => (
              <div key={i} style={{ background: '#FFF7F5', border: `1.5px solid ${TONE.issue.line}`, borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <StateIcon state="issue" size={18} />
                  <strong style={{ fontSize: 15 }}>{a.title}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: TONE.issue.text }}>{a.status}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 14 }}><strong>What’s wrong:</strong> {a.what}</p>
                {a.why && <p style={{ margin: '2px 0 0', fontSize: 14 }}><strong>Why it matters:</strong> {a.why}</p>}
                {a.pages.length > 0 && <p style={{ margin: '2px 0 0', fontSize: 14 }}><strong>Where:</strong> {a.pages.join(', ')}{a.devices.length ? ` (${a.devices.join(' and ')})` : ''}</p>}
                {a.note && <p style={{ margin: '2px 0 0', fontSize: 14 }}><strong>Next:</strong> {a.status}: {a.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {s.fixed.length > 0 && (
        <section aria-label="Fixed and verified">
          <h4 style={sec}><StateIcon state="fixed" size={16} />Fixed and verified</h4>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
            {s.fixed.map((f, i) => <li key={i}><strong>{f.title}</strong>{f.pages.length ? `: ${f.pages.join(', ')}` : ''}. Verified: {f.verified}{f.note ? ` ${f.note}` : ''}</li>)}
          </ul>
        </section>
      )}

      <section aria-label="This month’s checks">
        <h4 style={sec}>This month’s checks</h4>
        <div className={css.checks}>
          {cols.map((col, ci) => (
            <ul key={ci} className={css.col}>
              {col.map((r, i) => (
                <li key={i} className={css.row}>
                  <span className={css.icon}><StateIcon state={r.state} size={18} /></span>
                  <span style={{ fontSize: 14, lineHeight: '21px' }}>
                    <strong>{r.label}</strong>
                    {r.note && <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.45, color: C.inkSoft }}>{r.note}</span>}
                  </span>
                  <span className={css.status} style={{ color: TONE[r.state].text }}>{STATE_LABEL[r.state]}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
        {s.not_applicable.length > 0 && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.inkSoft }}>Not part of this month: {s.not_applicable.join(', ')}.</p>}
      </section>

      {s.not_verified.length > 0 && (
        <section aria-label="Not verified this month">
          <h4 style={sec}><StateIcon state="unverified" size={16} />Not verified this month</h4>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
            {s.not_verified.map((n, i) => <li key={i}><strong>{n.label}</strong>{n.pages.length ? ` (${n.pages.join(', ')})` : ''}: {n.why}</li>)}
          </ul>
        </section>
      )}

      {(s.work.fixes || s.work.investigated || s.work.outstanding) && (
        <section aria-label="What I did">
          <h4 style={sec}>What I did</h4>
          {s.work.fixes && <p style={{ margin: '0 0 4px', fontSize: 14, whiteSpace: 'pre-wrap' }}><strong>Fixed:</strong> {s.work.fixes}</p>}
          {s.work.investigated && <p style={{ margin: '0 0 4px', fontSize: 14, whiteSpace: 'pre-wrap' }}><strong>Looked into:</strong> {s.work.investigated}</p>}
          {s.work.outstanding && <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}><strong>Still open:</strong> {s.work.outstanding}</p>}
        </section>
      )}

      <section aria-label="Next step" style={{ marginTop: 18, background: C.tealSoft, border: `1.5px solid ${C.ink}`, borderRadius: 14, padding: '12px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.tealDeep }}>Next step</p>
        {next.map((t, i) => <p key={i} style={{ margin: '4px 0 0', fontSize: i === 0 ? 15 : 14, fontWeight: i === 0 ? 700 : 400 }}>{t}</p>)}
      </section>
      {s.notes && <p style={{ margin: '12px 0 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{s.notes}</p>}
      <p style={{ margin: '14px 0 0', fontSize: 12.5, color: C.inkSoft }}>{s.disclaimer}</p>
    </article>
  )
}

/** Plan, price, period, and included time, near the top of the report. */
function PlanSummary({ b }: { b: PlanBox }) {
  return (
    <section aria-label="Your plan" style={{ margin: '14px 0 0', background: C.cream, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.teal}`, borderRadius: 12, padding: '12px 14px' }}>
      <dl className={css.facts}>
        {planFacts(b).map(([k, v]) => (
          <div key={k}>
            <dt style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.tealDeep }}>{k}</dt>
            <dd style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{v}</dd>
          </div>
        ))}
      </dl>
      {b.included_minutes > 0 && (
        <p style={{ margin: '10px 0 0', fontSize: 14.5, color: C.ink }}><strong>Time this period:</strong> {b.usage_label}</p>
      )}
      <p style={{ margin: '4px 0 0', fontSize: 13.5, color: C.inkSoft }}>{b.rules.join(' ')}</p>
    </section>
  )
}
