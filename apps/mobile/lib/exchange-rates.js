// Exchange rate snapshotting with 24-hour cache and estimated-rate fallback
// (blueprint 8.4). Accurate rates are pinning-tier; estimated rates are
// flagged rate_is_est so reports can mark them (EstimatedBadge).
import { getDb } from './database.js'
import { uuidv7 } from '../utils/uuid.js'

const TTL_MS = 24 * 60 * 60 * 1000 // 24h
const cache = new Map()

export async function getRate({ from, to }) {
  if (from === to) return { rate: 1, estimated: false }
  const key = `${from}=>${to}`
  const mem = cache.get(key)
  if (mem && Date.now() - mem.fetchedAt < TTL_MS) return mem

  const db = await getDb()
  const row = await db.getFirstAsync(
    'SELECT rate, fetched_at FROM exchange_rate_snapshots WHERE from_currency = ? AND to_currency = ?',
    from,
    to
  )
  if (row && Date.now() - new Date(row.fetched_at).getTime() < TTL_MS) {
    const result = { rate: row.rate, estimated: false }
    cache.set(key, { ...result, fetchedAt: Date.now() })
    return result
  }

  // Live fetch from the secure server relay (KEY-03: never from the device).
  try {
    const { apiClient } = await import('./api.js')
    const res = await apiClient.get(`/exchange-rates?from=${from}&to=${to}`)
    const data = res.data.data ?? {}
    // Server contract is { fromCurrency, toCurrency, rate, isEstimate, fetchedAt };
    // the older bulk response is { baseCurrency, rates: { CURRENCY: { rate, isEstimate } } }.
    const rateInfo = data.rate != null ? data : data.rates?.[from] ?? data.rates?.[to]
    const rate = Number(rateInfo?.rate)
    const estimated = rateInfo?.isEstimate === true
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('no rate returned')
    const result = { rate, estimated }
    cache.set(key, { ...result, fetchedAt: Date.now() })
    await db.runAsync(
      `INSERT INTO exchange_rate_snapshots (id, from_currency, to_currency, rate, source)
       VALUES (?, ?, ?, ?, 'server')
       ON CONFLICT(from_currency, to_currency) DO UPDATE SET rate = ?, fetched_at = datetime('now')`,
      uuidv7(),
      from,
      to,
      rate,
      rate
    )
    return result
  } catch {
    // Offline: fall back to cached/estimated or 1.0 with estimate flag.
    const fallback = row ? { rate: row.rate, estimated: true } : { rate: 1, estimated: true }
    cache.set(key, { ...fallback, fetchedAt: Date.now() })
    return fallback
  }
}

export function toBase(amount, currency, rate, estimated) {
  return { amountBase: amount * (rate ?? 1), estimated: estimated === true }
}