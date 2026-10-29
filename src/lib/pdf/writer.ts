/**
 * Branded PDF writer for newly generated documents (proposals, SOWs,
 * contracts, invoices). Works in the browser (admin) and on the server.
 *
 * Restrained branding: a cream header band with the AV mark on page one,
 * a slim running header after that, page numbers on every page, and section
 * headings that never strand at the bottom of a page.
 *
 * Fonts: jsPDF only ships PDF base fonts, so Times Bold stands in for the
 * Fraunces headings and Helvetica for body text.
 */
import jsPDF from 'jspdf'
import { BRAND, COLORS as C, rgb } from '@/lib/brand'

const PAGE_W = 215.9
const PAGE_H = 279.4
const M = 20 // side margin (mm)
const TOP = 24 // body top on continuation pages
const BOTTOM = PAGE_H - 22 // last usable line before the footer
const W = PAGE_W - M * 2

type Color = keyof typeof C

export type BrandedPdf = ReturnType<typeof createBrandedPdf>

export function createBrandedPdf(opts: { docType: string; title: string; subtitle?: string }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = 0

  const fill = (c: Color) => doc.setFillColor(...rgb(C[c]))
  const stroke = (c: Color) => doc.setDrawColor(...rgb(C[c]))
  const color = (c: Color) => doc.setTextColor(...rgb(C[c]))

  function mark(x: number, top: number, size: number) {
    fill('coral')
    stroke('ink')
    doc.setLineWidth(0.6)
    doc.roundedRect(x, top, size, size, size * 0.42, size * 0.42, 'FD')
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(size * 1.25)
    color('ink')
    doc.text(BRAND.mark, x + size / 2, top + size * 0.66, { align: 'center' })
  }

  function firstPageHeader() {
    fill('cream')
    doc.rect(0, 0, PAGE_W, 46, 'F')
    fill('rose')
    doc.circle(PAGE_W - 6, -4, 26, 'F')
    mark(M, 13, 11)
    doc.setFont('times', 'bold')
    doc.setFontSize(15)
    color('ink')
    doc.text(BRAND.name, M + 15, 18.6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    color('inkSoft')
    doc.text(`${BRAND.tagline}  •  ${BRAND.site}`, M + 15, 23.4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    color('coralDeep')
    doc.setCharSpace(0.6)
    doc.text(opts.docType.toUpperCase(), PAGE_W - M, 18.6, { align: 'right' })
    doc.setCharSpace(0)
    stroke('ink')
    doc.setLineWidth(0.5)
    doc.line(0, 46, PAGE_W, 46)

    y = 60
    doc.setFont('times', 'bold')
    doc.setFontSize(22)
    color('ink')
    const lines = doc.splitTextToSize(opts.title, W)
    lines.forEach((l: string) => {
      doc.text(l, M, y)
      y += 9
    })
    if (opts.subtitle) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      color('inkSoft')
      doc.splitTextToSize(opts.subtitle, W).forEach((l: string) => {
        doc.text(l, M, y)
        y += 5.4
      })
    }
    y += 4
  }

  function runningHeader() {
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    color('ink')
    doc.text(BRAND.name, M, 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    color('coralDeep')
    doc.setCharSpace(0.5)
    doc.text(opts.docType.toUpperCase(), PAGE_W - M, 14, { align: 'right' })
    doc.setCharSpace(0)
    stroke('line')
    doc.setLineWidth(0.3)
    doc.line(M, 17, PAGE_W - M, 17)
    y = TOP
  }

  function newPage() {
    doc.addPage()
    runningHeader()
  }

  /** Breaks the page if fewer than `h` mm remain. */
  function ensure(h: number) {
    if (y + h > BOTTOM) newPage()
  }

  const api = {
    doc,
    get y() {
      return y
    },
    set y(v: number) {
      y = v
    },
    ensure,
    newPage,

    space(mm = 4) {
      y += mm
    },

    /** Section heading. Keeps itself with at least two lines of what follows. */
    heading(text: string) {
      ensure(22)
      y += 3
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      color('teal')
      doc.setCharSpace(0.7)
      doc.text(text.toUpperCase(), M, y)
      doc.setCharSpace(0)
      fill('coral')
      doc.rect(M, y + 1.8, 10, 0.9, 'F')
      y += 8
    },

    text(text: string, o: { size?: number; bold?: boolean; color?: Color; indent?: number; gap?: number; serif?: boolean } = {}) {
      const size = o.size ?? 10.5
      const lh = size * 0.5
      doc.setFont(o.serif ? 'times' : 'helvetica', o.bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      color(o.color ?? 'inkSoft')
      const indent = o.indent ?? 0
      const style = () => {
        doc.setFont(o.serif ? 'times' : 'helvetica', o.bold ? 'bold' : 'normal')
        doc.setFontSize(size)
        color(o.color ?? 'inkSoft')
      }
      const lines: string[] = doc.splitTextToSize(String(text ?? ''), W - indent)
      lines.forEach((l) => {
        ensure(lh)
        style() // a page break draws the running header, which changes the font and color
        doc.text(l, M + indent, y)
        y += lh
      })
      y += o.gap ?? 2.5
    },

    /** Label and value rows, e.g. dates and amounts. */
    rows(items: [string, string][], o: { labelWidth?: number; emphasizeLast?: boolean } = {}) {
      const lw = o.labelWidth ?? 52
      items.forEach(([label, value], i) => {
        const strong = o.emphasizeLast && i === items.length - 1
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10.5)
        const vLines: string[] = doc.splitTextToSize(String(value ?? ''), W - lw)
        const h = Math.max(1, vLines.length) * 5.2 + 2.4
        ensure(h)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        color('ink')
        doc.text(label, M, y)
        doc.setFont('helvetica', strong ? 'bold' : 'normal')
        doc.setFontSize(10.5)
        color(strong ? 'ink' : 'inkSoft')
        vLines.forEach((l, j) => doc.text(l, M + lw, y + j * 5.2))
        y += h
        stroke('line')
        doc.setLineWidth(0.2)
        doc.line(M, y - 3.4, PAGE_W - M, y - 3.4)
      })
      y += 2
    },

    /** Money table: description on the left, amount on the right. */
    amounts(items: [string, string][], total?: [string, string]) {
      const all = [...items.map((r) => ({ r, total: false })), ...(total ? [{ r: total, total: true }] : [])]
      all.forEach(({ r: [d, a], total: t }) => {
        doc.setFont('helvetica', t ? 'bold' : 'normal')
        doc.setFontSize(t ? 11.5 : 10.5)
        const lines: string[] = doc.splitTextToSize(d, W - 40)
        const h = lines.length * 5.2 + 3
        ensure(h + (t ? 2 : 0))
        if (t) {
          fill('cream')
          doc.rect(M, y - 4.6, W, h + 1, 'F')
        }
        color('ink')
        lines.forEach((l, j) => doc.text(l, M + (t ? 2 : 0), y + j * 5.2))
        doc.text(a, PAGE_W - M - (t ? 2 : 0), y, { align: 'right' })
        y += h
        if (!t) {
          stroke('line')
          doc.setLineWidth(0.2)
          doc.line(M, y - 3.6, PAGE_W - M, y - 3.6)
        }
      })
      y += 3
    },

    /** Numbered clause with title, for contract terms. Title stays with its first lines. */
    clause(title: string, body: string) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const lines: string[] = doc.splitTextToSize(body, W)
      ensure(Math.min(lines.length, 3) * 5 + 8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      color('ink')
      doc.text(title, M, y)
      y += 5.4
      doc.setFont('helvetica', 'normal')
      color('inkSoft')
      lines.forEach((l) => {
        ensure(5)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        color('inkSoft')
        doc.text(l, M, y)
        y += 5
      })
      y += 3.5
    },

    callout(title: string, body: string) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const lines: string[] = doc.splitTextToSize(body, W - 10)
      const h = lines.length * 5 + 13
      ensure(h)
      fill('tealSoft')
      stroke('ink')
      doc.setLineWidth(0.4)
      doc.roundedRect(M, y - 2, W, h, 3, 3, 'FD')
      doc.setFont('times', 'bold')
      doc.setFontSize(11.5)
      color('ink')
      doc.text(title, M + 5, y + 4.4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      lines.forEach((l, j) => doc.text(l, M + 5, y + 10 + j * 5))
      y += h + 4
    },

    divider() {
      ensure(6)
      stroke('line')
      doc.setLineWidth(0.3)
      doc.line(M, y, PAGE_W - M, y)
      y += 6
    },

    /** Adds page footers. Call once, right before saving or exporting. */
    finish() {
      const n = doc.getNumberOfPages()
      for (let i = 1; i <= n; i++) {
        doc.setPage(i)
        stroke('line')
        doc.setLineWidth(0.3)
        doc.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        color('muted')
        doc.text(`${BRAND.site}  •  ${BRAND.email}`, M, PAGE_H - 9)
        doc.text(`Page ${i} of ${n}`, PAGE_W - M, PAGE_H - 9, { align: 'right' })
      }
      return doc
    },
  }

  firstPageHeader()
  return api
}

export const PDF_PAGE = { W: PAGE_W, H: PAGE_H, M, BOTTOM }
