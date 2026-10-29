/**
 * The complete client report as email markup (tables and inline styles only,
 * so it holds up in Gmail, Apple Mail, and Outlook). Built from the same
 * approved snapshot as the attached PDF. Symbols always sit next to a text
 * label. Private notes and technical logs are never in the snapshot.
 * Copy rule: no dashes in client facing text.
 */
import { COLORS as C, FONTS } from '@/lib/brand'
import { esc, escLines, type Block } from '@/lib/email/layout'
import type { Snapshot, RowState } from './report-model'

const TONE: Record<RowState, { fill: string; line: string; text: string; sym: string }> = {
  passed: { fill: '#E3F2E7', line: '#2E7D4F', text: '#1F5A37', sym: '&#10003;' },
  fixed: { fill: '#E3F2E7', line: '#2E7D4F', text: '#1F5A37', sym: '&#10003;' },
  issue: { fill: '#FBE3DD', line: '#B33A26', text: '#8E2A19', sym: '&#10007;' },
  unverified: { fill: '#FFF2D9', line: '#A86B12', text: '#7A4E0B', sym: '!' },
}
const LABEL: Record<RowState, string> = { passed: 'Passed', issue: 'Issue found', unverified: 'Not verified', fixed: 'Fixed and verified' }
const SYM_TEXT: Record<RowState, string> = { passed: '[OK]', fixed: '[OK]', issue: '[X]', unverified: '[!]' }

const body = `font-family:${FONTS.body};color:${C.inkSoft};`
const badge = (k: RowState, size = 20) =>
  `<span style="display:inline-block;width:${size}px;height:${size}px;line-height:${size}px;border-radius:${size}px;background:${TONE[k].line};color:#ffffff;font-family:Arial,sans-serif;font-size:${Math.round(size * 0.6)}px;font-weight:700;text-align:center;">${TONE[k].sym}</span>`
const heading = (t: string, k?: RowState) =>
  `<div style="${body}margin:22px 0 8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.teal};">${k ? badge(k, 16) + '&nbsp;&nbsp;' : ''}${esc(t)}</div>`

function nextLines(s: Snapshot): string[] {
  const n: string[] = []
  if (s.next_step.none) n.push('No action needed.')
  s.next_step.send.forEach((t) => n.push(`Please send: ${t}`))
  s.next_step.approve.forEach((t) => n.push(`Approval needed for: ${t}`))
  if (s.next_step.estimate && s.next_step.approve.length) n.push(`Estimate: ${s.next_step.estimate}. Nothing starts until you approve it.`)
  if (s.next_step.why_extra) n.push(`Why this is extra: ${s.next_step.why_extra}`)
  if (s.next_step.more) n.push(s.next_step.more)
  return n
}

export function reportEmailBlock(s: Snapshot): Block {
  const h: string[] = []
  const t: string[] = []

  // Who, when, scope
  h.push(`<div style="${body}font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.coralDeep};">Monthly health report &bull; ${esc(s.period.label)}${s.sample ? ' &bull; Sample' : ''}</div>`)
  h.push(`<div style="font-family:${FONTS.display};font-size:22px;line-height:28px;font-weight:700;color:${C.ink};margin:4px 0 2px;">${esc(s.site.label)}</div>`)
  h.push(`<div style="${body}font-size:14px;line-height:21px;">${esc(s.site.url)}<br>Reviewed ${esc(s.review_date || 'not yet')} &bull; Checked: ${esc(s.scope.line)}</div>`)
  t.push(`MONTHLY HEALTH REPORT, ${s.period.label}`, s.site.label, s.site.url, `Reviewed ${s.review_date || 'not yet'}. Checked: ${s.scope.line}`, '')

  // Headline and counts
  h.push(`<div style="font-family:${FONTS.display};font-size:18px;line-height:25px;font-weight:700;color:${C.ink};margin:16px 0 10px;">${esc(s.headline)}</div>`)
  const tiles: [RowState, number, string][] = [
    ['passed', s.counts.passed, s.counts.fixed ? `Passed (${s.counts.fixed} fixed)` : 'Passed'],
    ['issue', s.counts.issues, s.counts.issues === 1 ? 'Issue found' : 'Issues found'],
    ['unverified', s.counts.unverified, 'Not verified'],
  ]
  h.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;"><tr>${tiles.map(([k, n, label], i) =>
    `<td class="col2" width="33%" valign="top" style="padding:0 ${i < 2 ? 6 : 0}px 8px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${TONE[k].fill}" style="background:${TONE[k].fill};border:1.5px solid ${TONE[k].line};border-radius:12px;padding:10px 12px;${body}color:${TONE[k].text};font-size:14px;font-weight:700;">${badge(k)}&nbsp; <span style="font-family:${FONTS.display};font-size:22px;">${n}</span>&nbsp; ${esc(label)}</td></tr></table></td>`).join('')}</tr></table>`)
  t.push(s.headline, tiles.map(([k, n, label]) => `${SYM_TEXT[k]} ${n} ${label}`).join('   '), '')
  if (s.summary) { h.push(`<p style="${body}font-size:15px;line-height:23px;color:${C.ink};margin:10px 0 0;">${escLines(s.summary)}</p>`); t.push(s.summary, '') }

  // Needs attention
  if (s.attention.length) {
    h.push(heading('Needs attention', 'issue'))
    t.push('NEEDS ATTENTION')
    for (const a of s.attention) {
      const where = a.pages.length ? `${a.pages.join(', ')}${a.devices.length ? ` (${a.devices.join(' and ')})` : ''}` : ''
      h.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;"><tr><td bgcolor="#FFF7F5" style="background:#FFF7F5;border:1.5px solid ${TONE.issue.line};border-radius:12px;padding:12px 14px;${body}font-size:14px;line-height:21px;">
${badge('issue', 18)}&nbsp; <strong style="color:${C.ink};font-size:15px;">${esc(a.title)}</strong> &nbsp;<span style="color:${TONE.issue.text};font-weight:700;font-size:13px;">${esc(a.status)}</span><br>
<strong>What’s wrong:</strong> ${esc(a.what)}<br>${a.why ? `<strong>Why it matters:</strong> ${esc(a.why)}<br>` : ''}${where ? `<strong>Where:</strong> ${esc(where)}<br>` : ''}${a.note ? `<strong>Next:</strong> ${esc(a.status)}: ${esc(a.note)}` : ''}
</td></tr></table>`)
      t.push(`[X] ${a.title} (${a.status})`, `  What's wrong: ${a.what}`, ...(a.why ? [`  Why it matters: ${a.why}`] : []), ...(where ? [`  Where: ${where}`] : []), ...(a.note ? [`  Next: ${a.status}: ${a.note}`] : []))
    }
    t.push('')
  }
  if (s.fixed.length) {
    h.push(heading('Fixed and verified', 'fixed'))
    t.push('FIXED AND VERIFIED')
    for (const f of s.fixed) {
      const line = `${f.title}${f.pages.length ? `: ${f.pages.join(', ')}` : ''}. Verified: ${f.verified}${f.note ? ` ${f.note}` : ''}`
      h.push(`<div style="${body}font-size:14px;line-height:21px;margin:0 0 4px;">${badge('fixed', 16)}&nbsp; ${esc(line)}</div>`)
      t.push(`[OK] ${line}`)
    }
    t.push('')
  }

  // Checklist: two columns with dividers, stacking to one on phones
  const half = Math.ceil(s.checklist.length / 2)
  const col = (rows: Snapshot['checklist']) => rows.map((r) =>
    `<tr><td valign="top" width="22" style="padding:9px 0;border-bottom:1px solid ${C.line};">${badge(r.state, 18)}</td><td valign="top" style="padding:9px 8px;border-bottom:1px solid ${C.line};${body}font-size:14px;line-height:19px;"><strong style="color:${C.ink};">${esc(r.label)}</strong>${r.note ? `<br><span style="font-size:12.5px;color:${C.inkSoft};">${esc(r.note)}</span>` : ''}</td><td valign="top" align="right" style="padding:9px 0;border-bottom:1px solid ${C.line};${body}font-size:12.5px;font-weight:700;color:${TONE[r.state].text};white-space:nowrap;">${LABEL[r.state]}</td></tr>`).join('')
  h.push(heading('This month’s checks'))
  h.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="col2" width="50%" valign="top" style="padding-right:12px;border-right:1px solid ${C.line};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${col(s.checklist.slice(0, half))}</table></td>
<td class="col2" width="50%" valign="top" style="padding-left:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${col(s.checklist.slice(half))}</table></td>
</tr></table>`)
  t.push("THIS MONTH'S CHECKS", ...s.checklist.map((r) => `${SYM_TEXT[r.state]} ${r.label}: ${LABEL[r.state]}${r.note ? ` (${r.note})` : ''}`))
  if (s.not_applicable.length) {
    h.push(`<div style="${body}font-size:12.5px;line-height:18px;margin:6px 0 0;">Not part of this month: ${esc(s.not_applicable.join(', '))}.</div>`)
    t.push(`Not part of this month: ${s.not_applicable.join(', ')}.`)
  }
  t.push('')

  if (s.not_verified.length) {
    h.push(heading('Not verified this month', 'unverified'))
    t.push('NOT VERIFIED THIS MONTH')
    for (const n of s.not_verified) {
      const line = `${n.label}${n.pages.length ? ` (${n.pages.join(', ')})` : ''}`
      h.push(`<div style="${body}font-size:14px;line-height:21px;margin:0 0 6px;">${badge('unverified', 16)}&nbsp; <strong style="color:${C.ink};">${esc(line)}:</strong> ${esc(n.why)}</div>`)
      t.push(`[!] ${line}: ${n.why}`)
    }
    t.push('')
  }

  if (s.work.fixes || s.work.investigated || s.work.outstanding) {
    h.push(heading('What I did'))
    t.push('WHAT I DID')
    for (const [k, v] of [['Fixed', s.work.fixes], ['Looked into', s.work.investigated], ['Still open', s.work.outstanding]] as const) {
      if (!v) continue
      h.push(`<p style="${body}font-size:14px;line-height:21px;margin:0 0 6px;"><strong style="color:${C.ink};">${k}:</strong> ${escLines(v)}</p>`)
      t.push(`${k}: ${v}`)
    }
    t.push('')
  }

  const next = nextLines(s)
  h.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;"><tr><td bgcolor="${C.tealSoft}" style="background:${C.tealSoft};border:1.5px solid ${C.ink};border-radius:12px;padding:12px 14px;${body}color:${C.ink};font-size:14px;line-height:21px;">
<div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.tealDeep};">Next step</div>
${next.map((l, i) => `<div style="margin-top:4px;${i === 0 ? 'font-weight:700;font-size:15px;' : ''}">${esc(l)}</div>`).join('')}
</td></tr></table>`)
  t.push('NEXT STEP', ...next, '')
  if (s.notes) { h.push(`<p style="${body}font-size:14px;line-height:21px;margin:12px 0 0;">${escLines(s.notes)}</p>`); t.push(s.notes, '') }
  h.push(`<p style="${body}font-size:12.5px;line-height:18px;margin:14px 0 0;">${esc(s.allowance)}<br>${esc(s.disclaimer)}</p>`)
  t.push(s.allowance, s.disclaimer)

  return {
    type: 'html',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td style="border-top:1px solid ${C.line};padding-top:16px;">${h.join('\n')}</td></tr></table>`,
    text: t.join('\n'),
  }
}
