import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { CurrencyText } from '../../components/CurrencyText.jsx'
import { EstimatedBadge } from '../../components/EstimatedBadge.jsx'
import { CategoryIcon } from '../../components/CategoryIcon.jsx'
import { AddExpenseBottomSheet } from '../../components/AddExpenseBottomSheet.jsx'
import { useExpensesStore } from '../../store/expenses.js'
import { useSettingsStore } from '../../store/settings.js'
import { colors, radii, spacing } from '../../constants/theme.js'
import { timeOfDay } from '../../utils/format.js'

const FILTERS = ['ALL', 'EXPENSE', 'INCOME']

export default function ExpensesScreen() {
  const expenses = useExpensesStore((s) => s.expenses)
  const load = useExpensesStore((s) => s.load)
  const remove = useExpensesStore((s) => s.remove)
  const base = useSettingsStore((s) => s.baseCurrency)
  const [filter, setFilter] = useState('ALL')
  const [addSheet, setAddSheet] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const rows = useMemo(() => {
    const list = filter === 'ALL' ? expenses : expenses.filter((e) => e.type === filter)
    return list.slice(0, 200)
  }, [expenses, filter])

  function renderItem({ item }) {
    const income = item.type === 'INCOME'
    const est = item.rate_is_est === 1
    return (
      <Swipeable renderRightActions={() => (
        <Pressable style={styles.delete} onPress={() => remove(item.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      )}>
        <View style={styles.row}>
          <CategoryIcon category={item.category} />
          <View style={styles.middle}>
            <Text style={styles.title}>{item.category || 'Other'}</Text>
            <Text style={styles.caption}>
              {timeOfDay(item.date)} {item.note ? `· ${item.note}` : ''}
              <EstimatedBadge visible={est} />
            </Text>
          </View>
          <CurrencyText
            amount={income ? item.amount : -Math.abs(item.amount)}
            currency={item.currency}
            style={styles.amount}
          />
        </View>
      </Swipeable>
    )
  }

  return (
    <View style={styles.flex}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No records yet.</Text>}
      />

      <Pressable style={styles.fab} onPress={() => setAddSheet(true)}>
        <Text style={styles.fabText}>+ Add Record</Text>
      </Pressable>

      <AddExpenseBottomSheet visible={addSheet} onClose={() => setAddSheet(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: 'row', gap: 8, padding: spacing.lg },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  chipActive: { borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  middle: { flex: 1 },
  title: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '500' },
  empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 32, textAlign: 'center' },
  delete: {
    backgroundColor: colors.warningRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: radii.md,
    marginVertical: 8
  },
  deleteText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 14 }
})