// Seed script - run with: DATABASE_URL=<owner-url> pnpm --filter api seed
// Guard: never runs outside development (design doc 10.5).
if (process.env.NODE_ENV !== 'development') {
  console.error('ERROR: Seed must only run in development environment')
  process.exit(1)
}

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import argon2 from 'argon2'
import { v7 as uuidv7 } from 'uuid'

// RLS is FORCEd on user-owned tables, so seeding must connect as the schema
// owner (prime_user) - the NOBYPASSRLS app role (prime_app) would get every
// INSERT rejected by the "userId = prime_current_user_id()" check.
const connectionString = process.env.DATABASE_URL
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const USER_1 = '01900000-0000-7000-8000-000000000001'
const USER_2 = '01900000-0000-7000-8000-000000000002'

function daysAgo(days, hour = 9, minute = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(hour, minute, 0, 0)
  return date
}

const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4
}

async function main() {
  // ---------------------------------------------------------------- users
  const hash1 = await argon2.hash('DevPass@123!', argon2Options)
  const hash2 = await argon2.hash('TestPass@123!', argon2Options)

  await prisma.user.upsert({
    where: { id: USER_1 },
    update: {},
    create: {
      id: USER_1,
      email: 'dev@prime.itgel.com',
      emailVerified: true,
      passwordHash: hash1
    }
  })
  await prisma.user.upsert({
    where: { id: USER_2 },
    update: {},
    create: {
      id: USER_2,
      email: 'test@prime.itgel.com',
      emailVerified: true,
      passwordHash: hash2
    }
  })

  await prisma.userSettings.upsert({
    where: { userId: USER_1 },
    update: { baseCurrency: 'NGN', dailyBudget: new Prisma.Decimal(50000) },
    create: {
      id: uuidv7(),
      userId: USER_1,
      timezone: 'Africa/Lagos',
      baseCurrency: 'NGN',
      dailyBudget: new Prisma.Decimal(50000)
    }
  })
  await prisma.userSettings.upsert({
    where: { userId: USER_2 },
    update: { baseCurrency: 'USD', dailyBudget: new Prisma.Decimal(500) },
    create: {
      id: uuidv7(),
      userId: USER_2,
      timezone: 'Africa/Lagos',
      baseCurrency: 'USD',
      dailyBudget: new Prisma.Decimal(500)
    }
  })

  // ----------------------------------------------------------------- tasks
  const tasks = [
    { id: uuidv7(), title: 'Build API authentication module', priority: 'HIGH', status: 'IN_PROGRESS', dueDate: daysAgo(-1) },
    { id: uuidv7(), title: 'Write integration tests for sync endpoint', priority: 'MEDIUM', status: 'PENDING', dueDate: daysAgo(-3) },
    { id: uuidv7(), title: 'Deploy to Render staging', priority: 'LOW', status: 'PENDING', dueDate: null },
    { id: uuidv7(), title: 'Design dashboard wireframes', priority: 'CRITICAL', status: 'COMPLETED', dueDate: daysAgo(1) },
    { id: uuidv7(), title: 'Setup PgBouncer connection pooling', priority: 'HIGH', status: 'COMPLETED', dueDate: daysAgo(3) }
  ]
  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: { userId: USER_1, version: 1, source: 'MANUAL', ...task }
    })
  }

  // --------------------------------------------------------------- expenses
  const expenses = [
    { id: uuidv7(), days: 0, type: 'INCOME', amount: 45000, category: 'Salary', note: 'September salary' },
    { id: uuidv7(), days: 0, type: 'EXPENSE', amount: 3500, category: 'Food and Dining', note: 'Lunch' },
    { id: uuidv7(), days: 0, type: 'EXPENSE', amount: 2000, category: 'Transport', note: 'Uber to client' },
    { id: uuidv7(), days: 1, type: 'EXPENSE', amount: 15000, category: 'Shopping', note: 'Office supplies' },
    { id: uuidv7(), days: 1, type: 'INCOME', amount: 25000, category: 'Business', note: 'Freelance payment' },
    { id: uuidv7(), days: 2, type: 'EXPENSE', amount: 8000, category: 'Utilities', note: 'Electricity bill' },
    { id: uuidv7(), days: 3, type: 'EXPENSE', amount: 5500, category: 'Food and Dining', note: 'Dinner' },
    { id: uuidv7(), days: 4, type: 'EXPENSE', amount: 3000, category: 'Transport', note: 'Fuel' },
    { id: uuidv7(), days: 5, type: 'INCOME', amount: 10000, category: 'Business', note: 'Consultation fee' },
    { id: uuidv7(), days: 6, type: 'EXPENSE', amount: 12000, category: 'Health', note: 'Pharmacy' }
  ]
  for (const expense of expenses) {
    const { days, ...rest } = expense
    await prisma.expense.upsert({
      where: { id: expense.id },
      update: {},
      create: {
        userId: USER_1,
        currency: 'NGN',
        amountBase: new Prisma.Decimal(rest.amount),
        exchangeRate: new Prisma.Decimal(1),
        rateIsEstimate: false,
        date: daysAgo(days, 12, 0),
        version: 1,
        source: 'MANUAL',
        ...rest
      }
    })
  }

  // ----------------------------------------------------------------- assets
  const assets = [
    { id: uuidv7(), name: 'ThinkPad T460', category: 'DEVICE', value: 200000, currency: 'NGN' },
    { id: uuidv7(), name: 'iPhone 14', category: 'DEVICE', value: 650000, currency: 'NGN' },
    {
      id: uuidv7(),
      name: 'GTBank Savings',
      category: 'BANK_ACCOUNT',
      value: 850,
      currency: 'USD',
      valueBase: 1580000,
      exchangeRate: 1858.8235,
      rateIsEstimate: true,
      note: 'Main savings account - USD to test multi-currency'
    },
    { id: uuidv7(), name: 'Honda Civic 2010', category: 'VEHICLE', value: 1200000, currency: 'NGN', note: 'Family vehicle' }
  ]
  for (const asset of assets) {
    const valueBase = asset.valueBase ?? asset.value
    const exchangeRate = asset.exchangeRate ?? 1
    const rateIsEstimate = asset.rateIsEstimate ?? false
    const { valueBase: _vb, exchangeRate: _er, rateIsEstimate: _est, ...rest } = asset
    await prisma.asset.upsert({
      where: { id: asset.id },
      update: {},
      create: {
        userId: USER_1,
        valueBase: new Prisma.Decimal(valueBase),
        exchangeRate: new Prisma.Decimal(exchangeRate),
        rateIsEstimate,
        version: 1,
        source: 'MANUAL',
        ...rest
      }
    })
  }

  console.log('Seed complete: dev@prime.itgel.com (DevPass@123!) and test@prime.itgel.com (TestPass@123!)')
}

main().catch(console.error).finally(() => prisma.$disconnect())