import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View, Linking, AppState } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMarketStore } from '../../store/market.js'
import { radii, spacing, useTheme } from '../../constants/theme.js'

const POLL_MS = 45_000

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 5) return 'now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatPrice(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '–'
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (Math.abs(n) >= 1) return n.toFixed(2)
  return n.toPrecision(4)
}

function Delta({ value }) {
  const colors = useTheme()
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) {
    return (
      <View style={[styles.chip, { backgroundColor: colors.border }]}>
        <Text style={[styles.chipText, { color: colors.textSecondary }]}>0.00%</Text>
      </View>
    )
  }
  const up = n > 0
  const color = up ? colors.successGreen : colors.warningRed
  return (
    <View style={[styles.chip, { backgroundColor: color + '1A' }]}>
      <Ionicons name={up ? 'caret-up' : 'caret-down'} size={11} color={color} />
      <Text style={[styles.chipText, { color }]}>
        {up ? '+' : ''}
        {n.toFixed(2)}%
      </Text>
    </View>
  )
}

export default function MarketsScreen() {
  const data = useMarketStore((s) => s.data)
  const loading = useMarketStore((s) => s.loading)
  const error = useMarketStore((s) => s.error)
  const lastFetchedAt = useMarketStore((s) => s.lastFetchedAt)
  const load = useMarketStore((s) => s.load)
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const appState = useRef(AppState.currentState)
  const [pulled, setPulled] = useState(false)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appState.current = next
      if (next === 'active') load()
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => {
      if (appState.current === 'active') load()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [])

  const hasData = data.crypto.length > 0 || data.indices.length > 0 || data.news.length > 0

  const header = (
    <View>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>
          Live market data · auto-refreshes every {Math.round(POLL_MS / 1000)}s
        </Text>
      </View>

      {error && !hasData ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {data.crypto.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Crypto</Text>
          <View style={styles.grid}>
            {data.crypto.map((c) => (
              <View key={c.id} style={styles.cryptoCard}>
                <Text style={styles.cryptoName}>{c.name}</Text>
                <Text style={styles.cryptoPrice}>
                  {c.currency === 'USD' ? '$' : ''}
                  {formatPrice(c.price)}
                </Text>
                <Delta value={c.change24h} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {data.indices.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock indices</Text>
          {data.indices.map((i) => (
            <View key={i.symbol} style={styles.indexRow}>
              <View style={styles.indexLeft}>
                <Text style={styles.indexName}>{i.name}</Text>
                <Text style={styles.indexSymbol}>{i.symbol}</Text>
              </View>
              <Text style={styles.indexPrice}>{formatPrice(i.price)}</Text>
              <Delta value={i.changePercent} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Market news</Text>
        <Text style={styles.sectionNote}>
          Headlines from Yahoo Finance · updated {timeAgo(data.updatedAt)} · {timeAgo(lastFetchedAt) || 'now'}
        </Text>
      </View>
    </View>
  )

  return (
    <View style={styles.flex}>
      <FlatList
        data={data.news}
        keyExtractor={(item, index) => `${item.link ?? 'news'}-${index}`}
        renderItem={({ item }) => (
          <Pressable
            style={styles.newsRow}
            disabled={!item.link}
            onPress={() => {
              if (item.link) Linking.openURL(item.link).catch(() => {})
            }}
          >
            <Text style={styles.newsTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.newsMeta}>
              {item.source ?? 'Yahoo Finance'} · {timeAgo(item.date)}
            </Text>
          </Pressable>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {hasData || error
              ? 'No headlines right now. Pull down to refresh.'
              : 'Live market data will appear here once loaded.'}
          </Text>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setPulled(true)
              load().finally(() => setPulled(false))
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, paddingBottom: 32 },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.successGreen },
    liveText: { fontSize: 12, color: colors.textSecondary },
    errorText: { fontSize: 13, color: colors.warningRed, marginBottom: 12 },
    section: { marginTop: spacing.md },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    sectionNote: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cryptoCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 12
    },
    cryptoName: { fontSize: 12, color: colors.textSecondary },
    cryptoPrice: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginVertical: 4 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    chipText: { fontSize: 11, fontWeight: '600' },
    indexRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    indexLeft: { flex: 1 },
    indexName: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
    indexSymbol: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    indexPrice: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    newsRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    newsTitle: { fontSize: 14, color: colors.textPrimary, lineHeight: 19 },
    newsMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
    emptyText: { fontSize: 13, color: colors.textSecondary, paddingVertical: 24 }
  })