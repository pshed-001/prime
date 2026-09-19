import { v7 as uuidv7 } from 'uuid'
import { prisma } from '../lib/prisma.js'
import { withRls } from '../lib/rls.js'
import { serializeRecord } from '../lib/serialize.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'

export async function createTask({ userId, data }) {
  const task = await prisma.task.create({
    data: { userId, ...data, id: data.id ?? uuidv7() }
  })
  return serializeRecord(task)
}

export async function listTasks({
  userId,
  page = 1,
  limit = 20,
  status,
  priority,
  includeDeleted = false
}) {
  const where = { userId }
  if (!includeDeleted) where.deletedAt = null
  if (status) where.status = status
  if (priority) where.priority = priority

  const { total, rows } = await withRls(async (tx) => {
    const total = await tx.task.count({ where })
    const rows = await tx.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit
    })
    return { total, rows }
  })
  return { total, page, limit, data: serializeRecord(rows) }
}

export async function getTask({ userId, id }) {
  const task = await prisma.task.findFirst({ where: { id, userId } })
  if (!task) throw notFound()
  return serializeRecord(task)
}

export async function updateTask({ userId, id, data }) {
  const existing = await prisma.task.findFirst({ where: { id, userId } })
  if (!existing) throw notFound()

  const task = await prisma.task.update({
    where: { id },
    data: { ...data, version: { increment: 1 } }
  })
  return serializeRecord(task)
}

export async function deleteTask({ userId, id }) {
  const existing = await prisma.task.findFirst({ where: { id, userId } })
  if (!existing) throw notFound()
  if (existing.deletedAt) {
    throw new AppError(ErrorCodes.GONE, ErrorMessage[ErrorCodes.GONE], { status: 410 })
  }

  // DB-07: tombstone written in the same transaction as the soft delete.
  await withRls(async (tx) => {
    await tx.task.update({ where: { id }, data: { deletedAt: new Date() } })
    await tx.tombstone.create({ data: { id: uuidv7(), userId, tableName: 'tasks', recordId: id } })
  })
  return { message: 'Task deleted.' }
}

function notFound() {
  return new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
}