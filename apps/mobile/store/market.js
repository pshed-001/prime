import { create } from 'zustand'
import { getLiveFeed } from '../lib/market.js'

export const useMarketStore = create((set) => ({
  data: { crypto: [], indices: [], news: [], updatedAt: null },
  loading: false,
  error: null,
  lastFetchedAt: null,

  async load() {
    set({ loading: true, error: null })
    try {
      const data = await getLiveFeed()
      set({ data, lastFetchedAt: Date.now() })
    } catch (error) {
      const message = error && typeof error.message === 'string' ? error.message : 'Failed to load market data'
      set({ error: message })
    } finally {
      set({ loading: false })
    }
  }
}))