import { create } from 'zustand'
import { getDb } from '../lib/database.js'
import { repoCreate, repoUpdate, repoSoftDelete, repoApplyServerRecord } from '../lib/repo.js'
import { uuidv7 } from '../utils/uuid.js'
import { useSettingsStore } from './settings.js'

const COLUMNS = {
  name: 'name',
  category: 'category',
  value: 'value',
  currency: 'currency',
  valueBase: 'value_base',
  exchangeRate: 'exchange_rate',
  rateIsEstimate: 'rate_is_est',
  note: 'note',
  acquiredAt: 'acquired_at',
  userId: 'user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  syncedAt: 'synced_at',
  deletedAt: 'deleted_at'
}

export const useAssetsStore = create((set, get) => ({
  columns: COLUMNS,
  assets: [],
  loaded: false,

  async load() {
    const db = await getDb()
    const rows = await db.getAllAsync(
      'SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY created_at DESC'
    )
    set({ assets: rows, loaded: true })
  },

  async add(input) {
    const base = useSettingsStore.getState().baseCurrency
    const record = {
      id: uuidv7(),
      user_id: 'local-user',
      name: input.name,
      category: input.category,
      value: input.value,
      currency: input.currency,
      value_base: input.currency === base ? input.value : input.valueBase ?? input.value,
      exchange_rate: input.exchangeRate ?? null,
      rate_is_est: input.exchangeRate ? (input.rateIsEst ? 1 : 0) : 0,
      note: input.note ?? '',
      acquired_at: input.acquiredAt ?? null,
      source: 'MANUAL'
    }
    await repoCreate({
      table: 'assets',
      columns: COLUMNS,
      record,
      payload: {
        id: record.id,
        name: record.name,
        category: record.category,
        value: record.value,
        currency: record.currency,
        note: record.note || null,
        acquiredAt: record.acquired_at,
        source: record.source
      }
    })
    await get().load()
  },

  async update(id, changed) {
    await repoUpdate({ table: 'assets', id, columns: COLUMNS, changed })
    await get().load()
  },

  async remove(id) {
    await repoSoftDelete({ table: 'assets', id })
    await get().load()
  },

  applyServerRecord(record) {
    return repoApplyServerRecord({ table: 'assets', columns: COLUMNS, record })
  }
}))