// Generic offline repository helpers for tasks / expenses / assets. Every
// mutation writes to SQLite AND the sync queue atomically (FR-SYNC-01).
import { getDb } from './database.js'
import { enqueueOperation } from './queue.js'

function now() {
  return new Date().toISOString()
}

export async function repoCreate({ table, columns, record, payload }) {
  const db = await getDb()
  const keys = Object.keys(record)
  const cols = keys.map((k) => columns[k] ?? k)
  const placeholders = keys.map(() => '?').join(', ')
  const values = keys.map((k) => (record[k] == null ? null : record[k]))

  // FR-SYNC-01: table write + queue insert must be atomic - never a local
  // mutation without a matching sync_queue entry (and vice versa).
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO ${table} (id, version, created_at, updated_at, ${cols.join(', ')})
       VALUES (?, 1, ?, ?, ${placeholders})`,
      record.id,
      now(),
      now(),
      ...values
    )

    await enqueueOperation({
      db,
      tableName: table,
      recordId: record.id,
      operation: 'CREATE',
      payload: payload ?? record,
      clientVersion: 1
    })
  })
  return { ...record, version: 1 }
}

export async function repoUpdate({ table, id, changed, columns }) {
  const db = await getDb()
  const keys = Object.keys(changed)
  const sets = keys.map((k) => `${columns[k] ?? k} = ?`)
  sets.push('version = version + 1', "updated_at = datetime('now')")

  const versionRow = await db.getFirstAsync(`SELECT version FROM ${table} WHERE id = ?`, id)
  const currentVersion = versionRow?.version ?? 1

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`,
      ...keys.map((k) => (changed[k] == null ? null : changed[k])),
      id
    )

    await enqueueOperation({
      db,
      tableName: table,
      recordId: id,
      operation: 'UPDATE',
      payload: changed,
      clientVersion: currentVersion
    })
  })
  return { id, ...changed }
}

export async function repoSoftDelete({ table, id }) {
  const db = await getDb()
  const versionRow = await db.getFirstAsync(`SELECT version FROM ${table} WHERE id = ?`, id)
  const currentVersion = versionRow?.version ?? 1

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE ${table} SET deleted_at = ?, updated_at = datetime('now'), version = version + 1 WHERE id = ?`,
      now(),
      id
    )
    await enqueueOperation({
      db,
      tableName: table,
      recordId: id,
      operation: 'DELETE',
      payload: { deletedAt: now() },
      clientVersion: currentVersion
    })
  })
}

export async function repoApplyServerRecord({ table, columns, record }) {
  // Called on 409 CONFLICT - server wins, local record overwritten (8.2).
  const db = await getDb()
  const keys = Object.keys(record)
  const cols = keys.map((k) => columns[k] ?? k)
  const sets = cols.map((c) => `${c} = ?`)
  const id = record.id

  const version = record.version ?? 1
  const row = await db.getFirstAsync(`SELECT id FROM ${table} WHERE id = ?`, id)
  const values = keys.map((k) => (record[k] == null ? null : record[k]))

  if (row) {
    await db.runAsync(
      `UPDATE ${table} SET ${sets.join(', ')}, version = ?, updated_at = datetime('now') WHERE id = ?`,
      ...values,
      version,
      id
    )
  } else {
    await db.runAsync(
      `INSERT INTO ${table} (id, version, created_at, updated_at, ${cols.join(', ')})
       VALUES (?, ?, ?, ?, ${cols.map(() => '?').join(', ')})`,
      id,
      version,
      record.createdAt ?? now(),
      record.updatedAt ?? now(),
      ...values
    )
  }
}

export async function repoRemoveById({ table, id }) {
  const db = await getDb()
  await db.runAsync(
    `UPDATE ${table} SET deleted_at = ?, updated_at = datetime('now') WHERE id = ?`,
    now(),
    id
  )
}