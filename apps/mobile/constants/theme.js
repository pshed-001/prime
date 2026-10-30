// Design tokens (design doc 13.2 / 13.3). No colour may be used outside this
// table. No shadows, no pill buttons, max border radius 8px.
import { useColorScheme } from 'react-native'
import { useSettingsStore } from '../store/settings.js'

export const colors = {
  light: {
    primary: '#059669',
    secondary: '#0d9488',
    warningRed: '#EF4444',
    successGreen: '#10B981',
    warningAmber: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    estimated: '#d97706',
    critical: '#EF4444',
    high: '#f59e0b',
    medium: '#0d9488',
    low: '#9ca3af'
  },
  dark: {
    primary: '#34d399',
    secondary: '#2dd4bf',
    warningRed: '#f87171',
    successGreen: '#34d399',
    warningAmber: '#fbbf24',
    background: '#0f172a',
    surface: '#1e293b',
    border: '#334155',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    estimated: '#d97706',
    critical: '#f87171',
    high: '#fbbf24',
    medium: '#2dd4bf',
    low: '#9ca3af'
  },
  priority: { CRITICAL: '#EF4444', HIGH: '#f59e0b', MEDIUM: '#0d9488', LOW: '#9ca3af' }
}

// Resolve the active palette from the user's theme preference (system/light/dark).
// Screens and components must consume this instead of the static `colors` table
// so that dark mode actually changes the background (design doc 13.3).
export function useTheme() {
  const theme = useSettingsStore((s) => s.theme)
  const scheme = useColorScheme()
  const isDark = theme === 'dark' || (theme === 'system' && scheme === 'dark')
  return isDark ? colors.dark : colors.light
}

export function useIsDark() {
  const theme = useSettingsStore((s) => s.theme)
  const scheme = useColorScheme()
  return theme === 'dark' || (theme === 'system' && scheme === 'dark')
}

export const typography = {
  display: { fontSize: 32, fontWeight: '700' },
  h1: { fontSize: 24, fontWeight: '600' },
  h2: { fontSize: 18, fontWeight: '600' },
  bodyLarge: { fontSize: 16, fontWeight: '400' },
  body: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
  currencyAmount: { fontSize: 14, fontWeight: '500' }
}

export const radii = {
  sm: 4,
  md: 6,
  lg: 8
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
}