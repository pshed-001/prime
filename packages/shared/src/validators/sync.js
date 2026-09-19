import { z } from 'zod'
import { SYNC_OPS } from '../constants/index.js'

const opEnum = z.enum(SYNC_OPS)

export const syncOperationSchema = z.object({
  idempotencyKey: z.string().uuid('idempotencyKey must be a valid UUID'),
  operation: opEnum,
  tableName: z.enum(['tasks', 'expenses', 'assets']),
  recordId: z.string().uuid('recordId must be a valid UUID'),
  payload: z.record(z.unknown()),
  clientVersion: z.number().int().positive()
})

export const syncBatchSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(50),
  lastSyncTimestamp: z.string().datetime().optional().nullable()
})

export const sinceQuerySchema = z.object({
  since: z.string().datetime().optional().nullable()
})