import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateBase32Secret(byteLength = 20) {
  const buf = randomBytes(byteLength)
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(input) {
  const cleaned = String(input).replace(/=+$/, '').toUpperCase()
  let bits = 0
  let value = 0
  const out = []
  for (const char of cleaned) {
    const idx = ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  return String(code % 1_000_000).padStart(6, '0')
}

export function verifyTotp(secret, token, window = 1) {
  if (!secret || !token || !/^\d{6}$/.test(String(token))) return false
  const step = Math.floor(Date.now() / 1000 / 30)
  const target = Buffer.from(String(token))
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(hotp(secret, step + i))
    if (candidate.length === target.length && timingSafeEqual(candidate, target)) return true
  }
  return false
}

export function otpauthUrl(secret, email) {
  const label = encodeURIComponent(`PRIME:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=PRIME&algorithm=SHA1&digits=6&period=30`
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => randomBytes(5).toString('hex'))
}
