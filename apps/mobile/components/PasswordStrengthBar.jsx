import { StyleSheet, Text, View } from 'react-native'
import { colors, radii } from '../constants/theme.js'

const SCORES = [
  { min: 0, label: 'Too weak', color: colors.warningRed },
  { min: 1, label: 'Weak', color: colors.warningRed },
  { min: 2, label: 'Fair', color: colors.warningAmber },
  { min: 3, label: 'Good', color: '#7c3aed' },
  { min: 4, label: 'Strong', color: colors.successGreen }
]

export function passwordScore(password) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

export function PasswordStrengthBar({ password }) {
  const score = password ? passwordScore(password) : 0
  const meta = SCORES.find((s) => score >= s.min) ?? SCORES[SCORES.length - 1]
  const bars = [...Array(SCORES.length - 1)]
  return (
    <View style={styles.row}>
      {bars.map((_, i) => (
        <View
          key={i}
          style={[styles.bar, i < score ? { backgroundColor: meta.color } : styles.empty]}
        />
      ))}
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bar: { flex: 1, height: 4, borderRadius: radii.sm },
  empty: { backgroundColor: colors.border },
  label: { fontSize: 12, marginLeft: 4 }
})