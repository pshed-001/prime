import { Router } from 'express'
import { z } from 'zod'
import {
  createTaskSchema,
  updateTaskSchema,
  PRIORITIES,
  TASK_STATUSES
} from '@prime/shared'
import { parse } from '../lib/validate.js'
import { ok } from '../lib/response.js'
import * as taskService from '../services/task.service.js'

const router = Router()

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true')
})

router.get('/', async (req, res) => {
  const query = parse(listQuerySchema, req.query)
  const result = await taskService.listTasks({ userId: req.user.id, ...query })
  return ok(res, result)
})

router.post('/', async (req, res) => {
  const data = parse(createTaskSchema, req.body)
  const result = await taskService.createTask({ userId: req.user.id, data })
  return ok(res, result, 201)
})

router.get('/:id', async (req, res) => {
  const result = await taskService.getTask({ userId: req.user.id, id: req.params.id })
  return ok(res, result)
})

router.patch('/:id', async (req, res) => {
  const data = parse(updateTaskSchema, req.body)
  const result = await taskService.updateTask({ userId: req.user.id, id: req.params.id, data })
  return ok(res, result)
})

router.delete('/:id', async (req, res) => {
  const result = await taskService.deleteTask({ userId: req.user.id, id: req.params.id })
  return ok(res, result)
})

export default router