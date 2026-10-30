import { Router } from 'express'
import { ok } from '../lib/response.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'
import { SUPPORTED_CURRENCIES } from '@prime/shared'
import * as exchangeRateService from '../services/exchange-rate.service.js'

const router = Router()

function validateCurrency(value) {
  return typeof value === 'string' && SUPPORTED_CURRENCIES.includes(value)
}

router.get('/', async (req, res) => {
  const { from, to } = req.query
  if (from || to) {
    // Single-pair lookup used by the mobile client on the add-expense/asset
    // forms (contract: { fromCurrency, toCurrency, rate, isEstimate, fetchedAt }).
    if (!validateCurrency(from) || !validateCurrency(to)) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, ErrorMessage[ErrorCodes.VALIDATION_FAILED], {
        status: 422
      })
    }
    const result = await exchangeRateService.getSingleRateForUser(req.user.id, from, to)
    return ok(res, result)
  }
  const result = await exchangeRateService.getRatesForUser(req.user.id)
  return ok(res, result)
})

export default router