import { Router } from 'express'
import { ok } from '../lib/response.js'
import * as exchangeRateService from '../services/exchange-rate.service.js'

const router = Router()

router.get('/', async (req, res) => {
  const result = await exchangeRateService.getRatesForUser(req.user.id)
  return ok(res, result)
})

export default router