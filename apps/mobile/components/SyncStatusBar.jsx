import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSyncStore } from '../store/sync.js'
import { colors, radii } from '../constants/theme.js'

// Compact header status showing pending items and last sync. Tapping while
// idle triggers a manual sync (sync tab / pull-to-refresh).
export function SyncStatusBar({ onPress }) {
  const { pendingCount, syncing, deadLettered, lastSyncTimestamp } = useSyncStore()

  if (pendingCount === 0 && deadLettered === 0 && !syncing) {
    return (
      <Pressable onPress={onPress} style={styles.row}>
        <View style={[styles.dot, styles.ok]} />
        <Text style={styles.text}>
          {lastSyncTimestamp
            ? `Synced ${new Date(lastSyncTimestamp).toLocaleTimeString()}`
            : 'Up to date'}
        </Text>
        <Text style={styles.count}>0 pending</Text>
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.dot, syncing ? styles.busy : styles.issue]} />
      <Text style={styles.text}>
        {syncing ? 'Syncing...' : deadLettered > 0 ? `${deadLettered} failed` : 'Queue'}
      </Text>
      <Text style={styles.count}>{pendingCount} pending</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8
  },
  dot: { width: 10, height: 10, borderRadius: radii.sm },
  ok: { backgroundColor: colors.successGreen },
  busy: { backgroundColor: colors.warningAmber },
  issue: { backgroundColor: colors.warningRed },
  text: { flex: 1, fontSize: 12, color: colors.textSecondary },
  count: { fontSize: 12, color: colors.textPrimary }
})