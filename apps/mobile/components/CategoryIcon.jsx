import { StyleSheet, Text, View } from 'react-native'
import { CATEGORY_DICT, ASSET_CATEGORY_DICT } from '../constants/categories.js'
import { radii } from '../constants/theme.js'

export function CategoryIcon({ category, asset = false, size = 20 }) {
  const dict = asset ? ASSET_CATEGORY_DICT : CATEGORY_DICT
  const entry = dict[category] ?? dict.OTHER
  return (
    <View style={[styles.circle, { width: size * 2, height: size * 2, borderRadius: radii.lg }]}>
      <Text style={{ fontSize: size }}>{entry.emoji}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9'
  }
})