import { prisma } from '../lib/prisma.js'
import { getRate, rateHistoryCutoffDate } from '../lib/exchange-rate.js'
import { SUPPORTED_CURRENCIES } from '@prime/shared'

function snap(value) {
  return Number(((Number(value) * 1000000) | 0) / 1000000)
}

export async function getRatesForUser(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const base = settings?.baseCurrency ?? 'NGN'

  const pairs = SUPPORTED_CURRENCIES.filter((currency) => currency !== base)

  // Single batched read for every pair instead of one query (each wrapped in
  // an RLS transaction) per currency - keeps the bulk call in the ms range.
  const snapshotRows = await prisma.exchangeRateSnapshot.findMany({
    where: {
      userId,
      fromCurrency: { in: pairs },
      toCurrency: base,
      fetchedAt: { gte: rateHistoryCutoffDate() }
    },
    orderBy: { fetchedAt: 'desc' }
  })
  const best = new Map()
  for (const row of snapshotRows) {
    const key = `${row.fromCurrency}=>${row.toCurrency}`
    if (!best.has(key) || row.fetchedAt > best.get(key).fetchedAt) best.set(key, row)
  }

  const rates = {}
  for (const currency of pairs) {
    const row = best.get(`${currency}=>${base}`)
    if (row) {
      rates[currency] = {
        rate: snap(Number(row.rate)),
        isEstimate: false,
        fetchedAt: row.fetchedAt
      }
      continue
    }
    // Rare path: pairs without a fresh snapshot go through the full slow path
    // (upstream fetch with snapshot persistence + estimate fallback).
    const rate = await getRate({ userId, fromCurrency: currency, toCurrency: base })
    rates[currency] = {
      rate: snap(rate.rate),
      isEstimate: rate.isEstimate,
      fetchedAt: rate.fetchedAt
    }
  }
  return { baseCurrency: base, rates }
}

// Single-pair lookup used by the mobile client when the user enters an amount
// in a non-base currency (e.g. 30,000 NGN while base is USD). Returns the rate
// that converts `from` -> `to`.
export async function getSingleRateForUser(userId, from, to) {
  if (from === to) return { fromCurrency: from, toCurrency: to, rate: 1, isEstimate: false, fetchedAt: new Date() }
  const rate = await getRate({ userId, fromCurrency: from, toCurrency: to })
  return {
    fromCurrency: from,
    toCurrency: to,
    rate: snap(rate.rate),
    isEstimate: rate.isEstimate,
    fetchedAt: rate.fetchedAt
  }
}