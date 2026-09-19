import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL')
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js'
  }
})