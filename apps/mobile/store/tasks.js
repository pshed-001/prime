import { create } from 'zustand'
import { getDb } from '../lib/database.js'
import { repoCreate, repoUpdate, repoSoftDelete, repoApplyServerRecord } from '../lib/repo.js'
import { uuidv7 } from '../utils/uuid.js'

const COLUMNS = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  status: 'status',
  dueDate: 'due_date',
  userId: 'user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  syncedAt: 'synced_at',
  deletedAt: 'deleted_at'
}

export const useTasksStore = create((set, get) => ({
  columns: COLUMNS,
  tasks: [],
  loaded: false,

  async load() {
    const db = await getDb()
    const rows = await db.getAllAsync(
      `SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY
        CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
        due_date ASC`
    )
    set({ tasks: rows, loaded: true })
  },

  async add(input) {
    const record = {
      id: uuidv7(),
      user_id: 'local-user',
      title: input.title,
      description: input.description ? input.description : '',
      priority: input.priority ?? 'MEDIUM',
      status: 'PENDING',
      due_date: input.dueDate ?? null,
      source: 'MANUAL'
    }
    await repoCreate({
      table: 'tasks',
      columns: COLUMNS,
      record,
      payload: {
        id: record.id,
        title: record.title,
        description: record.description || null,
        priority: record.priority,
        status: record.status,
        dueDate: record.due_date,
        source: record.source
      }
    })
    await get().load()
  },

  async update(id, input) {
    await repoUpdate({ table: 'tasks', id, columns: COLUMNS, changed: input })
    await get().load()
  },

  async toggleComplete(id, task) {
    const status = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    await repoUpdate({ table: 'tasks', id, columns: COLUMNS, changed: { status } })
    await get().load()
  },

  async remove(id) {
    await repoSoftDelete({ table: 'tasks', id })
    await get().load()
  },

  applyServerRecord(record) {
    return repoApplyServerRecord({ table: 'tasks', columns: COLUMNS, record })
  }
}))