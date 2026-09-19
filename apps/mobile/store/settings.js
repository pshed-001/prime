import { create } from 'zustand'
import { getDb } from '../lib/database.js'
import { apiClient, unwrap } from '../lib/api.js'

export const useSettingsStore = create((set, get) => ({
  timezone: 'Africa/Lagos',
  baseCurrency: 'NGN',
  dailyBudget: 50000,
  theme: 'system',
  aiConsentGiven: false,
  loaded: false,

  async load() {
    const db = await getDb()
    const row = await db.getFirstAsync('SELECT * FROM user_settings LIMIT 1')
    if (row) {
      set({
        timezone: row.timezone,
        baseCurrency: row.base_currency,
        dailyBudget: row.daily_budget,
        theme: row.theme,
        aiConsentGiven: row.ai_consent === 1,
        loaded: true
      })
    } else {
      await db.runAsync(
        `INSERT INTO user_settings (id, user_id, timezone, base_currency, daily_budget)
         VALUES (?, 'local-user', ?, ?, ?)`,
        'local-settings',
        get().timezone,
        get().baseCurrency,
        get().dailyBudget
      )
      set({ loaded: true })
    }
  },

  async update(partial) {
    const current = get()
    const next = { ...current, ...partial }
    const db = await getDb()
    await db.runAsync(
      `UPDATE user_settings SET
        timezone = ?, base_currency = ?, daily_budget = ?, theme = ?, ai_consent = ?,
        updated_at = datetime('now')
       WHERE user_id = 'local-user'`,
      next.timezone,
      next.baseCurrency,
      next.dailyBudget,
      next.theme,
      next.aiConsentGiven ? 1 : 0
    )
    set(next)

    // Best-effort server sync (PATCH /api/auth/settings).
    try {
      const payload = {}
      if (partial.timezone !== undefined) payload.timezone = partial.timezone
      if (partial.baseCurrency !== undefined) payload.baseCurrency = partial.baseCurrency
      if (partial.dailyBudget !== undefined) payload.dailyBudget = partial.dailyBudget
      if (partial.theme !== undefined) payload.theme = partial.theme
      if (partial.aiConsentGiven !== undefined) payload.aiConsentGiven = partial.aiConsentGiven
      if (Object.keys(payload).length > 0) {
        await apiClient.patch('/auth/settings', payload)
      }
    } catch {
      // Offline - local change wins, synced on next opportunity.
    }
  }
}))