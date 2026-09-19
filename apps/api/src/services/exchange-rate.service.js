import { prisma } from '../lib/prisma.js'
import { getRate } from '../lib/exchange-rate.js'
import { SUPPORTED_CURRENCIES } from '@prime/shared'

export async function getRatesForUser(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const base = settings?.baseCurrency ?? 'NGN'

  const rates = {}
  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency === base) continue
    const rate = await getRate({ userId, fromCurrency: currency, toCurrency: base })
    rates[currency] = {
      rate: Number(((rate.rate * 1000000) | 0) / 1000000),
      isEstimate: rate.isEstimate,
      fetchedAt: rate.fetchedAt
    }
  }
  return { baseCurrency: base, rates }
}