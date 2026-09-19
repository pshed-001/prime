import { z } from 'zod'
import { SUPPORTED_CURRENCIES } from '../constants/index.js'

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a symbol')

const currencyEnum = z.enum(SUPPORTED_CURRENCIES)

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: passwordSchema,
    confirmPassword: z.string(),
    timezone: z.string().min(1, 'Timezone is required'),
    baseCurrency: currencyEnum.default('NGN'),
    privacyAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the privacy policy' })
    })
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().regex(/^\d{6}$/).optional()
})

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim()
})

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  newPassword: passwordSchema
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1)
})

export const updateSettingsSchema = z
  .object({
    timezone: z.string().optional(),
    baseCurrency: currencyEnum.optional(),
    dailyBudget: z.number().positive().optional().nullable(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    aiConsentGiven: z.boolean().optional(),
    mfaEnabled: z.boolean().optional(),
    totpCode: z.string().regex(/^\d{6}$/).optional()
  })
  .refine((d) => Object.keys(d).filter((k) => k !== 'totpCode').length > 0, {
    message: 'At least one setting field must be provided'
  })

export const totpCodeSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Enter the 6-digit authenticator code')
})

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.literal('DELETE')
})