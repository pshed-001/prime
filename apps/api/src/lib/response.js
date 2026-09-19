import { AppError, ErrorCodes, ErrorMessage, ErrorStatus, detectPrismaFriendlyError } from './errors.js'

export function ok(res, data, status = 200) {
  res.set('Cache-Control', 'no-store, private')
  return res.status(status).json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString()
  })
}

export function fail(res, error) {
  // Prisma errors never leak (API-03). Mapped to the error catalogue.
  const mapped = detectPrismaFriendlyError(error)

  if (mapped instanceof AppError) {
    const status = mapped.httpStatus ?? ErrorStatus[mapped.code] ?? 500
    res.set('Cache-Control', 'no-store, private')
    const body = {
      success: false,
      data: mapped.data ?? null,
      error: mapped.message ?? ErrorMessage[mapped.code] ?? 'Unknown error',
      code: mapped.code,
      timestamp: new Date().toISOString()
    }
    if (mapped.details) body.errors = mapped.details
    return res.status(status).json(body)
  }

  if (Array.isArray(mapped)) {
    // ZodError already converted by parse() into AppError - not reachable.
    return res.status(422).json({
      success: false,
      data: null,
      error: ErrorMessage[ErrorCodes.VALIDATION_FAILED],
      code: ErrorCodes.VALIDATION_FAILED,
      errors: mapped,
      timestamp: new Date().toISOString()
    })
  }

  res.set('Cache-Control', 'no-store, private')
  return res.status(500).json({
    success: false,
    data: null,
    error: ErrorMessage[ErrorCodes.INTERNAL_ERROR],
    code: ErrorCodes.INTERNAL_ERROR,
    timestamp: new Date().toISOString()
  })
}