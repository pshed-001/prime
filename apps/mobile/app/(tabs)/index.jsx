import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SyncStatusBar } from '../../components/SyncStatusBar.jsx'
import { CurrencyText } from '../../components/CurrencyText.jsx'
import { ProgressBar } from '../../components/ProgressBar.jsx'
import { SpendingChart } from '../../components/SpendingChart.jsx'
import { CategoryDonut } from '../../components/CategoryDonut.jsx'
import { CategoryIcon } from '../../components/CategoryIcon.jsx'
import { AddExpenseBottomSheet } from '../../components/AddExpenseBottomSheet.jsx'
import { useExpensesStore } from '../../store/expenses.js'
import { useAssetsStore } from '../../store/assets.js'
import { useTasksStore } from '../../store/tasks.js'
import { useSettingsStore } from '../../store/settings.js'
import { useSyncStore } from '../../store/sync.js'
import { runOnce } from '../../lib/sync.js'
import { radii, spacing, useTheme } from '../../constants/theme.js'

export default function DashboardScreen() {
  const base = useSettingsStore((s) => s.baseCurrency)
  const dailyBudget = useSettingsStore((s) => s.dailyBudget)
  const expenses = useExpensesStore((s) => s.expenses)
  const assets = useAssetsStore((s) => s.assets)
  const tasks = useTasksStore((s) => s.tasks)
  const loadExpenses = useExpensesStore((s) => s.load)
  const loadAssets = useAssetsStore((s) => s.load)
  const loadTasks = useTasksStore((s) => s.load)
  const refreshCounts = useSyncStore((s) => s.refreshCounts)
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [addSheet, setAddSheet] = useState(false)

  useEffect(() => {
    loadExpenses()
    loadAssets()
    loadTasks()
    refreshCounts()
  }, [])

  const netTotalRemaining = useMemo(() => {
    const income = expenses
      .filter((e) => e.type === 'INCOME')
      .reduce((s, e) => s + e.amount_base, 0)
    const spent = expenses
      .filter((e) => e.type === 'EXPENSE')
      .reduce((s, e) => s + e.amount_base, 0)
    return income - spent
  }, [expenses])

  const assetsTotal = useMemo(
    () => assets.reduce((s, a) => s + a.value_base, 0),
    [assets]
  )

  const todayLabel = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date())
    return parts.replace(/\//g, '-')
  }, [])

  const todaySpent = useMemo(
    () =>
      expenses
        .filter((e) => e.type === 'EXPENSE' && (e.date ?? '').startsWith(todayLabel))
        .reduce((s, e) => s + e.amount_base, 0),
    [expenses, todayLabel]
  )

  const last30 = useMemo(() => {
    const days = 30
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      return { label, value: 0, isToday: i === days - 1 }
    })
    for (const e of expenses) {
      if (e.type !== 'EXPENSE' || !e.date) continue
      const idx = buckets.findIndex((b) => b.label === `${new Date(e.date).getMonth() + 1}/${new Date(e.date).getDate()}`)
      if (idx >= 0) buckets[idx].value += e.amount_base
    }
    return buckets
  }, [expenses])

  const byCategory = useMemo(() => {
    const map = {}
    for (const e of expenses) {
      if (e.type !== 'EXPENSE') continue
      map[e.category] = (map[e.category] ?? 0) + e.amount_base
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value]) => ({ category, value }))
  }, [expenses])

  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED').slice(0, 5)

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <SyncStatusBar onPress={runOnce} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cash balance</Text>
        <CurrencyText amount={netTotalRemaining} currency={base} style={styles.balance} />
        <Text style={styles.caption}>Total assets: </Text>
        <CurrencyText amount={assetsTotal} currency={base} style={styles.caption} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily budget</Text>
        <ProgressBar spent={todaySpent} budget={dailyBudget} currency={base} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending - last 30 days</Text>
        <SpendingChart data={last30} currency={base} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>By category</Text>
        <CategoryDonut data={byCategory} currency={base} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Tasks</Text>
          <Pressable onPress={() => setAddSheet(true)} hitSlop={8}>
            <Text style={styles.link}>Add</Text>
          </Pressable>
        </View>
        {openTasks.length === 0 ? (
          <Text style={styles.caption}>All caught up.</Text>
        ) : (
          openTasks.map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <CategoryIcon category={t.priority} />
              <Text style={styles.taskTitle} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.caption}>{t.due_date ?? ''}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => setAddSheet(true)}>
          <Text style={styles.actionText}>Add Record</Text>
        </Pressable>
      </View>

      <AddExpenseBottomSheet visible={addSheet} onClose={() => setAddSheet(false)} />
    </ScrollView>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 32 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    balance: { fontSize: 26, fontWeight: '700', color: colors.textPrimary },
    caption: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    taskTitle: { flex: 1, fontSize: 14, color: colors.textPrimary },
    actions: { flexDirection: 'row', gap: 8 },
    action: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 12
    },
    actionText: { color: '#ffffff', fontWeight: '600', fontSize: 15 }
  })