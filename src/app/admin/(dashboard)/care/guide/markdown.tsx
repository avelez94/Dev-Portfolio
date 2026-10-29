/**
 * A small Markdown renderer for the owner's guide (docs/WEBSITE_CARE_GUIDE.md):
 * headings, paragraphs, lists, tables, images, quotes, bold, code, and links.
 * Enough for that one file; it is not a general Markdown implementation.
 */
import type { ReactNode } from 'react'

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function inline(text: string, img: (src: string) => string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    // eslint-disable-next-line @next/next/no-img-element -- admin only screenshots served by their own route
    if (m[1]) out.push(<img key={k++} src={img(m[3])} alt={m[2]} className="guide-shot" loading="lazy" />)
    else if (m[4]) {
      const href = m[6].startsWith('#') || m[6].startsWith('/') || m[6].startsWith('http') ? m[6] : `https://github.com/avelez94/Dev-Portfolio/blob/feature/website-care/docs/${m[6]}`
      out.push(<a key={k++} href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>{m[5]}</a>)
    } else if (m[7]) out.push(<b key={k++}>{m[8]}</b>)
    else if (m[9]) out.push(<code key={k++}>{m[10]}</code>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export type Section = { id: string; title: string; text: string; body: ReactNode[] }

/** Splits the guide into sections at each "## " heading and renders each one. */
export function renderGuide(md: string, img: (src: string) => string): { title: string; intro: ReactNode[]; sections: Section[] } {
  const lines = md.replace(/\r/g, '').split('\n')
  let title = ''
  const intro: ReactNode[] = []
  const sections: Section[] = []
  let cur: Section | null = null
  let i = 0
  let k = 0
  const push = (n: ReactNode) => (cur ? cur.body : intro).push(n)
  while (i < lines.length) {
    const line = lines[i]
    if (/^# /.test(line)) { title = line.slice(2).trim(); i++; continue }
    if (/^## /.test(line)) {
      const t = line.slice(3).trim()
      cur = { id: slug(t), title: t, text: t, body: [] }
      sections.push(cur)
      i++
      continue
    }
    if (cur) cur.text += '\n' + line
    if (/^#{3,4} /.test(line)) {
      const t = line.replace(/^#+ /, '').trim()
      push(line.startsWith('####') ? <h4 key={k++} id={slug(t)}>{inline(t, img)}</h4> : <h3 key={k++} id={slug(t)}>{inline(t, img)}</h3>)
      i++
      continue
    }
    if (/^\s*$/.test(line)) { i++; continue }
    if (/^\|/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (!/^\|\s*:?-{3}/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i++
        if (cur) cur.text += '\n' + (lines[i] || '')
      }
      const [head, ...body] = rows
      push(<div key={k++} className="care-scroll"><table className="care-table"><thead><tr>{head.map((c, j) => <th key={j}>{inline(c, img)}</th>)}</tr></thead><tbody>{body.map((r, j) => <tr key={j}>{r.map((c, n) => <td key={n}>{inline(c, img)}</td>)}</tr>)}</tbody></table></div>)
      continue
    }
    if (/^\s*([-*]|\d+\.) /.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.) /, '')
        if (/^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += '\n' + item; i++; continue }
        i++
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.) /.test(lines[i])) item += ' ' + lines[i++].trim()
        items.push(item)
        if (cur) cur.text += '\n' + item
      }
      const li = items.map((it, j) => {
        const [first, ...sub] = it.split('\n')
        return <li key={j}>{inline(first, img)}{sub.length > 0 && <ul>{sub.map((x, n) => <li key={n}>{inline(x, img)}</li>)}</ul>}</li>
      })
      push(ordered ? <ol key={k++}>{li}</ol> : <ul key={k++}>{li}</ul>)
      continue
    }
    if (/^> /.test(line)) {
      const q: string[] = []
      while (i < lines.length && /^> ?/.test(lines[i])) q.push(lines[i++].replace(/^> ?/, ''))
      push(<blockquote key={k++}>{inline(q.join(' '), img)}</blockquote>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|\s*([-*]|\d+\.) )/.test(lines[i])) para.push(lines[i++].trim())
    if (cur) cur.text += '\n' + para.join(' ')
    push(<p key={k++}>{inline(para.join(' '), img)}</p>)
  }
  return { title, intro, sections }
}
