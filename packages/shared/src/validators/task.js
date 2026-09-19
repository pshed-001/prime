import { z } from 'zod'
import { PRIORITIES, TASK_STATUSES, SOURCES } from '../constants/index.js'

const priorityEnum = z.enum(PRIORITIES)
const statusEnum = z.enum(TASK_STATUSES)
const sourceEnum = z.enum(SOURCES)

export const createTaskSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000).optional().nullable(),
  priority: priorityEnum.default('MEDIUM'),
  status: statusEnum.default('PENDING'),
  dueDate: z.string().datetime().optional().nullable(),
  source: sourceEnum.default('MANUAL')
})

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    priority: priorityEnum.optional(),
    status: statusEnum.optional(),
    dueDate: z.string().datetime().optional().nullable()
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided for update'
  })