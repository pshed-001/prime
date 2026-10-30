import winston from 'winston'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

// Logs are persisted to apps/api/logs so they survive restarts (previously
// the console-only transport dropped everything on process exit).
const here = path.dirname(fileURLToPath(import.meta.url))
const logsDir = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(here, '..', '..', 'logs')
fs.mkdirSync(logsDir, { recursive: true })

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ key: 'meta', fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.json()
)

export const logger = winston.createLogger({
  level,
  format: logFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'app.log'), maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true }),
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error', maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true })
  ]
})

// Access-style request logger. Mounted after the device-fingerprint middleware
// so deviceId / authenticated userId are available on every log line.
export function httpRequestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint()
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    // Request hotter than the shared <3s target gets a visible warning.
    const level = durationMs > 3000 ? 'warn' : 'info'
    logger[level]('[http] request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ip: req.ip ?? null,
      userId: req.user?.id ?? null,
      deviceId: req.deviceId ?? null
    })
  })
  return next()
}