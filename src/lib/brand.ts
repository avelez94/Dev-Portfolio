/**
 * Brand tokens shared by the website, emails, generated PDFs, and document pages.
 * Change a color or name here and every format follows.
 * Copy rule: no dashes in client facing text.
 */

export const BRAND = {
  name: 'Alante Velez',
  mark: 'AV',
  tagline: 'Website design, redesigns, and care',
  email: 'alante@alantevelez.com',
  site: 'alantevelez.com',
  from: 'Alante Velez <alante@alantevelez.com>',
  adminFrom: 'Alante Velez Studio <alante@alantevelez.com>',
} as const

export const COLORS = {
  cream: '#FBF3E8',
  paper: '#FFFAF3',
  ink: '#2A1F1B',
  inkSoft: '#5C4A42',
  muted: '#7A6A62',
  line: '#E8DCCD',
  coral: '#FF6B4F',
  coralDeep: '#B33A26',
  coralSoft: '#FFD9CF',
  rose: '#F2C9C1',
  roseSoft: '#F8E3DE',
  teal: '#2F6B66',
  tealDeep: '#1F4A46',
  tealSoft: '#D8EAE5',
} as const

/** Font stacks. Display falls back to Georgia where Fraunces can't load (most email clients). */
export const FONTS = {
  display: "Fraunces, Georgia, 'Times New Roman', serif",
  body: "Figtree, 'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const

/** jsPDF expects RGB triplets. */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
