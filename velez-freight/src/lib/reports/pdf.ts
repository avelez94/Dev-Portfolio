import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Report } from "@/lib/reports/types";
import { cell } from "@/lib/reports/types";

const NAVY = rgb(20 / 255, 40 / 255, 57 / 255);
const RED = rgb(225 / 255, 37 / 255, 47 / 255);
const GREY = rgb(90 / 255, 100 / 255, 112 / 255);
const LINE = rgb(227 / 255, 222 / 255, 211 / 255);

/** Standard PDF fonts cover WinAnsi only; map common Unicode punctuation and drop the rest. */
export function pdfSafe(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/ /g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else { if (line) out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/** A real text PDF (selectable and searchable), laid out as tables, landscape US Letter. */
export async function reportToPdf(r: Report): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${r.title} - Velez Freight Group`));
  doc.setAuthor("Velez Freight Group");
  doc.setCreator("Velez Freight Group dashboard");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 792, H = 612, M = 40;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const header = (first: boolean) => {
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: RED });
    if (first) {
      page.drawText("VELEZ FREIGHT GROUP", { x: M, y: y - 10, size: 9, font: bold, color: GREY });
      page.drawText(pdfSafe(r.title), { x: M, y: y - 34, size: 20, font: bold, color: NAVY });
      y -= 52;
      for (const line of wrap(r.description, font, 10, W - 2 * M)) { page.drawText(line, { x: M, y, size: 10, font, color: GREY }); y -= 13; }
      page.drawText(pdfSafe(`Period: ${r.period}    Generated: ${r.generatedAt}    Source: ${r.source}`), { x: M, y: y - 4, size: 8, font, color: GREY });
      y -= 22;
    } else {
      page.drawText(pdfSafe(`${r.title} (continued)`), { x: M, y: y - 12, size: 10, font: bold, color: NAVY });
      y -= 26;
    }
  };
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; header(false); };
  const ensure = (h: number) => { if (y - h < M + 20) newPage(); };
  header(true);

  if (r.summary.length) {
    const colW = (W - 2 * M) / Math.min(4, r.summary.length);
    r.summary.forEach((s, i) => {
      if (i % 4 === 0) { ensure(40); if (i) y -= 40; }
      const x = M + (i % 4) * colW;
      page.drawText(pdfSafe(s.label).slice(0, 48), { x, y: y - 10, size: 8, font, color: GREY });
      page.drawText(pdfSafe(s.value), { x, y: y - 26, size: 14, font: bold, color: NAVY });
    });
    y -= 46;
  }

  for (const sec of r.sections) {
    ensure(60);
    page.drawText(pdfSafe(sec.title), { x: M, y: y - 12, size: 12, font: bold, color: NAVY });
    y -= 18;
    if (sec.note) for (const l of wrap(sec.note, font, 8, W - 2 * M)) { page.drawText(l, { x: M, y: y - 8, size: 8, font, color: GREY }); y -= 11; }
    y -= 4;
    // Column widths: wide text columns share space; numeric columns get a fixed width.
    const numeric = (f?: string) => f === "money" || f === "count" || f === "percent";
    const fixed = sec.columns.filter((c) => numeric(c.format) || c.format === "date").length * 78;
    const flex = sec.columns.filter((c) => !numeric(c.format) && c.format !== "date").length || 1;
    const widths = sec.columns.map((c) => (numeric(c.format) || c.format === "date" ? 78 : Math.max(80, (W - 2 * M - fixed) / flex)));
    const drawRow = (vals: string[], isHead: boolean) => {
      const lines = vals.map((v, i) => wrap(v, isHead ? bold : font, 8, widths[i] - 6).slice(0, isHead ? 2 : 4));
      const h = Math.max(...lines.map((l) => l.length)) * 10 + 6;
      ensure(h);
      if (isHead) page.drawRectangle({ x: M, y: y - h, width: W - 2 * M, height: h, color: rgb(247 / 255, 245 / 255, 240 / 255) });
      let x = M;
      lines.forEach((ls, i) => {
        ls.forEach((l, k) => {
          const f = isHead ? bold : font;
          const right = numeric(sec.columns[i].format);
          const tx = right ? x + widths[i] - 4 - f.widthOfTextAtSize(l, 8) : x + 3;
          page.drawText(l, { x: tx, y: y - 11 - k * 10, size: 8, font: f, color: isHead ? NAVY : rgb(0.13, 0.15, 0.17) });
        });
        x += widths[i];
      });
      y -= h;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
    };
    drawRow(sec.columns.map((c) => c.label), true);
    if (!sec.rows.length) drawRow(["No records for this period.", ...sec.columns.slice(1).map(() => "")], false);
    sec.rows.forEach((row) => drawRow(sec.columns.map((c) => cell(row[c.key], c.format)), false));
    y -= 16;
  }
  for (const n of r.notes) { for (const l of wrap(n, font, 8, W - 2 * M)) { ensure(12); page.drawText(l, { x: M, y: y - 8, size: 8, font, color: GREY }); y -= 11; } }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(pdfSafe(`Confidential. Velez Freight Group internal report. Page ${i + 1} of ${pages.length}`), { x: M, y: 20, size: 7, font, color: GREY });
  });
  return doc.save({ useObjectStreams: false });
}
