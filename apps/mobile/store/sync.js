import { create } from 'zustand'
import { getDb } from '../lib/database.js'

export const useSyncStore = create((set, get) => ({
  pendingCount: 0,
  syncing: false,
  deadLettered: 0,
  lastSyncTimestamp: null,

  async refreshCounts() {
    const db = await getDb()
    const [pending, dead] = await Promise.all([
      db.getFirstAsync(
        'SELECT COUNT(*) AS n FROM sync_queue WHERE synced = 0 AND dead_lettered = 0'
      ),
      db.getFirstAsync(
        'SELECT COUNT(*) AS n FROM sync_queue WHERE dead_lettered = 1'
      )
    ])
    set({
      pendingCount: pending?.n ?? 0,
      deadLettered: dead?.n ?? 0
    })
  },

  setSyncing(syncing) {
    set({ syncing })
  },

  setLastSyncTimestamp(ts) {
    set({ lastSyncTimestamp: ts })
  }
}))