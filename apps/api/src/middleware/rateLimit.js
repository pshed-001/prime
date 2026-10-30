import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import expressSlowDown from 'express-slow-down'
import { env } from '../config/env.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'

// IPv6-aware key. express-rate-limit's default aggregates IPv6 to a /56
// subnet; callers must route IP fallbacks through ipKeyGenerator or v8 rejects
// the config at boot and IPv6 addresses can rotate /64s to dodge the limiter.
const ipKey = (req) =>
  ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? 'unknown')


const failHandler = (req, res) => {
  res.set('Cache-Control', 'no-store, private')
  return res.status(429).json({
    success: false,
    data: null,
    error: ErrorMessage[ErrorCodes.RATE_LIMIT_EXCEEDED],
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    timestamp: new Date().toISOString()
  })
}

// Step 5 - per-IP limiter (before auth)
export const ipRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: failHandler
})

// Step 6 - progressive delay before the hard limit
export const slowDown = expressSlowDown({
  windowMs: env.rateLimit.windowMs,
  delayAfter: Math.floor(env.rateLimit.max * 0.8),
  delayMs: (hits) => Math.min(hits * 100, 1000),
  keyGenerator: ipKey
})

// Step 9 - per-authenticated-user limiter (after auth, separate from IP)
export const userRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Authenticated requests bucket by user; unauthenticated requests keep the
  // IPv6-aggregated IP key so they cannot be dodged via address rotation.
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKey(req)),
  handler: failHandler
})

export const AccountLockedError = (unlockTime) => {
  const message = ErrorMessage[ErrorCodes.ACCOUNT_LOCKED].replace(
    '{unlockTime}',
    unlockTime.toISOString()
  )
  return new AppError(ErrorCodes.ACCOUNT_LOCKED, message, { status: 429, data: { unlockTime } })
}