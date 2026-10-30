import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { radii, useTheme } from '../constants/theme.js'

// Budget progress bar: green under, amber near-budget, red over.
export function ProgressBar({ spent, budget, currency = 'NGN' }) {
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const pct = budget > 0 ? Math.min(spent / budget, 1.5) : 0
  const ratio = spent / (budget || 1)
  const barColor =
    ratio > 1 ? colors.warningRed : ratio > 0.8 ? colors.warningAmber : colors.successGreen

  return (
    <View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(pct, 1) * 100}%`, backgroundColor: barColor }
          ]}
        />
      </View>
      <Text style={styles.caption}>
        {spent.toLocaleString('en-US', { maximumFractionDigits: 0 })} /{' '}
        {budget.toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
      </Text>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    track: {
      height: 6,
      borderRadius: radii.sm,
      backgroundColor: colors.border,
      overflow: 'hidden'
    },
    fill: { height: 6, borderRadius: radii.sm },
    caption: { fontSize: 12, color: colors.textSecondary, marginTop: 4 }
  })