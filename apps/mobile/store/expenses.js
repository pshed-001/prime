import { create } from 'zustand'
import { getDb } from '../lib/database.js'
import { repoCreate, repoUpdate, repoSoftDelete, repoApplyServerRecord } from '../lib/repo.js'
import { uuidv7 } from '../utils/uuid.js'
import { useSettingsStore } from './settings.js'

const COLUMNS = {
  amount: 'amount',
  currency: 'currency',
  amountBase: 'amount_base',
  exchangeRate: 'exchange_rate',
  rateIsEstimate: 'rate_is_est',
  type: 'type',
  category: 'category',
  note: 'note',
  date: 'date',
  source: 'source',
  userId: 'user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  syncedAt: 'synced_at',
  deletedAt: 'deleted_at'
}

export const useExpensesStore = create((set, get) => ({
  columns: COLUMNS,
  expenses: [],
  loaded: false,

  async load() {
    const db = await getDb()
    const rows = await db.getAllAsync(
      'SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY date DESC'
    )
    set({ expenses: rows, loaded: true })
  },

  async add(input) {
    const base = useSettingsStore.getState().baseCurrency
    const record = {
      id: uuidv7(),
      user_id: 'local-user',
      amount: input.amount,
      currency: input.currency,
      amount_base: input.currency === base ? input.amount : input.amountBase ?? input.amount,
      exchange_rate: input.exchangeRate ?? null,
      rate_is_est: input.exchangeRate ? (input.rateIsEst ? 1 : 0) : 0,
      type: input.type,
      category: input.category,
      note: input.note ?? '',
      date: input.date,
      source: 'MANUAL'
    }
    await repoCreate({
      table: 'expenses',
      columns: COLUMNS,
      record,
      payload: {
        id: record.id,
        amount: record.amount,
        currency: record.currency,
        type: record.type,
        category: record.category,
        note: record.note || null,
        date: record.date,
        source: record.source
      }
    })
    await get().load()
  },

  async update(id, changed) {
    await repoUpdate({ table: 'expenses', id, columns: COLUMNS, changed })
    await get().load()
  },

  async remove(id) {
    await repoSoftDelete({ table: 'expenses', id })
    await get().load()
  },

  applyServerRecord(record) {
    return repoApplyServerRecord({ table: 'expenses', columns: COLUMNS, record })
  }
}))