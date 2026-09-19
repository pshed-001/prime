// Local offline sync queue (FR-SYNC-01). Every offline mutation is captured
// here with a UUIDv7 idempotency key before any UI state is updated.
import { getDb } from './database.js'
import { uuidv7 } from '../utils/uuid.js'
import { useSyncStore } from '../store/sync.js'

export async function enqueueOperation({ db, tableName, recordId, operation, payload, clientVersion }) {
  const conn = db ?? (await getDb())
  const idempotencyKey = uuidv7()
  await conn.runAsync(
    `INSERT INTO sync_queue
      (id, user_id, idempotency_key, operation, table_name, record_id, payload, client_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uuidv7(),
    'local-user',
    idempotencyKey,
    operation,
    tableName,
    recordId,
    JSON.stringify(payload),
    clientVersion
  )
  useSyncStore.getState().refreshCounts()
  return idempotencyKey
}

export async function discardDeadLettered(id) {
  const db = await getDb()
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id)
  useSyncStore.getState().refreshCounts()
}

export async function retryDeadLettered(id) {
  const db = await getDb()
  await db.runAsync(
    'UPDATE sync_queue SET retries = 0, dead_lettered = 0, last_error = NULL WHERE id = ?',
    id
  )
  useSyncStore.getState().refreshCounts()
}