import { AsyncLocalStorage } from 'node:async_hooks'
import { basePrisma } from './prisma.js'

// DB-09: SET LOCAL app.current_user_id must share a PostgreSQL transaction
// with the queries it protects (PgBouncer transaction pooling). lib/prisma.js
// injects the stored user id via an RLS query extension; identity for public
// routes (register/login) is provided explicitly through asUser().

export const rlsStorage = new AsyncLocalStorage()

export function getRlsUserId() {
  return rlsStorage.getStore() ?? null
}

export function runWithUserId(userId, fn) {
  return rlsStorage.run(userId, fn)
}

// Deterministic multi-statement transactions. Runs on the base (non-extended)
// client so every statement shares ONE connection with the SET LOCAL config;
// the RLS extension must never wrap individual statements that already sit
// inside an outer transaction (nested batches can land on different
// connections, breaking atomicity and FK visibility). fn receives the raw tx.
export async function withRls(fn) {
  const userId = getRlsUserId()
  return basePrisma.$transaction(async (tx) => {
    if (userId) {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`
    }
    return fn(tx)
  })
}

// Runs fn with the user id set for the whole await chain. Must be awaited
// directly (the ALS context only covers the async chain started by run()).
export function asUser(userId, fn) {
  return rlsStorage.run(userId, async () => fn())
}
