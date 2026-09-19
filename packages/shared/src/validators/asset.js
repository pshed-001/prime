import { z } from 'zod'
import {
  ASSET_CATEGORIES,
  SUPPORTED_CURRENCIES,
  SOURCES
} from '../constants/index.js'

const categoryEnum = z.enum(ASSET_CATEGORIES)
const currencyEnum = z.enum(SUPPORTED_CURRENCIES)
const sourceEnum = z.enum(SOURCES)

export const createAssetSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  category: categoryEnum,
  value: z.number().positive().max(100_000_000_000),
  currency: currencyEnum.default('NGN'),
  note: z.string().max(500).optional().nullable(),
  acquiredAt: z.string().datetime().optional().nullable(),
  source: sourceEnum.default('MANUAL')
})

export const updateAssetSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    value: z.number().positive().max(100_000_000_000).optional(),
    currency: currencyEnum.optional(),
    note: z.string().max(500).optional().nullable(),
    acquiredAt: z.string().datetime().optional().nullable()
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided for update'
  })