import { Router } from 'express'
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateSettingsSchema,
  totpCodeSchema
} from '@prime/shared'
import { parse } from '../lib/validate.js'
import { ok } from '../lib/response.js'
import { env } from '../config/env.js'
import * as authService from '../services/auth.service.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'

const router = Router()

router.post('/register', async (req, res) => {
  const data = parse(registerSchema, req.body)
  const result = await authService.register(data)
  return ok(res, result, 201)
})

router.get('/verify-email', async (req, res) => {
  const { token } = parse(verifyEmailSchema, req.query)
  const result = await authService.verifyEmail(token)
  return ok(res, result)
})

router.post('/login', async (req, res) => {
  const data = parse(loginSchema, req.body)
  const result = await authService.login(data)
  return ok(res, result)
})

router.post('/refresh', async (req, res) => {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    throw new AppError(ErrorCodes.TOKEN_INVALID, ErrorMessage[ErrorCodes.TOKEN_INVALID], {
      status: 401
    })
  }
  const result = await authService.refresh(token)
  return ok(res, result)
})

router.post('/logout', async (req, res) => {
  const familyId = req.body?.tokenFamilyId ?? null
  const result = await authService.logout(req.user.id, familyId)
  return ok(res, result)
})

router.post('/forgot-password', async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body)
  const result = await authService.forgotPassword(email)
  return ok(res, result)
})

router.post('/reset-password', async (req, res) => {
  const data = parse(resetPasswordSchema, req.body)
  const result = await authService.resetPassword(data.token, data.newPassword)
  return ok(res, result)
})

router.get('/me', async (req, res) => {
  const result = await authService.getMe(req.user.id)
  return ok(res, result)
})

router.get('/sessions', async (req, res) => {
  const result = await authService.listActiveSessions(req.user.id)
  return ok(res, result)
})

router.patch('/settings', async (req, res) => {
  const data = parse(updateSettingsSchema, req.body)
  const result = await authService.updateSettings(req.user.id, data)
  return ok(res, result)
})

// MFA (FR-AUTH-06)
router.get('/mfa/setup', async (req, res) => {
  const result = await authService.startMfaSetup(req.user.id)
  return ok(res, result)
})

router.post('/mfa/enable', async (req, res) => {
  const { totpCode } = parse(totpCodeSchema, req.body)
  const result = await authService.confirmMfaSetup({ userId: req.user.id, totpCode })
  return ok(res, result)
})

router.post('/mfa/disable', async (req, res) => {
  const { totpCode } = parse(totpCodeSchema, req.body)
  const result = await authService.disableMfa({ userId: req.user.id, totpCode })
  return ok(res, result)
})

export default router