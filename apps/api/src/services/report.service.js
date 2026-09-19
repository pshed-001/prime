import { v7 as uuidv7 } from 'uuid'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { withRls } from '../lib/rls.js'
import { serializeRecord } from '../lib/serialize.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'

function notFound() {
  return new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
}

export async function generateReport({ userId, date }) {
  const baseCurrency =
    (await prisma.userSettings.findUnique({ where: { userId } }))?.baseCurrency ?? 'NGN'

  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const expenses = await prisma.expense.findMany({
    where: { userId, deletedAt: null, date: { gte: start, lt: end } }
  })

  let totalIncome = 0
  let totalExpense = 0
  for (const e of expenses) {
    if (e.type === 'INCOME') totalIncome += Number(e.amountBase)
    else totalExpense += Number(e.amountBase)
  }
  const netBalance = totalIncome - totalExpense

  const existing = await prisma.report.findUnique({
    where: { userId_date: { userId, date: start } }
  })
  if (existing) {
    throw new AppError(ErrorCodes.REPORT_ALREADY_EXISTS, ErrorMessage[ErrorCodes.REPORT_ALREADY_EXISTS], {
      status: 409
    })
  }

  const report = await prisma.report
    .create({
      data: {
        id: uuidv7(),
        userId,
        date: start,
        baseCurrency,
        totalIncome: new Prisma.Decimal(totalIncome),
        totalExpense: new Prisma.Decimal(totalExpense),
        netBalance: new Prisma.Decimal(netBalance),
        pdfUrl: null
      }
    })
    .catch((error) => {
      // Race with a concurrent identical generate (userId, date) request.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(ErrorCodes.REPORT_ALREADY_EXISTS, ErrorMessage[ErrorCodes.REPORT_ALREADY_EXISTS], {
          status: 409
        })
      }
      throw error
    })
  return serializeRecord(report)
}

export async function listReports({ userId, page = 1, limit = 20 }) {
  const where = { userId }
  const { total, rows } = await withRls(async (tx) => {
    const total = await tx.report.count({ where })
    const rows = await tx.report.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
    return { total, rows }
  })
  return { total, page, limit, data: serializeRecord(rows) }
}

export async function getReport({ userId, id }) {
  const report = await prisma.report.findFirst({ where: { id, userId } })
  if (!report) throw notFound()
  return serializeRecord(report)
}