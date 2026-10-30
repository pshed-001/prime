import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { radii, useTheme } from '../constants/theme.js'

export function ErrorBanner({ message, onRetry }) {
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
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

const createStyles = (colors) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.warningRed,
      borderColor: colors.warningRed,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: radii.lg,
      marginBottom: 8
    },
    text: { flex: 1, color: '#ffffff', fontSize: 13 },
    retry: { color: '#ffffff', fontWeight: '600', marginLeft: 8 }
  })