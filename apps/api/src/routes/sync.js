import { Router } from 'express'
import { z } from 'zod'
import { syncBatchSchema } from '@prime/shared'
import { parse } from '../lib/validate.js'
import { ok } from '../lib/response.js'
import * as syncService from '../services/sync.service.js'

const router = Router()

const sinceSchema = z.object({
  since: z.string().datetime().optional()
})

router.post('/', async (req, res) => {
  const data = parse(syncBatchSchema, req.body)
  const result = await syncService.processSyncBatch({
    userId: req.user.id,
    operations: data.operations,
    lastSyncTimestamp: data.lastSyncTimestamp ?? null
  })
  return ok(res, result)
})

router.get('/tombstones', async (req, res) => {
  const query = parse(sinceSchema, req.query)
  const result = await syncService.fetchTombstones({ userId: req.user.id, since: query.since })
  return ok(res, result)
})

export default router