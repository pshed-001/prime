import { Router } from 'express'
import { ok } from '../lib/response.js'
import * as marketService from '../services/market.service.js'

const router = Router()

// Live market board (crypto, indices, news). All sources are cached server-side
// with short TTLs; the client polls this endpoint on an interval while focused.
router.get('/live', async (_req, res) => {
  return ok(res, await marketService.getLiveFeed())
})

export default router