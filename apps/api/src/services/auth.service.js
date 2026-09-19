import { v7 as uuidv7 } from 'uuid'
import { Prisma } from '@prisma/client'
import { prisma, basePrisma } from '../lib/prisma.js'
import { asUser } from '../lib/rls.js'
import { generateBase32Secret, verifyTotp, otpauthUrl } from '../lib/totp.js'
import { logger } from '../lib/logger.js'
import { env } from '../config/env.js'
import { hashPassword, verifyPassword, hashToken } from '../lib/argon2.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'
import { serializeRecord } from '../lib/serialize.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js'
import { AccountLockedError } from '../middleware/rateLimit.js'
import * as expenseService from './expense.service.js'
import * as assetService from './asset.service.js'
import {
  EMAIL_VERIFY_EXPIRY_HOURS,
  PASSWORD_RESET_EXPIRY_MINUTES
} from '@prime/shared'
import jwt from 'jsonwebtoken'

const MAX_FAILED_ATTEMPTS = 10
const ACCOUNT_LOCK_MS = 10 * 60 * 1000

function signAccessToken(userId, tokenFamilyId) {
  return jwt.sign({ userId, tokenFamilyId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  })
}

function signRefreshToken(userId, tokenFamilyId) {
  return jwt.sign({ userId, tokenFamilyId }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn
  })
}

async function storeRefreshTokenHash(userId, tokenFamilyId, token) {
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return prisma.refreshToken.create({
    data: { id: uuidv7(), userId, tokenFamilyId, tokenHash, expiresAt }
  })
}

async function issueTokenPair(userId, tokenFamilyId) {
  const accessToken = signAccessToken(userId, tokenFamilyId)
  const refreshToken = signRefreshToken(userId, tokenFamilyId)
  await storeRefreshTokenHash(userId, tokenFamilyId, refreshToken)
  return { accessToken, refreshToken }
}

// ---------------------------------------------------------------- register

export async function register({ email, password, timezone, baseCurrency }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS, ErrorMessage[ErrorCodes.EMAIL_ALREADY_EXISTS], {
      status: 409
    })
  }

  const passwordHash = await hashPassword(password)
  const userId = uuidv7()

  // user_settings carries FORCE RLS with a WITH CHECK: the creating transaction
  // must run on one connection that first sets app.current_user_id to the new
  // user's id (DB-09). Users is not RLS-protected, so the base client plus an
  // explicit SET LOCAL is deterministic here.
  await basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, TRUE)`
    await tx.user.create({ data: { id: userId, email, passwordHash } })
    await tx.userSettings.create({ data: { id: uuidv7(), userId, timezone, baseCurrency } })
  })

  const token = crypto.randomUUID()
  const tokenHash = await hashToken(token)
  await prisma.passwordResetToken.create({
    // Reuse the token table pattern: verification token is stored hashed and
    // single-use with a 24-hour expiry (NFR-SEC-11).
    data: {
      id: uuidv7(),
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_HOURS * 60 * 60 * 1000),
      usedAt: null,
      purpose: 'EMAIL_VERIFY'
    }
  })

  try {
    await sendVerificationEmail({ to: email, token })
  } catch (error) {
    logger.error('[auth] verification email send failed', { email, error: error.message })
  }

  return { message: 'Account created. Check your email to verify your account.' }
}

// -------------------------------------------------------------- verifyEmail

export async function verifyEmail(token) {
  const tokenHash = await hashToken(token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!record || record.purpose !== 'EMAIL_VERIFY') {
    throw new AppError(
      ErrorCodes.INVALID_VERIFICATION_TOKEN,
      ErrorMessage[ErrorCodes.INVALID_VERIFICATION_TOKEN],
      { status: 400 }
    )
  }
  if (record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(
      ErrorCodes.INVALID_VERIFICATION_TOKEN,
      ErrorMessage[ErrorCodes.INVALID_VERIFICATION_TOKEN],
      { status: 400 }
    )
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  ])
  return { message: 'Email verified. You can now log in.' }
}

// ------------------------------------------------------------------- login

export async function login({ email, password, totpCode }) {
  // users is not RLS-protected: lookup by email works without a session var.
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Byte-identical to wrong-password (API-05). No user enumeration.
    throw new AppError(ErrorCodes.INVALID_CREDENTIALS, ErrorMessage[ErrorCodes.INVALID_CREDENTIALS], {
      status: 401
    })
  }
  if (!user.emailVerified) {
    throw new AppError(ErrorCodes.EMAIL_NOT_VERIFIED, ErrorMessage[ErrorCodes.EMAIL_NOT_VERIFIED], {
      status: 403
    })
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw AccountLockedError(user.lockedUntil)
  }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) {
    const failedAttempts = user.failedAttempts + 1
    const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts, lockedUntil }
    })
    if (lockedUntil) throw AccountLockedError(lockedUntil)
    throw new AppError(ErrorCodes.INVALID_CREDENTIALS, ErrorMessage[ErrorCodes.INVALID_CREDENTIALS], {
      status: 401
    })
  }

  if (user.failedAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null }
    })
  }

  // FR-AUTH-06: a second factor when the user enabled MFA. Missing code and a
  // wrong code are distinguishable (MFA_REQUIRED 403 vs INVALID_MFA_CODE 401).
  if (user.mfaEnabled) {
    if (!totpCode || !verifyTotp(user.mfaSecret, totpCode)) {
      throw new AppError(
        totpCode ? ErrorCodes.INVALID_MFA_CODE : ErrorCodes.MFA_REQUIRED,
        ErrorMessage[totpCode ? ErrorCodes.INVALID_MFA_CODE : ErrorCodes.MFA_REQUIRED],
        { status: totpCode ? 401 : 403 }
      )
    }
  }

  const tokenFamilyId = uuidv7()
  const { accessToken, refreshToken } = await issueTokenPair(user.id, tokenFamilyId)

  // user_settings is FORCE RLS: read it under the authenticated user's id.
  const settings =
    (await asUser(user.id, () =>
      prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } })
    ))?.settings ?? null

  return {
    accessToken,
    refreshToken,
    user: serializeRecord({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      settings: settings
        ? {
            timezone: settings.timezone,
            baseCurrency: settings.baseCurrency,
            dailyBudget: settings.dailyBudget,
            theme: settings.theme,
            aiConsentGiven: settings.aiConsentGiven
          }
        : null
    })
  }
}

// ------------------------------------------------------------- MFA (FR-AUTH-06)

export async function startMfaSetup(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
  }
  if (user.mfaEnabled) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Two-factor authentication is already enabled.', {
      status: 409
    })
  }
  const secret = generateBase32Secret()
  // Rotate the pending secret on every setup until the confirm step succeeds.
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } })
  return serializeRecord({ secret, otpauthUrl: otpauthUrl(secret, user.email) })
}

export async function confirmMfaSetup({ userId, totpCode }) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
  }
  if (user.mfaEnabled) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Two-factor authentication is already enabled.', {
      status: 409
    })
  }
  if (!verifyTotp(user.mfaSecret, totpCode)) {
    throw new AppError(ErrorCodes.INVALID_MFA_CODE, ErrorMessage[ErrorCodes.INVALID_MFA_CODE], {
      status: 401
    })
  }
  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } })
  return serializeRecord({ message: 'Two-factor authentication enabled.' })
}

export async function disableMfa({ userId, totpCode }) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
  }
  if (user.mfaEnabled && !verifyTotp(user.mfaSecret, totpCode)) {
    throw new AppError(ErrorCodes.INVALID_MFA_CODE, ErrorMessage[ErrorCodes.INVALID_MFA_CODE], {
      status: 401
    })
  }
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null }
  })
  return serializeRecord({ message: 'Two-factor authentication disabled.' })
}

// ----------------------------------------------------------------- refresh

export async function refresh(rawRefreshToken) {
  let payload
  try {
    payload = jwt.verify(rawRefreshToken, env.jwtRefreshSecret)
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError(ErrorCodes.REFRESH_TOKEN_EXPIRED, ErrorMessage[ErrorCodes.REFRESH_TOKEN_EXPIRED], {
        status: 401
      })
    }
    throw new AppError(ErrorCodes.TOKEN_INVALID, ErrorMessage[ErrorCodes.TOKEN_INVALID], {
      status: 401
    })
  }

  const tokenHash = await hashToken(rawRefreshToken)
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } })
  if (!record) {
    throw new AppError(ErrorCodes.TOKEN_INVALID, ErrorMessage[ErrorCodes.TOKEN_INVALID], {
      status: 401
    })
  }
  if (record.consumed) {
    // Token reuse - assume theft, invalidate the whole family (FR-AUTH-05).
    await prisma.refreshToken.updateMany({
      where: { tokenFamilyId: record.tokenFamilyId },
      data: { consumed: true, consumedAt: new Date() }
    })
    throw new AppError(ErrorCodes.REFRESH_TOKEN_REUSED, ErrorMessage[ErrorCodes.REFRESH_TOKEN_REUSED], {
      status: 401
    })
  }
  if (record.expiresAt < new Date()) {
    throw new AppError(ErrorCodes.REFRESH_TOKEN_EXPIRED, ErrorMessage[ErrorCodes.REFRESH_TOKEN_EXPIRED], {
      status: 401
    })
  }

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { consumed: true, consumedAt: new Date() }
    })
  ])

  const { accessToken, refreshToken } = await issueTokenPair(record.userId, record.tokenFamilyId)
  return { accessToken, refreshToken }
}

// ------------------------------------------------------------------ logout

export async function logout(userId, familyId) {
  if (familyId) {
    await prisma.refreshToken.updateMany({
      where: { userId, tokenFamilyId: familyId },
      data: { consumed: true, consumedAt: new Date() }
    })
    return { message: 'Session signed out.' }
  }
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { consumed: true, consumedAt: new Date() }
  })
  return { message: 'Signed out on all devices.' }
}

// ---------------------------------------------------------------------- me

export async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true }
  })
  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
  }
  return serializeRecord({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    settings: user.settings
      ? {
          timezone: user.settings.timezone,
          baseCurrency: user.settings.baseCurrency,
          dailyBudget: user.settings.dailyBudget,
          theme: user.settings.theme,
          aiConsentGiven: user.settings.aiConsentGiven
        }
      : null
  })
}

export async function listActiveSessions(userId) {
  const families = await prisma.refreshToken.findMany({
    where: { userId, consumed: false },
    select: {
      tokenFamilyId: true,
      createdAt: true,
      expiresAt: true
    },
    orderBy: { createdAt: 'desc' }
  })
  return serializeRecord(families)
}

// ---------------------------------------------------------- updateSettings

export async function updateSettings(userId, data) {
  if (data.mfaEnabled !== undefined) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Use the dedicated two-factor endpoints to change MFA.',
      { status: 400 }
    )
  }
  const { totpCode: _totpCode, ...rest } = data

  const previous = await prisma.userSettings.findUnique({ where: { userId } })
  const previousBaseCurrency = previous?.baseCurrency ?? 'NGN'

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: rest,
    create: {
      id: uuidv7(),
      userId,
      ...rest
    }
  })
  // Base currency change triggers a full historical recalculation of every
  // amountBase / valueBase in the new base currency (design doc 19.3).
  if (rest.baseCurrency && rest.baseCurrency !== previousBaseCurrency) {
    logger.info('[auth] base currency change; recomputing history', { userId, to: rest.baseCurrency })
    await Promise.all([
      expenseService.recomputeBaseCurrency(userId, rest.baseCurrency),
      assetService.recomputeBaseValues(userId, rest.baseCurrency)
    ])
  }
  return serializeRecord(settings)
}

// ---------------------------------------------------------- forgotPassword

export async function forgotPassword(email) {
  // Always succeeds - no user enumeration (design doc 9.4).
  const user = await prisma.user.findUnique({ where: { email } })
  if (user && user.emailVerified) {
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, purpose: 'PASSWORD_RESET' },
      data: { usedAt: new Date() }
    })
    const token = crypto.randomUUID()
    const tokenHash = await hashToken(token)
    await prisma.passwordResetToken.create({
      data: {
        id: uuidv7(),
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000),
        purpose: 'PASSWORD_RESET'
      }
    })
    try {
      await sendPasswordResetEmail({ to: email, token })
    } catch (error) {
      logger.error('[auth] reset email failed', { email, error: error.message })
    }
  }
  return { message: 'If an account exists for that email, a reset link has been sent.' }
}

// ------------------------------------------------------------- resetPassword

export async function resetPassword(token, newPassword) {
  const tokenHash = await hashToken(token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!record || record.purpose !== 'PASSWORD_RESET') {
    throw new AppError(ErrorCodes.INVALID_RESET_TOKEN, ErrorMessage[ErrorCodes.INVALID_RESET_TOKEN], {
      status: 400
    })
  }
  if (record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(ErrorCodes.INVALID_RESET_TOKEN, ErrorMessage[ErrorCodes.INVALID_RESET_TOKEN], {
      status: 400
    })
  }

  const passwordHash = await hashPassword(newPassword)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalidate all refresh token families (FR-AUTH-11).
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, consumed: false },
      data: { consumed: true, consumedAt: new Date() }
    })
  ])
  return { message: 'Password updated. Please log in.' }
}