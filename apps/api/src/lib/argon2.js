import argon2 from 'argon2'
import { env } from '../config/env.js'

export function argon2Options() {
  return {
    type: argon2.argon2id,
    memoryCost: env.argon2.memoryCost,
    timeCost: env.argon2.timeCost,
    parallelism: env.argon2.parallelism
  }
}

export function hashPassword(plain) {
  return argon2.hash(plain, argon2Options())
}

export function verifyPassword(hash, plain) {
  return argon2.verify(hash, plain, argon2Options())
}

// Tokens (reset, verification, refresh) are also stored as Argon2id hashes.
export function hashToken(token) {
  return argon2.hash(token, argon2Options())
}

export function verifyTokenHash(hash, token) {
  return argon2.verify(hash, token, argon2Options())
}