import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SyncStatusBar } from '../components/SyncStatusBar.jsx'
import { useSyncStore } from '../store/sync.js'
import { getDb } from '../lib/database.js'
import { runOnce } from '../lib/sync.js'
import { discardDeadLettered, retryDeadLettered } from '../lib/queue.js'
import { radii, spacing, useTheme } from '../constants/theme.js'

export default function SyncStatusScreen() {
  const { pendingCount, syncing } = useSyncStore()
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [dead, setDead] = useState([])

  async function loadDead() {
    const db = await getDb()
    const rows = await db.getAllAsync(
      'SELECT * FROM sync_queue WHERE dead_lettered = 1 ORDER BY created_at DESC'
    )
    setDead(rows)
  }

  const refresh = async () => {
    await useSyncStore.getState().refreshCounts()
    await loadDead()
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <SyncStatusBar onPress={runOnce} />
        <Pressable style={styles.sync} onPress={() => runOnce({ manual: true })} disabled={syncing}>
          <Text style={styles.syncText}>{syncing ? 'Syncing...' : 'Sync now'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={dead}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.caption}>
            {pendingCount} queued change{pendingCount !== 1 ? 's' : ''}. Dead-lettered items below
            can be retried or discarded.
          </Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing dead-lettered.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.operation} → {item.table_name}</Text>
            <Text style={styles.meta}>{item.record_id}</Text>
            <Text style={styles.error} numberOfLines={2}>
              {item.last_error ?? 'unknown error'}
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={styles.retry}
                onPress={async () => {
                  await retryDeadLettered(item.id)
                  await refresh()
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
              <Pressable
                style={styles.discard}
                onPress={async () => {
                  await discardDeadLettered(item.id)
                  await refresh()
                }}
              >
                <Text style={styles.discardText}>Discard</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: { padding: spacing.lg, paddingBottom: 0 },
    sync: {
      backgroundColor: colors.secondary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 10,
      marginTop: 8
    },
    syncText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
    list: { padding: spacing.lg },
    caption: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: 8
    },
    title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    error: { fontSize: 12, color: colors.warningRed, marginTop: 6 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    retry: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 8
    },
    retryText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    discard: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.warningRed,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 8
    },
    discardText: { color: colors.warningRed, fontWeight: '600', fontSize: 13 },
    empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 32, textAlign: 'center' }
  })