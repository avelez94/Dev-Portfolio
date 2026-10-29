/**
 * Admin area colors: the public brand (cream, coral, teal, Fraunces and Figtree),
 * turned dark so the admin is recognizable at a glance. Client facing pages,
 * emails, and documents keep the light brand; this file is only for /admin.
 *
 * Two surface variants share every text and action color:
 *   teal      deep teal panels on a warm charcoal canvas (default)
 *   charcoal  warm charcoal panels throughout, teal kept for accents
 * Text colors meet WCAG AA (4.5:1) on every surface they're used on.
 */
export const ADMIN_INK = '#1A1412' // text on coral buttons
export const ADMIN_CORAL = '#FF6B4F' // primary action background

const shared = {
  text: '#FBF3E8',
  text2: '#E4D7C6',
  text3: '#C3B5A3',
  border: 'rgba(251,243,232,0.16)',
  border2: 'rgba(251,243,232,0.3)',
  accent: '#FF8A70', // coral, lightened so it reads as text on dark surfaces
  accentBg: 'rgba(255,107,79,0.18)',
  green: '#173D2C',
  greenText: '#9BE3B6',
  amber: '#3B2E16',
  amberText: '#F6CB86',
  red: '#46211B',
  redText: '#FFA897',
}

export const ADMIN_THEMES = {
  teal: {
    ...shared,
    bg: '#1C1614',
    white: '#10302D',
    surface: '#173B37',
    surface2: '#1D4540',
    surface3: '#244F49',
    sand: '#123734',
    linen: '#14332F',
    pebble: '#173B37',
    blush: '#2C2320',
  },
  charcoal: {
    ...shared,
    bg: '#141010',
    white: '#221C1A',
    surface: '#2B2422',
    surface2: '#342C29',
    surface3: '#3D3431',
    sand: '#2A2220',
    linen: '#12302D',
    pebble: '#262020',
    blush: '#33251F',
  },
} as const

export type AdminTheme = (typeof ADMIN_THEMES)['teal']

export const ADMIN_FONTS = {
  display: "var(--font-display), Georgia, 'Times New Roman', serif",
  body: "var(--font-body), 'Helvetica Neue', Helvetica, Arial, sans-serif",
}
