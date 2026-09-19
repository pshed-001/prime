import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import { env } from './config/env.js'
import { ipRateLimiter, slowDown, userRateLimiter } from './middleware/rateLimit.js'
import { deviceFingerprint } from './middleware/deviceFingerprint.js'
import { authenticateJWT, injectRLSContext } from './middleware/authenticate.js'
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js'
import apiRouter from './routes/index.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)

  // 12.2 - middleware stack in this exact order
  app.use(helmet()) // 1
  app.use(
    cors(
      env.isProduction
        ? { origin: env.corsOrigins } // never wildcard in production (API-08)
        : { origin: true }
    )
  ) // 2
  app.use(compression()) // 3
  app.use(express.json({ limit: '1mb' })) // 4
  app.use(ipRateLimiter) // 5 - before route handlers (API-06)
  app.use(slowDown) // 6
  app.use(deviceFingerprint) // 7
  app.use(authenticateJWT) // 8
  app.use(userRateLimiter) // 9 - separate from IP limit
  app.use(injectRLSContext) // 10 - SET LOCAL app.current_user_id

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: { status: 'ok' },
      error: null,
      timestamp: new Date().toISOString()
    })
  })
  app.get('/api/version', (_req, res) => {
    res.status(200).json({
      success: true,
      data: { name: 'prime-api', version: '1.0.0', environment: env.nodeEnv },
      error: null,
      timestamp: new Date().toISOString()
    })
  })

  app.use('/api', apiRouter) // 11

  app.use(notFoundHandler) // 12
  app.use(globalErrorHandler) // 13 - never exposes stack traces in production

  return app
}