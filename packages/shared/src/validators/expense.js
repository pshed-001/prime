import { z } from 'zod'
import {
  TRANSACTION_TYPES,
  EXPENSE_CATEGORIES,
  SUPPORTED_CURRENCIES,
  SOURCES
} from '../constants/index.js'

const typeEnum = z.enum(TRANSACTION_TYPES)
const currencyEnum = z.enum(SUPPORTED_CURRENCIES)
const sourceEnum = z.enum(SOURCES)

export const categorySchema = z
  .string()
  .min(1, 'Category is required')
  .max(100, 'Category too long')

export const createExpenseSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(100_000_000, 'Amount exceeds maximum single entry limit'),
  currency: currencyEnum.default('NGN'),
  type: typeEnum,
  category: categorySchema,
  note: z.string().max(500).optional().nullable(),
  date: z.string().datetime(),
  source: sourceEnum.default('MANUAL')
})

export const updateExpenseSchema = z
  .object({
    amount: z.number().positive().max(100_000_000).optional(),
    currency: currencyEnum.optional(),
    type: typeEnum.optional(),
    category: categorySchema.optional(),
    note: z.string().max(500).optional().nullable(),
    date: z.string().datetime().optional()
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided for update'
  })