import { apiClient } from './api.js'

export async function getLiveFeed() {
  const res = await apiClient.get('/market/live', { timeout: 15000 })
  return res.data?.data ?? { crypto: [], indices: [], news: [], updatedAt: null }
}