// Server-side idempotency store for sync operations. Keys are retained for
// 24 hours in memory. In Phase 1 a single API instance makes an in-memory
// map sufficient; Phase 2 replaces this with Redis (design doc 15.5).
const TTL_MS = 24 * 60 * 60 * 1000
const store = new Map()

export function saveIdempotencyResult(key, result) {
  store.set(key, { result, expiresAt: Date.now() + TTL_MS })
}

export function getIdempotencyResult(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    store.delete(key)
    return null
  }
  return entry.result
}