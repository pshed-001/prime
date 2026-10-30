import { StyleSheet, Text, View } from 'react-native'
import { radii, useTheme } from '../constants/theme.js'

export function passwordScore(password) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

const LEVELS = [
  { min: 0, label: 'Too weak' },
  { min: 1, label: 'Weak' },
  { min: 2, label: 'Fair' },
  { min: 3, label: 'Good' },
  { min: 4, label: 'Strong' }
]

export function PasswordStrengthBar({ password }) {
  const colors = useTheme()
  const score = password ? passwordScore(password) : 0
  // Pick the highest level the score satisfies (find() would always return the
  // first "Too weak" entry and keep the meter stuck on weak).
  const meta = { ...LEVELS[LEVELS.length - 1] }
  for (const level of LEVELS) {
    if (score >= level.min) {
      meta.label = level.label
      meta.color =
        score >= 3
          ? colors.successGreen
          : score === 2
            ? colors.warningAmber
            : colors.warningRed
    }
  }
  if (score === 0) meta.color = colors.warningRed
  const bars = [...Array(LEVELS.length - 1)]
  return (
    <View style={styles.row}>
      {bars.map((_, i) => (
        <View
          key={i}
          style={[styles.bar, i < score ? { backgroundColor: meta.color } : { backgroundColor: colors.border }]}
        />
      ))}
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bar: { flex: 1, height: 4, borderRadius: radii.sm },
  label: { fontSize: 12, marginLeft: 4 }
})