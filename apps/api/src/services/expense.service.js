import { v7 as uuidv7 } from 'uuid'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { withRls } from '../lib/rls.js'
import { convert } from '../lib/exchange-rate.js'
import { serializeRecord } from '../lib/serialize.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'

function notFound() {
  return new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
}

async function getBaseCurrency(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  return settings?.baseCurrency ?? 'NGN'
}

function dayRangeInTimezone(date, timezone) {
  // Determine [start, end) of a calendar date in the user's IANA timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const start = new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function createExpense({ userId, data }) {
  const baseCurrency = await getBaseCurrency(userId)
  let body = { ...data }

  if (body.currency === baseCurrency) {
    body.amountBase = new Prisma.Decimal(body.amount)
    body.exchangeRate = new Prisma.Decimal(1)
    body.rateIsEstimate = false
  } else {
    const conv = await convert({
      userId,
      amount: body.amount,
      fromCurrency: body.currency,
      baseCurrency
    })
    body.amountBase = conv.amountBase
    body.exchangeRate = conv.exchangeRate
    body.rateIsEstimate = conv.rateIsEstimate
  }

  const expense = await prisma.expense.create({
    data: { userId, ...body, id: body.id ?? uuidv7() }
  })
  return serializeRecord(expense)
}

export async function listExpenses({
  userId,
  page = 1,
  limit = 20,
  from,
  to,
  type,
  includeDeleted = false
}) {
  const where = { userId }
  if (!includeDeleted) where.deletedAt = null
  if (type) where.type = type
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const { total, rows } = await withRls(async (tx) => {
    const total = await tx.expense.count({ where })
    const rows = await tx.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
    return { total, rows }
  })
  return { total, page, limit, data: serializeRecord(rows) }
}

export async function getExpense({ userId, id }) {
  const expense = await prisma.expense.findFirst({ where: { id, userId } })
  if (!expense) throw notFound()
  return serializeRecord(expense)
}

export async function updateExpense({ userId, id, data }) {
  const existing = await prisma.expense.findFirst({ where: { id, userId } })
  if (!existing) throw notFound()
  if (existing.deletedAt) {
    throw new AppError(ErrorCodes.GONE, ErrorMessage[ErrorCodes.GONE], { status: 410 })
  }

  const baseCurrency = await getBaseCurrency(userId)
  const next = { ...data }
  if (next.currency && next.amount && next.currency !== baseCurrency) {
    const conv = await convert({
      userId,
      amount: next.amount,
      fromCurrency: next.currency,
      baseCurrency
    })
    next.amountBase = conv.amountBase
    next.exchangeRate = conv.exchangeRate
    next.rateIsEstimate = conv.rateIsEstimate
  } else if (next.currency === baseCurrency) {
    next.amountBase = new Prisma.Decimal(next.amount ?? existing.amount)
    next.exchangeRate = new Prisma.Decimal(1)
    next.rateIsEstimate = false
  }

  const changedFields = Object.fromEntries(
    Object.entries(next).filter(([k]) => k !== 'version')
  )
  const previousValues = Object.fromEntries(
    Object.keys(changedFields).map((k) => [k, existing[k]])
  )

  // DB-08: financial mutation + AuditLog in the same transaction.
  const expense = await withRls(async (tx) => {
    const updated = await tx.expense.update({
      where: { id },
      data: { ...next, version: { increment: 1 } }
    })
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        userId,
        tableName: 'expenses',
        recordId: id,
        operation: 'UPDATE',
        changedFields,
        previousValues
      }
    })
    return updated
  })
  return serializeRecord(expense)
}

export async function deleteExpense({ userId, id }) {
  const existing = await prisma.expense.findFirst({ where: { id, userId } })
  if (!existing) throw notFound()
  if (existing.deletedAt) {
    throw new AppError(ErrorCodes.GONE, ErrorMessage[ErrorCodes.GONE], { status: 410 })
  }

  // DB-07 + DB-08: soft delete + tombstone + audit log in one transaction.
  await withRls(async (tx) => {
    await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } })
    await tx.tombstone.create({ data: { id: uuidv7(), userId, tableName: 'expenses', recordId: id } })
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        userId,
        tableName: 'expenses',
        recordId: id,
        operation: 'DELETE',
        changedFields: { deletedAt: new Date().toISOString() },
        previousValues: { deletedAt: null }
      }
    })
  })
  return { message: 'Expense deleted.' }
}

export async function summaryByRange({ userId, from, to, timezone = 'UTC' }) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const base = settings?.baseCurrency ?? 'NGN'
  const tz = settings?.timezone ?? timezone

  let start, end
  if (from && to) {
    start = new Date(from)
    end = new Date(to)
  } else {
    const range = dayRangeInTimezone(new Date(), tz)
    start = range.start
    end = range.end
  }

  const rows = await prisma.expense.findMany({
    where: { userId, deletedAt: null, date: { gte: start, lt: end } },
    select: { type: true, amountBase: true }
  })

  let totalIncome = 0
  let totalExpense = 0
  for (const row of rows) {
    const value = Number(row.amountBase)
    if (row.type === 'INCOME') totalIncome += value
    else totalExpense += value
  }
  const netBalance = totalIncome - totalExpense
  const dailyBudget = settings?.dailyBudget ? Number(settings.dailyBudget) : null
  const budgetUsedPercent =
    dailyBudget && totalExpense > 0 ? Math.min(1000, Math.round((totalExpense / dailyBudget) * 100)) : 0

  return serializeRecord({
    date: start.toISOString().slice(0, 10),
    baseCurrency: base,
    totalIncome,
    totalExpense,
    netBalance,
    dailyBudget,
    budgetUsedPercent,
    transactionCount: rows.length,
    from: start.toISOString(),
    to: end.toISOString()
  })
}

// Recomputes amountBase/exchangeRate of every non-deleted expense so history
// reflects the newly selected base currency (design doc 19.3).
export async function recomputeBaseCurrency(userId, newBaseCurrency) {
  const rows = await prisma.expense.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, amount: true, currency: true }
  })
  for (const row of rows) {
    if (row.currency === newBaseCurrency) {
      await prisma.expense.update({
        where: { id: row.id },
        data: { amountBase: new Prisma.Decimal(row.amount), exchangeRate: new Prisma.Decimal(1), rateIsEstimate: false }
      })
    } else {
      const conv = await convert({
        userId,
        amount: row.amount,
        fromCurrency: row.currency,
        baseCurrency: newBaseCurrency
      })
      await prisma.expense.update({
        where: { id: row.id },
        data: { amountBase: conv.amountBase, exchangeRate: conv.exchangeRate, rateIsEstimate: conv.rateIsEstimate }
      })
    }
  }
  return { recomputed: rows.length }
}