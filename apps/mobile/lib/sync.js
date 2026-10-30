// SyncEngine - offline-first sync against the PRIME API (blueprint section 8).
//
// Contract (POST /api/sync):
//   request : { operations, lastSyncTimestamp }
//     operations: [{ idempotencyKey, operation, tableName, recordId, payload, clientVersion }]
//   response: { results, tombstones, serverTimestamp }
//     results[i]: { idempotencyKey, status, serverRecord }
//       status 200/201 -> applied; 409 (CONFLICT) -> server wins; 410 (GONE) -> deleted server-side
//     tombstones: [{ tableName, recordId, deletedAt }] - deletions since lastSyncTimestamp
//
// Rules applied here:
//   - Conflicts: server record overwrites the local row, queued op is dropped (8.2).
//   - Tombstones always win: a deleted row can never be re-inserted (10.0).
//   - Over-read (FR-SYNC-02): after every batch the recent indexes are read
//     back to detect out-of-band changes, guarded against stomping local
//     pending edits.
// Triggered by connectivity restore (NetInfo), manual refresh, foreground.
import NetInfo from '@react-native-community/netinfo'
import { AppState } from 'react-native'
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import { getDb, getLastSyncTimestamp, setLastSyncTimestamp } from './database.js'
import { apiClient } from './api.js'
import { useSyncStore } from '../store/sync.js'
import { useTasksStore } from '../store/tasks.js'
import { useExpensesStore } from '../store/expenses.js'
import { useAssetsStore } from '../store/assets.js'

const BACKGROUND_TASK = 'prime-background-sync'
const BATCH_SIZE = 50
const OVERREAD_LIMIT = 100
const MAX_RETRIES = 5

const APPLIERS = {
  tasks: (r) => useTasksStore.getState().applyServerRecord(r),
  expenses: (r) => useExpensesStore.getState().applyServerRecord(r),
  assets: (r) => useAssetsStore.getState().applyServerRecord(r)
}

const INDEX_ENDPOINTS = { tasks: '/tasks', expenses: '/expenses', assets: '/assets' }

let running = false
let cancelled = false
let backoffMs = 2000

async function collectQueue(db, limit = BATCH_SIZE) {
  return db.getAllAsync(
    `SELECT id, idempotency_key AS idempotencyKey, operation, table_name AS tableName,
            record_id AS recordId, client_version AS clientVersion, payload
     FROM sync_queue
     WHERE synced = 0 AND dead_lettered = 0
     ORDER BY idempotency_key ASC
     LIMIT ${limit}`
  )
}

async function applyServerRecord(tableName, record) {
  const store =
    tableName === 'tasks'
      ? useTasksStore.getState()
      : tableName === 'expenses'
        ? useExpensesStore.getState()
        : useAssetsStore.getState()
  // Tombstone guard: never resurrect a locally deleted record (10.0).
  if (record.deletedAt) return
  if (record.id && (await isTombstoned(tableName, record.id))) return
  await store.applyServerRecord(record)
}

async function isTombstoned(tableName, recordId) {
  const db = await getDb()
  const row = await db.getFirstAsync(
    'SELECT id FROM tombstones WHERE table_name = ? AND record_id = ?',
    tableName,
    recordId
  )
  return !!row
}

// Skip applying a server record while a newer local edit is still queued.
async function hasPendingEdit(tableName, recordId) {
  const db = await getDb()
  const row = await db.getFirstAsync(
    `SELECT id FROM sync_queue
     WHERE table_name = ? AND record_id = ? AND synced = 0 AND dead_lettered = 0`,
    tableName,
    recordId
  )
  return !!row
}

async function markLocalDeleted(tableName, recordId, deletedAt) {
  const db = await getDb()
  await db.runAsync(
    `UPDATE ${tableName}
     SET deleted_at = ?, synced_at = datetime('now'), updated_at = datetime('now'), version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    deletedAt ?? new Date().toISOString(),
    recordId
  )
  await db.runAsync(
    `INSERT INTO tombstones (id, user_id, table_name, record_id, deleted_at)
     VALUES (lower(hex(randomblob(16))), 'local-user', ?, ?, datetime('now'))
     ON CONFLICT(user_id, table_name, record_id) DO NOTHING`,
    tableName,
    recordId
  )
}

async function reconcileResult(db, opRow, result) {
  const tableName = opRow.tableName
  const status = result.status

  if (status === 200 || status === 201) {
    if (result.serverRecord) await applyServerRecord(tableName, result.serverRecord)
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', opRow.id)
  } else if (status === 409) {
    // CONFLICT - server wins, local op dropped (8.2).
    if (result.serverRecord) await applyServerRecord(tableName, result.serverRecord)
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', opRow.id)
  } else if (status === 410) {
    // GONE - record deleted server-side (or never existed). Local delete.
    await markLocalDeleted(tableName, opRow.recordId, result.serverRecord?.deletedAt)
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', opRow.id)
  } else {
    throw new Error(`Unknown sync status ${status}`)
  }
}

async function applyServerTombstones(tombstones) {
  const db = await getDb()
  for (const t of tombstones ?? []) {
    if (!APPLIERS[t.tableName]) continue
    const local = await db.getFirstAsync(
      `SELECT id FROM ${t.tableName} WHERE id = ? AND deleted_at IS NULL`,
      t.recordId
    )
    if (local) await markLocalDeleted(t.tableName, t.recordId, t.deletedAt)
    // Record already missing locally - still record the tombstone guard.
    await db.runAsync(
      `INSERT INTO tombstones (id, user_id, table_name, record_id, deleted_at)
       VALUES (lower(hex(randomblob(16))), 'local-user', ?, ?, datetime('now'))
       ON CONFLICT(user_id, table_name, record_id) DO NOTHING`,
      t.tableName,
      t.recordId
    )
  }
}

// Over-reading recent rows (FR-SYNC-02): pull a window of index data and
// merge it in, skipping rows with pending local edits or tombstones.
async function overRead() {
  const db = await getDb()
  for (const [tableName, path] of Object.entries(INDEX_ENDPOINTS)) {
    try {
      const res = await apiClient.get(path, {
        params: { limit: OVERREAD_LIMIT, page: 1 }
      })
      const rows = res.data.data?.data ?? []
      for (const row of rows) {
        if (!row.id) continue
        if (await isTombstoned(tableName, row.id)) continue
        if (await hasPendingEdit(tableName, row.id)) continue
        await applyServerRecord(tableName, row)
      }
    } catch {
      // Index pull is best-effort; queue flush is the source of truth.
    }
  }
}

async function flushQueue(db, lastSyncedAt) {
  let queue = await collectQueue(db)
  while (queue.length > 0) {
    const operations = queue.map((q) => ({
      idempotencyKey: q.idempotencyKey,
      operation: q.operation,
      tableName: q.tableName,
      recordId: q.recordId,
      clientVersion: q.clientVersion,
      payload: JSON.parse(q.payload)
    }))
    let res
    try {
      res = await apiClient.post('/sync', {
        operations,
        lastSyncTimestamp: lastSyncedAt
      })
    } catch (err) {
      // Network/server failure: retry with backoff, dead-letter the batch once
      // MAX_RETRIES is exceeded (FR-SYNC-01) so the queue can never stall.
      const ids = operations.map((o) => o.idempotencyKey)
      const placeholders = ids.map(() => '?').join(', ')
      const message = err?.message ?? 'sync failed'
      if (queue.every((q) => q.retries >= MAX_RETRIES)) {
        await db.runAsync(
          `UPDATE sync_queue SET dead_lettered = 1, last_error = ?
           WHERE idempotency_key IN (${placeholders})`,
          message,
          ...ids
        )
      } else {
        await db.runAsync(
          `UPDATE sync_queue SET retries = retries + 1, last_error = ?
           WHERE idempotency_key IN (${placeholders})`,
          message,
          ...ids
        )
      }
      await new Promise((r) => setTimeout(r, backoffMs))
      backoffMs = Math.min(backoffMs * 2, 60000)
      queue = await collectQueue(db)
      continue
    }
    const data = res.data.data
    const byKey = new Map(queue.map((q) => [q.idempotencyKey, q]))
    for (const result of data.results ?? []) {
      const opRow = byKey.get(result.idempotencyKey)
      if (!opRow) continue
      await reconcileResult(db, opRow, result)
    }
    await applyServerTombstones(data.tombstones)
    backoffMs = 2000
    queue = await collectQueue(db)
  }
}

export async function runOnce({ manual = false } = {}) {
  if (running) return
  running = true
  const store = useSyncStore.getState()
  store.setSyncing(true)
  try {
    const db = await getDb()
    const lastSyncedAt = await getLastSyncTimestamp()
    await flushQueue(db, lastSyncedAt)
    await overRead()
    await setLastSyncTimestamp(new Date().toISOString())
    store.setLastSyncTimestamp(new Date().getTime())

    // Keep in-memory lists in sync with the merged DB state.
    await Promise.all([
      useTasksStore.getState().load(),
      useExpensesStore.getState().load(),
      useAssetsStore.getState().load()
    ])
  } catch (err) {
    backoffMs = Math.min(backoffMs * 2, 60000)
    if (err?.response?.status === 401) {
      // Session expired - auth interceptor performs logout.
    }
  } finally {
    store.setSyncing(false)
    await store.refreshCounts()
    running = false
  }
  return BackgroundFetch.BackgroundFetchResult.Success
}

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    await runOnce()
    return BackgroundFetch.BackgroundFetchResult.Success
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

let registered = false

export async function registerBackgroundTask() {
  if (registered) return
  registered = true
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 30 })
    }
  } catch {
    // Background fetch unsupported - foreground sync only.
  }
}

let unsubscribeNetInfo = null
let unsubscribeAppState = null

export function startAutoSync() {
  cancelled = false
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected && !cancelled) {
      runOnce()
    }
  })
  // MOB-04: sync immediately when the app returns to the foreground.
  unsubscribeAppState = AppState.addEventListener('change', (state) => {
    if (state === 'active' && !cancelled) {
      runOnce()
    }
  })
  registerBackgroundTask()
  runOnce()
}

export function stopAutoSync() {
  cancelled = true
  if (unsubscribeNetInfo) unsubscribeNetInfo()
  if (unsubscribeAppState) unsubscribeAppState.remove()
}

export function setCancelled(value) {
  cancelled = value
}