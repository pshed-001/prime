import { z } from 'zod'
import {
  TRANSACTION_TYPES,
  SUPPORTED_CURRENCIES
} from '../constants/index.js'

const typeEnum = z.enum(TRANSACTION_TYPES)
const currencyEnum = z.enum(SUPPORTED_CURRENCIES)
const dateRegex = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const amountSchema = z.number().positive().max(10_000_000)

// Applied to raw Qwen model output - nullable fields allowed
const aiEntrySchema = z.object({
  type: typeEnum,
  amount: amountSchema.nullable(),
  currency: currencyEnum.default('NGN'),
  category: z.string().min(1).max(100).nullable(),
  date: dateRegex.nullable(),
  note: z.string().max(500).nullable()
})

export const aiScanResultSchema = z.object({
  entries: z.array(aiEntrySchema).min(1).max(50)
})

// Applied after user edits - all nullable fields must be filled
export const aiConfirmSchema = z.object({
  entries: z
    .array(
      z.object({
        type: typeEnum,
        amount: amountSchema,
        currency: currencyEnum,
        category: z.string().min(1).max(100),
        date: dateRegex,
        note: z.string().max(500).optional().nullable()
      })
    )
    .min(1)
    .max(50)
})

export const jobParamsSchema = z.object({
  jobId: z.string().min(1)
})