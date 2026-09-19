import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getRlsUserId } from './rls.js'
import { env } from '../config/env.js'

export const basePrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
})

// DB-09: every protected operation runs inside a single PostgreSQL transaction
// that first executes SET LOCAL app.current_user_id, so PgBouncer transaction
// pooling cannot leak the app.current_user_id between requests. Without a user
// context (public routes) the query runs unmodified; the FORCE RLS policies
// then fail closed (zero rows / WITH CHECK violation) - defence-in-depth.
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const userId = getRlsUserId()
        if (!userId) return query(args)
        const [, result] = await basePrisma.$transaction([
          basePrisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, TRUE)`,
          query(args)
        ])
        return result
      }
    }
  }
})

export async function disconnect() {
  await basePrisma.$disconnect()
}