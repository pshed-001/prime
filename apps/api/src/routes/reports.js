import { Router } from 'express'
import { z } from 'zod'
import { ok } from '../lib/response.js'
import { parse } from '../lib/validate.js'
import * as reportService from '../services/report.service.js'

const router = Router()

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

const generateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
})

router.get('/', async (req, res) => {
  const query = parse(listQuerySchema, req.query)
  const result = await reportService.listReports({ userId: req.user.id, ...query })
  return ok(res, result)
})

router.post('/generate', async (req, res) => {
  const { date } = parse(generateSchema, req.body)
  const result = await reportService.generateReport({ userId: req.user.id, date })
  return ok(res, result, 201)
})

router.get('/:id', async (req, res) => {
  const result = await reportService.getReport({ userId: req.user.id, id: req.params.id })
  return ok(res, result)
})

export default router