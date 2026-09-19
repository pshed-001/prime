import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { disconnect } from './lib/prisma.js'

const app = createApp()

const server = app.listen(env.port, () => {
  logger.info(`[boot] PRIME API listening on http://localhost:${env.port} (${env.nodeEnv})`)
})

async function shutdown(signal) {
  logger.info(`[boot] ${signal} received - shutting down`)
  server.close(async () => {
    await disconnect()
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))