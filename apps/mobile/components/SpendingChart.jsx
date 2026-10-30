import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Canvas, Rect, Group } from '@shopify/react-native-skia'
import { radii, useTheme } from '../constants/theme.js'

// Last-30-day spending bar chart (design doc 6.1.1). Skia drawn; labels are
// RN text to keep font handling simple.
export function SpendingChart({ data, height = 160, currency = 'NGN' }) {
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  if (!data || data.length === 0) {
    return <Text style={styles.empty}>No spending in the last 30 days.</Text>
  }
  const width = 320
  const max = Math.max(...data.map((d) => d.value), 1)
  const gap = 4
  const barWidth = Math.max((width - gap * (data.length - 1)) / data.length, 2)
  const chartHeight = height - 24

  return (
    <View>
      <Canvas style={{ width, height }}>
        <Group>
          {data.map((d, i) => {
            const barH = Math.max((d.value / max) * chartHeight, 2)
            const x = i * (barWidth + gap)
            const y = chartHeight - barH
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                color={d.isToday ? colors.primary : colors.secondary}
              />
            )
          })}
        </Group>
      </Canvas>
      <View style={styles.labels}>
        <Text style={styles.label}>{data[0]?.label}</Text>
        <Text style={styles.label}>{data[Math.floor(data.length / 2)]?.label}</Text>
        <Text style={styles.label}>{data[data.length - 1]?.label}</Text>
      </View>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 24 },
    labels: { flexDirection: 'row', justifyContent: 'space-between', width: 320 },
    label: { fontSize: 12, color: colors.textSecondary, borderRadius: radii.sm }
  })