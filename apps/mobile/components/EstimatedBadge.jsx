import { StyleSheet, Text, View } from 'react-native'
import { colors, radii } from '../constants/theme.js'

// Amber badge marking amounts converted with an estimated/stale exchange
// rate (design doc 8.4).
export function EstimatedBadge({ visible }) {
  if (!visible) return null
  return (
    <View style={styles.badge}>
      <Text style={styles.dot}>~</Text>
      <Text style={styles.text}>est.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.estimated,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4
  },
  dot: { color: colors.estimated, fontSize: 10, fontWeight: '700' },
  text: { color: colors.estimated, fontSize: 10, marginLeft: 2 }
})