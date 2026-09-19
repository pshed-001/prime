import { StyleSheet, Text, View } from 'react-native'
import { colors, radii } from '../constants/theme.js'

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <Text style={styles.retry} onPress={onRetry}>
          Retry
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderColor: colors.warningRed,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: radii.lg,
    marginBottom: 8
  },
  text: { flex: 1, color: colors.warningRed, fontSize: 13 },
  retry: { color: colors.warningRed, fontWeight: '600', marginLeft: 8 }
})