import { logger } from './logger.js'

export class AppError extends Error {
  constructor(code, message, { status = 500, details = null, data = null } = {}) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.httpStatus = status
    this.details = details
    this.data = data
  }
}

export const ErrorCodes = {
  // Auth
  INVALID_VERIFICATION_TOKEN: 'INVALID_VERIFICATION_TOKEN',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  INVALID_MFA_CODE: 'INVALID_MFA_CODE',
  FORBIDDEN: 'FORBIDDEN',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_IDEMPOTENCY_KEY: 'DUPLICATE_IDEMPOTENCY_KEY',
  REPORT_ALREADY_EXISTS: 'REPORT_ALREADY_EXISTS',
  GONE: 'GONE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  // AI
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  INVALID_IMAGE_FORMAT: 'INVALID_IMAGE_FORMAT',
  AI_PARSE_FAILED: 'AI_PARSE_FAILED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  AI_RATE_LIMIT_EXCEEDED: 'AI_RATE_LIMIT_EXCEEDED',
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
}

export const ErrorMessage = {
  [ErrorCodes.INVALID_VERIFICATION_TOKEN]:
    'This verification link is invalid or has expired.',
  [ErrorCodes.INVALID_RESET_TOKEN]: 'This password reset link is invalid or has expired.',
  [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [ErrorCodes.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCodes.TOKEN_INVALID]: 'Your session is invalid. Please log in again.',
  [ErrorCodes.REFRESH_TOKEN_REUSED]:
    'Security alert: your session was invalidated. Please log in again.',
  [ErrorCodes.REFRESH_TOKEN_EXPIRED]:
    'Your session has expired. Please log in again.',
  [ErrorCodes.EMAIL_NOT_VERIFIED]:
    'Please verify your email address before logging in.',
  [ErrorCodes.MFA_REQUIRED]: 'Enter the 6-digit code from your authenticator app.',
  [ErrorCodes.INVALID_MFA_CODE]: 'That authenticator code is invalid.',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCodes.EMAIL_ALREADY_EXISTS]:
    'An account with this email address already exists.',
  [ErrorCodes.ACCOUNT_LOCKED]:
    'Account temporarily locked. Try again after {unlockTime}.',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait before trying again.',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.CONFLICT]:
    'This record was updated by a newer version. The server version has been applied.',
  [ErrorCodes.DUPLICATE_IDEMPOTENCY_KEY]: 'This operation was already processed.',
  [ErrorCodes.REPORT_ALREADY_EXISTS]: 'A report for this date already exists.',
  [ErrorCodes.GONE]: 'This record has been deleted.',
  [ErrorCodes.VALIDATION_FAILED]: 'Validation failed.',
  [ErrorCodes.IMAGE_TOO_LARGE]: 'Image must be smaller than 10MB.',
  [ErrorCodes.INVALID_IMAGE_FORMAT]: 'Only JPEG and PNG images are accepted.',
  [ErrorCodes.AI_PARSE_FAILED]:
    'Could not extract financial data from this image. Please enter the data manually.',
  [ErrorCodes.JOB_NOT_FOUND]: 'This scan job was not found or has expired.',
  [ErrorCodes.AI_RATE_LIMIT_EXCEEDED]: 'You have reached the limit of 30 AI scans per hour.',
  [ErrorCodes.INTERNAL_ERROR]: 'Something went wrong. Please try again.',
  [ErrorCodes.SERVICE_UNAVAILABLE]:
    'The service is temporarily unavailable. Please try again shortly.'
}

export const ErrorStatus = {
  [ErrorCodes.INVALID_VERIFICATION_TOKEN]: 400,
  [ErrorCodes.INVALID_RESET_TOKEN]: 400,
  [ErrorCodes.INVALID_CREDENTIALS]: 401,
  [ErrorCodes.TOKEN_EXPIRED]: 401,
  [ErrorCodes.TOKEN_INVALID]: 401,
  [ErrorCodes.REFRESH_TOKEN_REUSED]: 401,
  [ErrorCodes.REFRESH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.EMAIL_NOT_VERIFIED]: 403,
  [ErrorCodes.MFA_REQUIRED]: 403,
  [ErrorCodes.INVALID_MFA_CODE]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.EMAIL_ALREADY_EXISTS]: 409,
  [ErrorCodes.ACCOUNT_LOCKED]: 429,
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.DUPLICATE_IDEMPOTENCY_KEY]: 409,
  [ErrorCodes.REPORT_ALREADY_EXISTS]: 409,
  [ErrorCodes.GONE]: 410,
  [ErrorCodes.VALIDATION_FAILED]: 422,
  [ErrorCodes.IMAGE_TOO_LARGE]: 400,
  [ErrorCodes.INVALID_IMAGE_FORMAT]: 400,
  [ErrorCodes.AI_PARSE_FAILED]: 400,
  [ErrorCodes.JOB_NOT_FOUND]: 404,
  [ErrorCodes.AI_RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503
}

export function detectPrismaFriendlyError(error) {
  // PrismaClientKnownRequestError etc. never surface to the client (rule API-03).
  if (error?.name && error.name.startsWith('PrismaClient')) {
    const dbUnavailable =
      error.name === 'PrismaClientInitializationError' ||
      !!(error?.message && /ECONNREFUSED|connect|can't reach database|P1001/i.test(error.message))
    logger.error('[prisma] error', { name: error.name, message: error.message })
    throw new AppError(
      dbUnavailable ? ErrorCodes.SERVICE_UNAVAILABLE : ErrorCodes.INTERNAL_ERROR,
      dbUnavailable
        ? ErrorMessage[ErrorCodes.SERVICE_UNAVAILABLE]
        : ErrorMessage[ErrorCodes.INTERNAL_ERROR],
      {
        status: dbUnavailable ? 503 : 500
      }
    )
  }
  return error
}