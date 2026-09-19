import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { PUBLIC_ENDPOINTS } from '@prime/shared'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'
import { runWithUserId } from '../lib/rls.js'

const EXEMPT = new Set(PUBLIC_ENDPOINTS)

function requiresAuth(path) {
  if (EXEMPT.has(path)) return false
  // Refresh token route is protected by a refresh token, not an access token.
  if (path === '/api/auth/refresh') return false
  return true
}

export function authenticateJWT(req, res, next) {
  if (!requiresAuth(req.path)) return next()

  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return next(
      new AppError(ErrorCodes.TOKEN_INVALID, ErrorMessage[ErrorCodes.TOKEN_INVALID], {
        status: 401
      })
    )
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    req.user = { id: payload.userId, tokenFamilyId: payload.tokenFamilyId }
    return next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(
        new AppError(ErrorCodes.TOKEN_EXPIRED, ErrorMessage[ErrorCodes.TOKEN_EXPIRED], {
          status: 401
        })
      )
    }
    return next(
      new AppError(ErrorCodes.TOKEN_INVALID, ErrorMessage[ErrorCodes.TOKEN_INVALID], {
        status: 401
      })
    )
  }
}

// DB-09: stash userId for withRls() so SET LOCAL and the query share a transaction.
export function injectRLSContext(req, _res, next) {
  if (!req.user?.id) return next()
  runWithUserId(req.user.id, () => next())
}