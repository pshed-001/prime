import { Router } from 'express'
import { z } from 'zod'
import { createExpenseSchema, updateExpenseSchema, TRANSACTION_TYPES } from '@prime/shared'
import { parse } from '../lib/validate.js'
import { ok } from '../lib/response.js'
import * as expenseService from '../services/expense.service.js'

const router = Router()

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true')
})

const rangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
})

router.get('/', async (req, res) => {
  const query = parse(listQuerySchema, req.query)
  const result = await expenseService.listExpenses({ userId: req.user.id, ...query })
  return ok(res, result)
})

router.post('/', async (req, res) => {
  const data = parse(createExpenseSchema, req.body)
  const result = await expenseService.createExpense({ userId: req.user.id, data })
  return ok(res, result, 201)
})

router.get('/summary/today', async (req, res) => {
  const result = await expenseService.summaryByRange({ userId: req.user.id })
  return ok(res, result)
})

router.get('/summary/range', async (req, res) => {
  const query = parse(rangeQuerySchema, req.query)
  const result = await expenseService.summaryByRange({ userId: req.user.id, ...query })
  return ok(res, result)
})

router.get('/:id', async (req, res) => {
  const result = await expenseService.getExpense({ userId: req.user.id, id: req.params.id })
  return ok(res, result)
})

router.patch('/:id', async (req, res) => {
  const data = parse(updateExpenseSchema, req.body)
  const result = await expenseService.updateExpense({ userId: req.user.id, id: req.params.id, data })
  return ok(res, result)
})

router.delete('/:id', async (req, res) => {
  const result = await expenseService.deleteExpense({ userId: req.user.id, id: req.params.id })
  return ok(res, result)
})

export default router