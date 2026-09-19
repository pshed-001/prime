import { View, Text, StyleSheet } from 'react-native'
import { Canvas, Path, Skia, Group } from '@shopify/react-native-skia'
import { CATEGORY_DICT } from '../constants/categories.js'
import { colors, radii } from '../constants/theme.js'
import { formatMoney } from '../utils/format.js'

// Donut of spending by category (design doc 6.1.1). Uses the fixed category
// palette; centre shows the total.
const PALETTE = ['#7c3aed', '#0d9488', '#f59e0b', '#EF4444', '#6366f1', '#10B981', '#9ca3af']

export function CategoryDonut({ data, size = 180, currency = 'NGN' }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0) {
    return <Text style={styles.empty}>No spending recorded yet.</Text>
  }

  const radius = size / 2
  const thickness = 22
  let start = -90
  const segments = data.map((d, i) => {
    const sweep = (d.value / total) * 360
    const path = Skia.Path.Make()
    path.addArc({ x: 0, y: 0, width: size, height: size }, start, sweep)
    start += sweep
    return { path, color: PALETTE[i % PALETTE.length], category: d.category }
  })

  return (
    <View style={styles.wrap}>
      <Canvas style={{ width: size, height: size }}>
        <Group>
          {segments.map((s, i) => (
            <Path
              key={i}
              path={s.path}
              style="stroke"
              strokeWidth={thickness}
              color={s.color}
              strokeCap="butt"
            />
          ))}
        </Group>
      </Canvas>
      <View style={[styles.center, { width: size - 2 * thickness }]}>
        <Text style={styles.centerLabel}>Total</Text>
        <Text style={styles.centerValue}>{formatMoney(total, currency)}</Text>
      </View>
      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={d.category} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
            <Text style={styles.legendText}>
              {CATEGORY_DICT[d.category]?.label ?? d.category}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  center: {
    position: 'absolute',
    top: 90,
    alignItems: 'center'
  },
  centerLabel: { fontSize: 12, color: colors.textSecondary },
  centerValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: radii.sm },
  legendText: { fontSize: 12, color: colors.textSecondary },
  empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 24 }
})