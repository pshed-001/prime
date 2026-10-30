import { isIP } from 'node:net'

function ipv4ToInt(ip) {
  const [a, b, c, d] = ip.split('.').map(Number)
  return (((((a << 8) | b) << 8) | c) << 8 | d) >>> 0
}

function normalize(ip) {
  if (isIP(ip) === 4) return { v4: ipv4ToInt(ip) }
  const lower = String(ip).toLowerCase()
  const mapped = lower.startsWith('::ffff:') ? lower.slice(7) : null
  if (mapped && isIP(mapped) === 4) return { v4: ipv4ToInt(mapped) }
  const [left = '', right = ''] = lower.split('::')
  const leftParts = left ? left.split(':') : []
  const rightParts = right ? right.split(':') : []
  const missing = 8 - leftParts.length - rightParts.length
  if (missing < 0) return null
  const parts = [...leftParts, ...Array(missing).fill('0'), ...rightParts]
  if (parts.some((p) => !p)) {
    parts[parts.indexOf('')] = '0'
    if (parts.indexOf('') !== -1) return null
  }
  const big = parts.reduce((acc, p) => (acc << 16n) + BigInt(parseInt(p, 16) || 0), 0n)
  return { v6: big }
}

function inRange(ip, range, bits) {
  if (ip.v4 !== undefined && range.v4 !== undefined) {
    const v4bits = Math.min(bits, 32)
    const mask = v4bits === 0 ? 0 : (~((1 << (32 - v4bits)) - 1)) >>> 0
    return (ip.v4 & mask) === (range.v4 & mask)
  }
  if (ip.v6 !== undefined && range.v6 !== undefined) {
    const v6bits = Math.min(bits, 128)
    if (v6bits === 0) return true
    const shift = BigInt(128 - v6bits)
    return (ip.v6 >> shift) === (range.v6 >> shift)
  }
  return false
}

export function ipInCidr(ip, entry) {
  const [range, bitsRaw] = entry.includes('/') ? entry.split('/') : [entry, null]
  const parsed = normalize(ip)
  const parsedRange = normalize(range)
  if (!parsed || !parsedRange || (parsed.v4 === undefined) !== (parsedRange.v4 === undefined)) {
    return false
  }
  const bits = bitsRaw == null ? (parsedRange.v4 !== undefined ? 32 : 128) : Number(bitsRaw)
  if (!Number.isInteger(bits) || bits < 0 || bits > 128) return false
  return inRange(parsed, parsedRange, bits)
}

export function buildTrustFn(entries = []) {
  const list = entries.map(String).filter(Boolean)
  if (!list.length) return () => false
  return (ip) => list.some((entry) => ipInCidr(ip, entry))
}