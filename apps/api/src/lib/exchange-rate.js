import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { env } from '../config/env.js'
import { v7 as uuidv7 } from 'uuid'
import { EXCHANGE_RATE_STALE_HOURS } from '@prime/shared'
import { logger } from './logger.js'

const STALE_MS = EXCHANGE_RATE_STALE_HOURS * 60 * 60 * 1000

function rateHistoryCutoffDate() {
  return new Date(Date.now() - STALE_MS)
}

export { rateHistoryCutoffDate }

async function fetchFreshRate(fromCurrency, toCurrency) {
  try {
    const url = `${env.exchangeRateApiUrl}/${fromCurrency}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: env.exchangeRateApiKey ? { apikey: env.exchangeRateApiKey } : {}
    })
    if (!res.ok) return null
    const body = await res.json()
    const rate = body?.rates?.[toCurrency]
    if (!rate || typeof rate !== 'number') return null
    return { rate, source: 'ExchangeRate-API', fresh: true }
  } catch (error) {
    logger.warn('[exchange-rate] fresh fetch failed', { fromCurrency, toCurrency, error: error.message })
    return null
  }
}

export async function getRate({ userId, fromCurrency, toCurrency }) {
  if (fromCurrency === toCurrency) {
    return { rate: 1, source: 'identity', fetchedAt: new Date(), isEstimate: false }
  }

  const fresh = await prisma.exchangeRateSnapshot.findFirst({
    where: {
      userId,
      fromCurrency,
      toCurrency,
      fetchedAt: { gte: rateHistoryCutoffDate() }
    },
    orderBy: { fetchedAt: 'desc' }
  })

  let rate, source, fetchedAt, isEstimate
  if (fresh) {
    rate = Number(fresh.rate)
    source = fresh.source
    fetchedAt = fresh.fetchedAt
    isEstimate = false
  } else {
    // Stale / absent: try a fresh fetch.
    const fetched = await fetchFreshRate(fromCurrency, toCurrency)
    if (fetched) {
      const snapshot = await prisma.exchangeRateSnapshot.create({
        data: {
          id: uuidv7(),
          userId,
          fromCurrency,
          toCurrency,
          rate: new Prisma.Decimal(fetched.rate),
          source: fetched.source
        }
      })
      rate = Number(snapshot.rate)
      source = snapshot.source
      fetchedAt = snapshot.fetchedAt
      isEstimate = false
    } else {
      const stale = await prisma.exchangeRateSnapshot.findFirst({
        where: { userId, fromCurrency, toCurrency },
        orderBy: { fetchedAt: 'desc' }
      })
      if (stale) {
        rate = Number(stale.rate)
        source = stale.source
        fetchedAt = stale.fetchedAt
        isEstimate = true
      } else {
        // First ever use and API offline: approximate at parity.
        rate = 1
        source = 'offline-parity-fallback'
        fetchedAt = new Date()
        isEstimate = true
      }
    }
  }

  return { rate, source, fetchedAt, isEstimate }
}

export async function convert({ userId, amount, fromCurrency, baseCurrency }) {
  const { rate, fetchedAt, isEstimate } = await getRate({
    userId,
    fromCurrency,
    toCurrency: baseCurrency
  })
  return {
    amountBase: new Prisma.Decimal(amount).times(new Prisma.Decimal(rate)),
    exchangeRate: new Prisma.Decimal(rate),
    rateIsEstimate: isEstimate,
    fetchedAt
  }
}