import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CATEGORY_DICT, ASSET_CATEGORY_DICT } from '../constants/categories.js'
import { radii, useTheme } from '../constants/theme.js'

export function CategoryIcon({ category, asset = false, size = 20 }) {
  const colors = useTheme()
  const dict = asset ? ASSET_CATEGORY_DICT : CATEGORY_DICT
  const entry = dict[category] ?? dict.OTHER
  const styles = useMemo(
    () =>
      StyleSheet.create({
        circle: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface
        }
      }),
    [colors]
  )
  return (
    <View style={[styles.circle, { width: size * 2, height: size * 2, borderRadius: radii.lg }]}>
      <Text style={{ fontSize: size }}>{entry.emoji}</Text>
    </View>
  )
}