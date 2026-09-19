import { v7 as uuidv7 } from 'uuid'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { withRls } from '../lib/rls.js'
import { convert, getRate } from '../lib/exchange-rate.js'
import { serializeRecord } from '../lib/serialize.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'
import { ASSET_CATEGORIES } from '@prime/shared'

function notFound() {
  return new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
}

async function getBaseCurrency(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  return settings?.baseCurrency ?? 'NGN'
}

async function computeBaseValue({ userId, value, currency, baseCurrency }) {
  if (currency === baseCurrency) {
    return {
      valueBase: new Prisma.Decimal(value),
      exchangeRate: new Prisma.Decimal(1),
      rateIsEstimate: false
    }
  }
  const conv = await convert({ userId, amount: value, fromCurrency: currency, baseCurrency })
  return {
    valueBase: conv.amountBase,
    exchangeRate: conv.exchangeRate,
    rateIsEstimate: conv.rateIsEstimate
  }
}

export async function createAsset({ userId, data }) {
  const baseCurrency = await getBaseCurrency(userId)
  const conv = await computeBaseValue({
    userId,
    value: data.value,
    currency: data.currency,
    baseCurrency
  })
  const asset = await prisma.asset.create({
    data: { userId, ...data, ...conv, id: data.id ?? uuidv7() }
  })
  return serializeRecord(asset)
}

export async function listAssets({ userId, includeDeleted = false }) {
  const rows = await prisma.asset.findMany({
    where: { userId, ...(includeDeleted ? {} : { deletedAt: null }) },
    orderBy: { createdAt: 'desc' }
  })
  return serializeRecord(rows)
}

export async function getAsset({ userId, id }) {
  const asset = await prisma.asset.findFirst({ where: { id, userId } })
  if (!asset) throw notFound()
  return serializeRecord(asset)
}

export async function updateAsset({ userId, id, data }) {
  const existing = await prisma.asset.findFirst({ where: { id, userId } })
  if (!existing) throw notFound()
  if (existing.deletedAt) {
    throw new AppError(ErrorCodes.GONE, ErrorMessage[ErrorCodes.GONE], { status: 410 })
  }

  const next = { ...data }
  const baseCurrency = await getBaseCurrency(userId)
  if (next.value && next.currency) {
    const conv = await computeBaseValue({
      userId,
      value: next.value,
      currency: next.currency,
      baseCurrency
    })
    next.valueBase = conv.valueBase
    next.exchangeRate = conv.exchangeRate
    next.rateIsEstimate = conv.rateIsEstimate
  }

  const changedFields = Object.fromEntries(Object.entries(next))
  const previousValues = Object.fromEntries(
    Object.keys(changedFields).map((k) => [k, existing[k]])
  )

  const asset = await withRls(async (tx) => {
    const updated = await tx.asset.update({
      where: { id },
      data: { ...next, version: { increment: 1 } }
    })
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        userId,
        tableName: 'assets',
        recordId: id,
        operation: 'UPDATE',
        changedFields,
        previousValues
      }
    })
    return updated
  })
  return serializeRecord(asset)
}

export async function deleteAsset({ userId, id }) {
  const existing = await prisma.asset.findFirst({ where: { id, userId } })
  if (!existing) throw notFound()
  if (existing.deletedAt) {
    throw new AppError(ErrorCodes.GONE, ErrorMessage[ErrorCodes.GONE], { status: 410 })
  }

  // DB-07 + DB-08: soft delete + tombstone + audit log in one transaction.
  await withRls(async (tx) => {
    await tx.asset.update({ where: { id }, data: { deletedAt: new Date() } })
    await tx.tombstone.create({ data: { id: uuidv7(), userId, tableName: 'assets', recordId: id } })
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        userId,
        tableName: 'assets',
        recordId: id,
        operation: 'DELETE',
        changedFields: { deletedAt: new Date().toISOString() },
        previousValues: { deletedAt: null }
      }
    })
  })
  return { message: 'Asset deleted.' }
}

export async function netWorth(userId) {
  const baseCurrency = await getBaseCurrency(userId)
  const assets = await prisma.asset.findMany({
    where: { userId, deletedAt: null }
  })

  const estimatedAssets = []
  let netWorth = 0
  const breakdown = Object.fromEntries(ASSET_CATEGORIES.map((c) => [c, 0]))
  let isEstimated = false

  for (const asset of assets) {
    let valueBase = Number(asset.valueBase)
    let estimated = asset.rateIsEstimate

    if (!asset.rateIsEstimate && asset.currency !== baseCurrency) {
      // Re-check staleness against the snapshot age (design doc 10.5).
      const snapshot = await prisma.exchangeRateSnapshot.findFirst({
        where: { userId, fromCurrency: asset.currency, toCurrency: baseCurrency },
        orderBy: { fetchedAt: 'desc' }
      })
      if (!snapshot || Date.now() - snapshot.fetchedAt.getTime() > 24 * 60 * 60 * 1000) {
        estimated = true
      }
    }

    if (estimated) {
      estimatedAssets.push({
        id: asset.id,
        name: asset.name,
        rateAgeHours: asset.exchangeRate ? snapshotAgeHours(asset) : null
      })
    }

    breakdown[asset.category] = Math.round(((breakdown[asset.category] ?? 0) + valueBase) * 100) / 100
    netWorth += valueBase
    if (estimated) isEstimated = true
  }

  return serializeRecord({
    baseCurrency,
    netWorth: Math.round(netWorth * 100) / 100,
    isEstimated,
    estimatedAssets,
    breakdown
  })
}

function snapshotAgeHours(asset) {
  // Falls back to the fetchedAt recorded on any recent snapshot for the pair.
  return asset.fetchedAt ? Math.round((Date.now() - new Date(asset.fetchedAt).getTime()) / 3_600_000) : null
}

// Recomputes valueBase/exchangeRate of every non-deleted asset for the new
// base currency (design doc 19.3).
export async function recomputeBaseValues(userId, newBaseCurrency) {
  const rows = await prisma.asset.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, value: true, currency: true }
  })
  for (const row of rows) {
    const conv = await computeBaseValue({
      userId,
      value: row.value,
      currency: row.currency,
      baseCurrency: newBaseCurrency
    })
    await prisma.asset.update({
      where: { id: row.id },
      data: { valueBase: conv.valueBase, exchangeRate: conv.exchangeRate, rateIsEstimate: conv.rateIsEstimate }
    })
  }
  return { recomputed: rows.length }
}