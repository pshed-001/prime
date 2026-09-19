// Normalise Prisma records (Decimal -> Number, Date -> ISO string) so JSON
// responses match the exact shapes defined in Blueprint section 6.
import { Prisma } from '@prisma/client'

export function serializeRecord(value) {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if (Prisma.Decimal.isDecimal(value)) return Number(value.toString())
    if (Array.isArray(value)) return value.map(serializeRecord)
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = serializeRecord(v)
    return out
  }
  return value
}

export function serializeCollection(rows) {
  return rows.map(serializeRecord)
}