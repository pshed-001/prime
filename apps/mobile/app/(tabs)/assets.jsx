import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { CurrencyText } from '../../components/CurrencyText.jsx'
import { EstimatedBadge } from '../../components/EstimatedBadge.jsx'
import { CategoryIcon } from '../../components/CategoryIcon.jsx'
import { AddAssetBottomSheet } from '../../components/AddAssetBottomSheet.jsx'
import { useAssetsStore } from '../../store/assets.js'
import { useSettingsStore } from '../../store/settings.js'
import { radii, spacing, useTheme } from '../../constants/theme.js'

export default function AssetsScreen() {
  const assets = useAssetsStore((s) => s.assets)
  const load = useAssetsStore((s) => s.load)
  const remove = useAssetsStore((s) => s.remove)
  const base = useSettingsStore((s) => s.baseCurrency)
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [addSheet, setAddSheet] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const total = useMemo(() => assets.reduce((s, a) => s + a.value_base, 0), [assets])

  return (
    <View style={styles.flex}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total assets</Text>
        <CurrencyText amount={total} currency={base} style={styles.summaryValue} />
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No assets yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <CategoryIcon category={item.category} asset />
            <View style={styles.middle}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.caption}>
                {item.acquired_at ?? 'no date'}
                <EstimatedBadge visible={item.rate_is_est === 1} />
              </Text>
            </View>
            <CurrencyText amount={item.value} currency={item.currency} style={styles.value} />
            <Pressable onPress={() => remove(item.id)} hitSlop={8}>
              <Text style={styles.delete}>🗑</Text>
            </Pressable>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setAddSheet(true)}>
        <Text style={styles.fabText}>+ New Asset</Text>
      </Pressable>

      <AddAssetBottomSheet visible={addSheet} onClose={() => setAddSheet(false)} />
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    summary: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: spacing.lg
    },
    summaryLabel: { fontSize: 13, color: colors.textSecondary },
    summaryValue: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
    list: { padding: spacing.lg, paddingBottom: 96 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    middle: { flex: 1 },
    title: { fontSize: 15, color: colors.textPrimary },
    caption: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    value: { fontSize: 14, fontWeight: '500' },
    delete: { fontSize: 16, color: colors.textSecondary },
    empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 32, textAlign: 'center' },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingHorizontal: 20,
      paddingVertical: 12
    },
    fabText: { color: '#ffffff', fontWeight: '600', fontSize: 14 }
  })