/**
 * Concise client report PDF (light brand). One page for a typical month; more
 * only when findings need the room. Built only from the frozen snapshot, so the
 * approved PDF matches the approved content exactly. No database access here.
 *
 * Icons are drawn shapes paired with text labels, so meaning never depends on
 * color alone. Copy rule: no dashes in client facing text.
 */
import jsPDF from 'jspdf'
import { BRAND, COLORS as C, rgb } from '@/lib/brand'
import { STATE_LABEL, type Snapshot, type RowState } from './report-model'

const PW = 215.9
const PH = 279.4
const M = 16
const W = PW - M * 2
const BOTTOM = PH - 18
export const SAMPLE_LABEL = 'Sample report • Illustrative findings'

const TONE = {
  passed: { fill: '#E3F2E7', line: '#2E7D4F', text: '#1F5A37' },
  fixed: { fill: '#E3F2E7', line: '#2E7D4F', text: '#1F5A37' },
  issue: { fill: '#FBE3DD', line: '#B33A26', text: '#8E2A19' },
  unverified: { fill: '#FFF2D9', line: '#A86B12', text: '#7A4E0B' },
} as const

export async function reportPdf(s: Snapshot): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = 0
  const set = (font: 'helvetica' | 'times', style: string, size: number, color: string) => {
    doc.setFont(font, style)
    doc.setFontSize(size)
    doc.setTextColor(...rgb(color))
  }
  const lines = (t: string, w: number) => doc.splitTextToSize(String(t || ''), w) as string[]
  const newPage = () => {
    doc.addPage()
    y = 16
    set('helvetica', 'bold', 8, C.coralDeep)
    doc.text(`${s.site.label}  •  ${s.period.label}`, M, 11)
    doc.setDrawColor(...rgb(C.line))
    doc.setLineWidth(0.3)
    doc.line(M, 13, PW - M, 13)
  }
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage() }

  function icon(kind: RowState, cx: number, cy: number, r = 2.2) {
    const t = TONE[kind]
    doc.setFillColor(...rgb(t.line))
    if (kind === 'unverified') {
      doc.triangle(cx, cy - r * 1.1, cx - r * 1.15, cy + r * 0.9, cx + r * 1.15, cy + r * 0.9, 'F')
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.45)
      doc.line(cx, cy - r * 0.45, cx, cy + r * 0.2)
      doc.circle(cx, cy + r * 0.55, 0.18, 'F')
      doc.setFillColor(255, 255, 255)
      doc.circle(cx, cy + r * 0.55, 0.2, 'F')
      return
    }
    doc.circle(cx, cy, r, 'F')
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.5)
    if (kind === 'issue') {
      const k = r * 0.45
      doc.line(cx - k, cy - k, cx + k, cy + k)
      doc.line(cx - k, cy + k, cx + k, cy - k)
    } else {
      doc.line(cx - r * 0.5, cy + r * 0.02, cx - r * 0.12, cy + r * 0.42)
      doc.line(cx - r * 0.12, cy + r * 0.42, cx + r * 0.52, cy - r * 0.4)
    }
  }

  function heading(text: string, kind?: RowState) {
    ensure(14)
    y += 3
    if (kind) icon(kind, M + 2.2, y - 1.3)
    set('helvetica', 'bold', 8.5, C.teal)
    doc.setCharSpace(0.5)
    doc.text(text.toUpperCase(), M + (kind ? 6.5 : 0), y)
    doc.setCharSpace(0)
    y += 5
  }

  function para(text: string, o: { size?: number; color?: string; bold?: boolean; indent?: number; gap?: number; width?: number } = {}) {
    const size = o.size ?? 9.5
    const lh = size * 0.45
    const ls = lines(text, (o.width ?? W) - (o.indent ?? 0))
    for (const l of ls) {
      ensure(lh)
      set('helvetica', o.bold ? 'bold' : 'normal', size, o.color ?? C.inkSoft)
      doc.text(l, M + (o.indent ?? 0), y)
      y += lh
    }
    y += o.gap ?? 1.5
  }

  // ---------- Header ----------
  doc.setFillColor(...rgb(C.cream))
  doc.rect(0, 0, PW, 22, 'F')
  doc.setFillColor(...rgb(C.coral))
  doc.setDrawColor(...rgb(C.ink))
  doc.setLineWidth(0.4)
  doc.roundedRect(M, 6.5, 9, 9, 3.6, 3.6, 'FD')
  set('times', 'bolditalic', 10.5, C.ink)
  doc.text(BRAND.mark, M + 4.5, 12.6, { align: 'center' })
  set('times', 'bold', 12, C.ink)
  doc.text(BRAND.name, M + 12, 10.6)
  set('helvetica', 'normal', 7.5, C.inkSoft)
  doc.text(BRAND.site, M + 12, 14.6)
  set('helvetica', 'bold', 7.5, C.coralDeep)
  doc.setCharSpace(0.5)
  doc.text('MONTHLY HEALTH REPORT', PW - M, 10.6, { align: 'right' })
  doc.setCharSpace(0)
  set('helvetica', 'normal', 8, C.inkSoft)
  doc.text(s.period.label, PW - M, 14.6, { align: 'right' })
  doc.setDrawColor(...rgb(C.ink))
  doc.setLineWidth(0.4)
  doc.line(0, 22, PW, 22)
  y = 31
  if (s.sample) {
    doc.setFillColor(...rgb(C.coralSoft))
    doc.roundedRect(M, 25, W, 6, 1.5, 1.5, 'F')
    set('helvetica', 'bold', 8, C.coralDeep)
    doc.text(SAMPLE_LABEL, PW / 2, 29, { align: 'center' })
    y = 38
  }

  // ---------- Who and what ----------
  set('times', 'bold', 17, C.ink)
  doc.text(s.site.label, M, y)
  y += 5.5
  set('helvetica', 'normal', 8.5, C.inkSoft)
  const who = [s.recipient.name, s.client.business].filter(Boolean).join(', ')
  for (const l of lines(`${who ? `Prepared for ${who}  •  ` : ''}${s.site.url}`, W)) { doc.text(l, M, y); y += 3.8 }
  for (const l of lines(`Reviewed ${s.review_date || 'not yet'}  •  Checked: ${s.scope.line}`, W)) { doc.text(l, M, y); y += 3.8 }
  y += 3

  // ---------- Headline and counts ----------
  set('times', 'bold', 13, C.ink)
  for (const l of lines(s.headline, W)) { doc.text(l, M, y); y += 5.4 }
  y += 1.5
  const tiles: [RowState, number, string][] = [
    ['passed', s.counts.passed, s.counts.fixed ? `Passed (${s.counts.fixed} fixed)` : 'Passed'],
    ['issue', s.counts.issues, s.counts.issues === 1 ? 'Issue found' : 'Issues found'],
    ['unverified', s.counts.unverified, 'Not verified'],
  ]
  const tw = (W - 6) / 3
  tiles.forEach(([k, n, label], i) => {
    const x = M + i * (tw + 3)
    doc.setFillColor(...rgb(TONE[k].fill))
    doc.setDrawColor(...rgb(TONE[k].line))
    doc.setLineWidth(0.35)
    doc.roundedRect(x, y, tw, 14, 2.5, 2.5, 'FD')
    icon(k, x + 6, y + 7, 2.6)
    set('times', 'bold', 16, TONE[k].text)
    doc.text(String(n), x + 11.5, y + 8.8)
    const numW = doc.getTextWidth(String(n))
    set('helvetica', 'bold', 8.5, TONE[k].text)
    doc.text(label, x + 11.5 + numW + 2.5, y + 8.2)
  })
  y += 19

  if (s.summary) para(s.summary, { size: 9.5, color: C.ink, gap: 2 })

  // ---------- Needs attention ----------
  if (s.attention.length) {
    heading('Needs attention', 'issue')
    for (const a of s.attention) {
      const body = [
        `What’s wrong: ${a.what}`,
        ...(a.why ? [`Why it matters: ${a.why}`] : []),
        ...(a.pages.length ? [`Where: ${a.pages.join(', ')}${a.devices.length ? ` (${a.devices.join(' and ')})` : ''}`] : []),
        ...(a.note ? [`Next: ${a.status}: ${a.note}`] : []),
      ]
      set('helvetica', 'normal', 8.8, C.inkSoft)
      const bl = body.flatMap((b) => lines(b, W - 12))
      const h = 7 + bl.length * 3.9 + 2
      ensure(h + 2)
      doc.setFillColor(...rgb('#FFF7F5'))
      doc.setDrawColor(...rgb(TONE.issue.line))
      doc.setLineWidth(0.3)
      doc.roundedRect(M, y - 1, W, h, 2, 2, 'FD')
      icon('issue', M + 4.5, y + 2.6)
      set('helvetica', 'bold', 9.5, C.ink)
      doc.text(a.title, M + 9, y + 3.6)
      set('helvetica', 'bold', 8, TONE.issue.text)
      doc.text(a.status, PW - M - 3, y + 3.6, { align: 'right' })
      let yy = y + 8
      set('helvetica', 'normal', 8.8, C.inkSoft)
      for (const l of bl) { doc.text(l, M + 9, yy); yy += 3.9 }
      y += h + 2.5
    }
  }

  if (s.fixed.length) {
    heading('Fixed and verified', 'fixed')
    for (const f of s.fixed) para(`${f.title}${f.pages.length ? `: ${f.pages.join(', ')}` : ''}. Verified: ${f.verified}${f.note ? ` ${f.note}` : ''}`, { size: 8.8, indent: 6.5, gap: 1 })
  }

  // ---------- Checklist: two columns, row dividers, a thin divider between columns ----------
  const GUT = 10
  const colW = (W - GUT) / 2
  const rows = s.checklist
  const half = Math.ceil(rows.length / 2)
  const cols = [rows.slice(0, half), rows.slice(half)]
  const rowH = (r: (typeof rows)[number]) => {
    set('helvetica', 'bold', 8.8, C.ink)
    const ll = lines(r.label, colW - 30).length
    set('helvetica', 'normal', 7.6, C.muted)
    return 3.4 + ll * 3.6 + (r.note ? lines(r.note, colW - 7).length * 3.2 : 0)
  }
  const colHeights = cols.map((c) => c.reduce((a, r) => a + rowH(r), 0))
  // Keep the heading with the whole checklist.
  ensure(Math.max(...colHeights) + 16)
  heading('This month’s checks')
  const top = y - 3
  cols.forEach((col, ci) => {
    let yy = top
    const x = M + ci * (colW + GUT)
    for (const r of col) {
      const h = rowH(r)
      const base = yy + 4.2
      icon(r.state, x + 2.2, base - 1.1, 1.9)
      set('helvetica', 'bold', 7.8, TONE[r.state].text)
      doc.text(STATE_LABEL[r.state], x + colW, base, { align: 'right' })
      let ty = base
      set('helvetica', 'bold', 8.8, C.ink)
      for (const l of lines(r.label, colW - 30)) { doc.text(l, x + 6, ty); ty += 3.6 }
      if (r.note) {
        set('helvetica', 'normal', 7.6, C.muted)
        for (const l of lines(r.note, colW - 7)) { doc.text(l, x + 6, ty); ty += 3.2 }
      }
      yy += h
      doc.setDrawColor(...rgb(C.line))
      doc.setLineWidth(0.25)
      doc.line(x, yy, x + colW, yy)
    }
  })
  doc.setDrawColor(...rgb(C.line))
  doc.setLineWidth(0.25)
  doc.line(M + colW + GUT / 2, top + 1, M + colW + GUT / 2, top + Math.max(...colHeights) - 1)
  y = top + Math.max(...colHeights) + 4
  if (s.not_applicable.length) para(`Not part of this month: ${s.not_applicable.join(', ')}.`, { size: 7.8, color: C.muted, gap: 1 })

  // ---------- Not verified ----------
  if (s.not_verified.length) {
    heading('Not verified this month', 'unverified')
    for (const n of s.not_verified) para(`${n.label}${n.pages.length ? ` (${n.pages.join(', ')})` : ''}: ${n.why}`, { size: 8.8, indent: 6.5, gap: 0.8 })
  }

  // ---------- Work this month ----------
  if (s.work.fixes || s.work.investigated || s.work.outstanding) {
    heading('What I did')
    if (s.work.fixes) para(`Fixed: ${s.work.fixes}`, { size: 8.8, gap: 1 })
    if (s.work.investigated) para(`Looked into: ${s.work.investigated}`, { size: 8.8, gap: 1 })
    if (s.work.outstanding) para(`Still open: ${s.work.outstanding}`, { size: 8.8, gap: 1 })
  }

  // ---------- Next step ----------
  const nextLines: string[] = []
  if (s.next_step.none) nextLines.push('No action needed.')
  for (const t of s.next_step.send) nextLines.push(`Please send: ${t}`)
  for (const t of s.next_step.approve) nextLines.push(`Approval needed for: ${t}`)
  if (s.next_step.estimate && s.next_step.approve.length) nextLines.push(`Estimate: ${s.next_step.estimate}. Nothing starts until you approve it.`)
  if (s.next_step.why_extra) nextLines.push(`Why this is extra: ${s.next_step.why_extra}`)
  if (s.next_step.more) nextLines.push(s.next_step.more)
  set('helvetica', 'bold', 9.5, C.ink)
  const nl = nextLines.flatMap((l, i) => { set('helvetica', i === 0 ? 'bold' : 'normal', 9.2, C.ink); return lines(l, W - 10) })
  const nh = 8 + nl.length * 4.2
  ensure(nh + 4)
  y += 2
  doc.setFillColor(...rgb(C.tealSoft))
  doc.setDrawColor(...rgb(C.ink))
  doc.setLineWidth(0.35)
  doc.roundedRect(M, y, W, nh, 2.5, 2.5, 'FD')
  set('helvetica', 'bold', 8, C.tealDeep)
  doc.setCharSpace(0.5)
  doc.text('NEXT STEP', M + 5, y + 5)
  doc.setCharSpace(0)
  let ny = y + 9.5
  nl.forEach((l, i) => { set('helvetica', i === 0 ? 'bold' : 'normal', 9.2, C.ink); doc.text(l, M + 5, ny); ny += 4.2 })
  y += nh + 4

  if (s.notes) para(s.notes, { size: 8.8, gap: 2 })
  para(s.allowance, { size: 7.6, color: C.muted, gap: 0.6 })
  para(s.disclaimer, { size: 7.6, color: C.muted, gap: 0 })

  // ---------- Footers ----------
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(...rgb(C.line))
    doc.setLineWidth(0.3)
    doc.line(M, PH - 12, PW - M, PH - 12)
    set('helvetica', s.sample ? 'bold' : 'normal', 7.5, s.sample ? C.coralDeep : C.muted)
    doc.text(s.sample ? SAMPLE_LABEL : `${BRAND.site}  •  ${BRAND.email}`, M, PH - 7.5)
    set('helvetica', 'normal', 7.5, C.muted)
    doc.text(`Version ${s.version}  •  Page ${i} of ${n}`, PW - M, PH - 7.5, { align: 'right' })
  }
  doc.setProperties({ title: `${s.sample ? 'Sample ' : ''}Monthly health report, ${s.site.label}`, creator: BRAND.name })
  return Buffer.from(doc.output('arraybuffer'))
}
