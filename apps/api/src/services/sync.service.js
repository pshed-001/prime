import { v7 as uuidv7 } from 'uuid'
import { prisma } from '../lib/prisma.js'
import { withRls } from '../lib/rls.js'
import { serializeRecord } from '../lib/serialize.js'
import { saveIdempotencyResult, getIdempotencyResult } from '../lib/idempotency.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'
import * as taskService from './task.service.js'
import * as expenseService from './expense.service.js'
import * as assetService from './asset.service.js'
import { logger } from '../lib/logger.js'

const MODEL_BY_TABLE = {
  tasks: 'task',
  expenses: 'expense',
  assets: 'asset'
}

async function ensureSyncedAt(tableName, recordId, timestamp) {
  const model = MODEL_BY_TABLE[tableName]
  if (!model) return
  await prisma[model].updateMany({ where: { id: recordId }, data: { syncedAt: timestamp } })
}

function conflict(serverRecord) {
  return new AppError(ErrorCodes.CONFLICT, ErrorMessage[ErrorCodes.CONFLICT], {
    status: 409,
    data: serializeRecord(serverRecord)
  })
}

function gone() {
  return new AppError(ErrorCodes.GONE, ErrorMessage[ErrorCodes.GONE], { status: 410 })
}

async function validateOwner(userId, tableName, recordId) {
  const model = MODEL_BY_TABLE[tableName]
  return prisma[model].findFirst({ where: { id: recordId, userId } })
}

async function setDeleteState(userId, tableName, recordId, deletedAt) {
  const model = MODEL_BY_TABLE[tableName]
  if (!model) throw new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })

  // DB-07: tombstone written in the same transaction as the soft delete.
  const updated = await withRls(async (tx) => {
    const result = await tx[model].update({
      where: { id: recordId },
      data: { deletedAt }
    })
    await tx.tombstone.create({
      data: { id: uuidv7(), userId, tableName, recordId }
    })
    return result
  })
  return serializeRecord(updated)
}

function withRecordId(handler, userId, payload, recordId) {
  // The client-generated record id must be the server id (DB-01). The sync
  // payload does not carry it - the envelope does.
  return handler(userId, { ...payload, id: recordId })
}

const CREATE_HANDLERS = {
  tasks: (userId, payload) => taskService.createTask({ userId, data: payload }),
  expenses: (userId, payload) => expenseService.createExpense({ userId, data: payload }),
  assets: (userId, payload) => assetService.createAsset({ userId, data: payload })
}

const UPDATE_HANDLERS = {
  tasks: (userId, id) => taskService.getTask({ userId, id }),
  expenses: (userId, id) => expenseService.getExpense({ userId, id }),
  assets: (userId, id) => assetService.getAsset({ userId, id })
}

async function processOperation(userId, op, serverTimestamp) {
  const { idempotencyKey, operation, tableName, recordId, payload, clientVersion } = op

  const cached = getIdempotencyResult(`${userId}:${idempotencyKey}`)
  if (cached) return cached

  let result

  if (operation === 'CREATE') {
    const existing = await validateOwner(userId, tableName, recordId)
    if (existing) {
      // Network retry of a CREATE - return the original record (idempotent).
      result = { idempotencyKey, status: 201, serverRecord: serializeRecord(existing) }
    } else {
      const handler = CREATE_HANDLERS[tableName]
      if (!handler) throw new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })
      const created = await withRecordId(handler, userId, payload, recordId)
      await ensureSyncedAt(tableName, recordId, serverTimestamp)
      result = { idempotencyKey, status: 201, serverRecord: created }
    }
  } else if (operation === 'UPDATE') {
    const existing = await validateOwner(userId, tableName, recordId)
    if (!existing) {
      // Server never saw the record - treat as CREATE (design doc 6.3).
      const handler = CREATE_HANDLERS[tableName]
      const created = await withRecordId(handler, userId, payload, recordId)
      await ensureSyncedAt(tableName, recordId, serverTimestamp)
      result = { idempotencyKey, status: 201, serverRecord: created }
    } else if (existing.deletedAt) {
      result = { idempotencyKey, status: 410, serverRecord: serializeRecord(existing) }
    } else if (existing.version > clientVersion) {
      result = { idempotencyKey, status: 409, serverRecord: serializeRecord(existing) }
    } else {
      // Client is up to date with what it knows - last-write-wins, server applies.
      const updated = await applyUpdate(userId, tableName, recordId, payload, serverTimestamp)
      result = { idempotencyKey, status: 200, serverRecord: updated }
    }
  } else if (operation === 'DELETE') {
    const existing = await validateOwner(userId, tableName, recordId)
    if (!existing || existing.deletedAt) {
      result = { idempotencyKey, status: 410, serverRecord: existing ? serializeRecord(existing) : null }
    } else {
      const deleted = await setDeleteState(userId, tableName, recordId, serverTimestamp)
      result = { idempotencyKey, status: 200, serverRecord: deleted }
    }
  } else {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, ErrorMessage[ErrorCodes.VALIDATION_FAILED], { status: 422 })
  }

  saveIdempotencyResult(`${userId}:${idempotencyKey}`, result)
  return result
}

async function applyUpdate(userId, tableName, recordId, payload, serverTimestamp) {
  const data = { ...payload, syncedAt: serverTimestamp }
  const model = MODEL_BY_TABLE[tableName]
  if (!model) throw new AppError(ErrorCodes.NOT_FOUND, ErrorMessage[ErrorCodes.NOT_FOUND], { status: 404 })

  if (model === 'task') {
    await taskService.updateTask({ userId, id: recordId, data })
  } else if (model === 'expense') {
    await expenseService.updateExpense({ userId, id: recordId, data })
  } else {
    await assetService.updateAsset({ userId, id: recordId, data })
  }
  return prisma[model].findUnique({ where: { id: recordId } })
}

export async function fetchTombstones({ userId, since, limit = 500 }) {
  const where = { userId }
  if (since) where.deletedAt = { gte: new Date(since) }
  const rows = await prisma.tombstone.findMany({
    where,
    orderBy: { deletedAt: 'asc' },
    take: limit
  })
  return serializeRecord(rows.map((t) => ({ tableName: t.tableName, recordId: t.recordId, deletedAt: t.deletedAt })))
}

export async function processSyncBatch({ userId, operations, lastSyncTimestamp }) {
  const serverTimestamp = new Date()
  const results = []

  for (const op of operations) {
    try {
      const result = await processOperation(userId, op, serverTimestamp)
      results.push(result)
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCodes.CONFLICT) {
        results.push({ idempotencyKey: op.idempotencyKey, status: 409, serverRecord: error.data })
      } else if (error instanceof AppError && error.code === ErrorCodes.GONE) {
        results.push({ idempotencyKey: op.idempotencyKey, status: 410, serverRecord: null })
      } else {
        logger.error('[sync] operation failed', {
          userId,
          idempotencyKey: op.idempotencyKey,
          error: error.message
        })
        throw error
      }
    }
  }

  const tombstones = await fetchTombstones({ userId, since: lastSyncTimestamp })

  return serializeRecord({
    results,
    tombstones,
    serverTimestamp
  })
}