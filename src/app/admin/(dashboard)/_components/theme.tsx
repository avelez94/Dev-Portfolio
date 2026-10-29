'use client'
/**
 * The active admin surface (teal or charcoal) for every admin page. The
 * choice is remembered in this browser so it survives page changes and refresh.
 */
import { createContext, useContext } from 'react'
import { ADMIN_FONTS, ADMIN_THEMES } from '@/lib/admin-theme'

export type Theme = (typeof ADMIN_THEMES)[keyof typeof ADMIN_THEMES]

const CARD_COLORS_LIGHT = ['#2A2220', '#2E2522', '#262020', '#33251F', '#2C2421']
const CARD_COLORS_DARK = ['#123734', '#14332F', '#173B37', '#103230', '#1A3936']

export function themeFor(dark: boolean) {
  const d: Theme = dark ? ADMIN_THEMES.teal : ADMIN_THEMES.charcoal
  const inputStyle = { background: d.surface, borderColor: d.border2, color: d.text, fontFamily: ADMIN_FONTS.body, fontSize: 14, padding: '9px 12px', borderRadius: 10, width: '100%', borderWidth: 1.5, borderStyle: 'solid' as const, minHeight: 40 }
  return { d, dark, inputStyle, cardColors: dark ? CARD_COLORS_DARK : CARD_COLORS_LIGHT }
}

export type ThemeValue = ReturnType<typeof themeFor>
export const ThemeContext = createContext<ThemeValue>(themeFor(true))
export const useTheme = () => useContext(ThemeContext)
