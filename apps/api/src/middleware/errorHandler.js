import { logger } from '../lib/logger.js'
import { ErrorCodes, ErrorMessage } from '../lib/errors.js'
import { fail } from '../lib/response.js'

export function notFoundHandler(req, res) {
  return fail(res, {
    code: ErrorCodes.NOT_FOUND,
    message: ErrorMessage[ErrorCodes.NOT_FOUND],
    httpStatus: 404
  })
}

// Express 5 catches async errors automatically and forwards them here.
export function globalErrorHandler(err, req, res, next) {
  logger.error('[http] request failed', {
    method: req.method,
    path: req.path,
    userId: req.user?.id ?? null,
    error: err?.message
  })
  // Never leak stack traces in production (rule API-03 / C-01).
  if (req.app.get('env') === 'production' && err?.stack) {
    delete err.stack
  }
  if (err?.name === 'MulterError') {
    // Oversized uploads surface as MulterError, not AppError (routes/ai.js).
    const code = err.code === 'LIMIT_FILE_SIZE' ? ErrorCodes.IMAGE_TOO_LARGE : ErrorCodes.VALIDATION_FAILED
    return fail(res, {
      code,
      message: ErrorMessage[code],
      httpStatus: code === ErrorCodes.IMAGE_TOO_LARGE ? 400 : 422
    })
  }
  return fail(res, err)
}