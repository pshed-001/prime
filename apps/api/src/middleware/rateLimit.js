import rateLimit from 'express-rate-limit'
import expressSlowDown from 'express-slow-down'
import { env } from '../config/env.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'

function onLimitReached(req, res, next) {
  // eslint-disable-next-line no-unused-vars
  ;(async () => {})()
}

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
  handler: failHandler,
  onLimitReached
})

// Step 6 - progressive delay before the hard limit
export const slowDown = expressSlowDown({
  windowMs: env.rateLimit.windowMs,
  delayAfter: Math.floor(env.rateLimit.max * 0.8),
  delayMs: (hits) => Math.min(hits * 100, 1000)
})

// Step 9 - per-authenticated-user limiter (after auth, separate from IP)
export const userRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : req.ip),
  handler: failHandler,
  onLimitReached
})

export const AccountLockedError = (unlockTime) => {
  const message = ErrorMessage[ErrorCodes.ACCOUNT_LOCKED].replace(
    '{unlockTime}',
    unlockTime.toISOString()
  )
  return new AppError(ErrorCodes.ACCOUNT_LOCKED, message, { status: 429, data: { unlockTime } })
}