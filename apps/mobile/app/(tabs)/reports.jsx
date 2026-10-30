import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, Share } from 'react-native'
import { SyncStatusBar } from '../../components/SyncStatusBar.jsx'
import { CurrencyText } from '../../components/CurrencyText.jsx'
import { getDb } from '../../lib/database.js'
import { generatePreviousDayReport } from '../../lib/midnight.js'
import { useSyncStore } from '../../store/sync.js'
import { radii, spacing, useTheme } from '../../constants/theme.js'

export default function ReportsScreen() {
  const refreshCounts = useSyncStore((s) => s.refreshCounts)
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [reports, setReports] = useState([])
  const [generating, setGenerating] = useState(false)

  async function load() {
    const db = await getDb()
    const rows = await db.getAllAsync(
      'SELECT * FROM reports ORDER BY date DESC'
    )
    setReports(rows)
  }

  useEffect(() => {
    load()
    refreshCounts()
  }, [])

  async function generate() {
    setGenerating(true)
    try {
      await generatePreviousDayReport()
      await load()
    } finally {
      setGenerating(false)
    }
  }

  async function share(item) {
    try {
      await Share.share({ title: `PRIME report ${item.date}`, url: item.pdf_path ?? item.date })
    } catch {
      // sharing dismissed
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <SyncStatusBar onPress={load} />
        <Pressable style={styles.generate} onPress={generate} disabled={generating}>
          <Text style={styles.generateText}>
            {generating ? 'Generating...' : 'Generate yesterday report'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No reports yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>Report for {item.date}</Text>
            <View style={styles.line}>
              <Text style={styles.label}>Income</Text>
              <CurrencyText amount={item.total_income} currency={item.base_currency} />
            </View>
            <View style={styles.line}>
              <Text style={styles.label}>Expense</Text>
              <CurrencyText amount={item.total_expense} currency={item.base_currency} />
            </View>
            <View style={[styles.line, styles.net]}>
              <Text style={styles.label}>Net balance</Text>
              <CurrencyText amount={item.net_balance} currency={item.base_currency} />
            </View>
            <Pressable style={styles.share} onPress={() => share(item)}>
              <Text style={styles.shareText}>Share PDF</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: { padding: spacing.lg },
    generate: {
      backgroundColor: colors.secondary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: spacing.sm
    },
    generateText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
    list: { padding: spacing.lg, paddingTop: 0 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md
    },
    date: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
    line: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
    net: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 },
    label: { fontSize: 13, color: colors.textSecondary },
    share: { marginTop: 12, alignSelf: 'flex-end' },
    shareText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
    empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 32, textAlign: 'center' }
  })